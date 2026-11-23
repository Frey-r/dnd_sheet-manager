package handler

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"testing"

	"dnd-campaign-manager/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

// T-13 · PNJ con raza, clase y apariencia (contratos/T-13-npc-datos.md, D-0041), without Postgres:
// the real handler and repository run over a database/sql driver that records every statement and its
// arguments and then fails. "Saved" means the INSERT/UPDATE carried the value; "not saved" means no
// statement reached the database. The round trip against Postgres is in campaign_resource_npc_db_test.go.

const npcValidAppearance = `{"v":1,"body":0,"skin":"#c68642","eyes":"#3b6ea5","hair":3,"hairColor":"#2b1a10","outfit":5,"outfitColors":["#7a2e2e","#d9b26f"],"feature":1}`
const npcOtherAppearance = `{"v":1,"body":1,"skin":"#8d5524","eyes":"#4a8a4a","hair":5,"hairColor":"#a0522d","outfit":3,"outfitColors":["#3a5fa8","#e8d8a8"],"feature":2}`

var errRecordingDB = errors.New("recording database: statement recorded, no result")

type recordedStatement struct {
	query string
	args  []any
}

// recordingDB is a driver.Connector whose connections record each statement and fail it.
type recordingDB struct {
	mu         sync.Mutex
	statements []recordedStatement
}

func (r *recordingDB) Connect(context.Context) (driver.Conn, error) { return recordingConn{r}, nil }
func (r *recordingDB) Driver() driver.Driver                        { return recordingDriver{r} }

func (r *recordingDB) record(query string, args []driver.NamedValue) {
	values := make([]any, len(args))
	for i, arg := range args {
		values[i] = arg.Value
	}
	r.mu.Lock()
	r.statements = append(r.statements, recordedStatement{query: query, args: values})
	r.mu.Unlock()
}

func (r *recordingDB) all() []recordedStatement {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]recordedStatement(nil), r.statements...)
}

// find returns the first recorded statement on campaign_npcs that starts with verb (insert, update).
func (r *recordingDB) find(verb string) (recordedStatement, bool) {
	for _, s := range r.all() {
		q := strings.ToLower(strings.TrimSpace(s.query))
		if strings.HasPrefix(q, verb) && strings.Contains(q, "campaign_npcs") {
			return s, true
		}
	}
	return recordedStatement{}, false
}

type recordingDriver struct{ r *recordingDB }

func (d recordingDriver) Open(string) (driver.Conn, error) { return recordingConn(d), nil }

type recordingConn struct{ r *recordingDB }

func (recordingConn) Prepare(string) (driver.Stmt, error) { return nil, errRecordingDB }
func (recordingConn) Close() error                        { return nil }
func (recordingConn) Begin() (driver.Tx, error)           { return recordingTx{}, nil }
func (c recordingConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	c.r.record(query, args)
	return nil, errRecordingDB
}
func (c recordingConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	c.r.record(query, args)
	return nil, errRecordingDB
}

type recordingTx struct{}

func (recordingTx) Commit() error   { return nil }
func (recordingTx) Rollback() error { return nil }

// npcRouter mounts the campaign resource routes under /api with the given GM flag (user 1, campaign 1).
func npcRouter(t *testing.T, gm bool) (*gin.Engine, *recordingDB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := &recordingDB{}
	db := sqlx.NewDb(sql.OpenDB(rec), "postgres")
	t.Cleanup(func() { _ = db.Close() })
	r := gin.New()
	auth := r.Group("/api", func(c *gin.Context) {
		c.Set("user_id", int64(1))
		c.Set("is_gm", gm)
	})
	NewCampaignResourceHandler(repository.NewCampaignResourceRepository(db)).RegisterRoutes(auth)
	return r, rec
}

func send(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func decodeJSON(t *testing.T, raw string) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		t.Fatalf("fixture is not JSON: %v", err)
	}
	return out
}

// jsonArg reports whether one of the arguments is a JSON document equal to want.
func jsonArg(args []any, want map[string]any) bool {
	for _, arg := range args {
		var raw []byte
		switch v := arg.(type) {
		case []byte:
			raw = v
		case string:
			raw = []byte(v)
		default:
			continue
		}
		var got map[string]any
		if json.Unmarshal(raw, &got) == nil && reflect.DeepEqual(got, want) {
			return true
		}
	}
	return false
}

func hasArg(args []any, want string) bool {
	for _, arg := range args {
		if s, ok := arg.(string); ok && s == want {
			return true
		}
		if b, ok := arg.([]byte); ok && string(b) == want {
			return true
		}
	}
	return false
}

func TestNPCCreateStoresRaceClassAndAppearance(t *testing.T) { // N1
	r, rec := npcRouter(t, true)
	body := `{"name":"Pip","race":"Halfling (Player's Handbook)","class":"Warrior Sidekick","status":"ally","appearance":` + npcValidAppearance + `}`
	w := send(r, http.MethodPost, "/api/campaigns/1/npcs", body)
	if w.Code == http.StatusBadRequest {
		t.Fatalf("a valid appearance must not be rejected: %s", w.Body)
	}
	insert, ok := rec.find("insert")
	if !ok {
		t.Fatalf("no INSERT into campaign_npcs reached the database (status %d: %s)", w.Code, w.Body)
	}
	q := strings.ToLower(insert.query)
	for _, column := range []string{"race", "class", "appearance"} {
		if !strings.Contains(q, column) {
			t.Errorf("INSERT must set %s: %s", column, insert.query)
		}
	}
	if !hasArg(insert.args, "Halfling (Player's Handbook)") || !hasArg(insert.args, "Warrior Sidekick") {
		t.Errorf("INSERT must carry the race and the class: %v", insert.args)
	}
	if !jsonArg(insert.args, decodeJSON(t, npcValidAppearance)) {
		t.Errorf("INSERT must carry the validated appearance as JSON: %v", insert.args)
	}
}

func TestNPCInvalidAppearanceRejected(t *testing.T) { // N2
	valid := npcValidAppearance
	cases := map[string]string{
		"hair 12":           strings.Replace(valid, `"hair":3`, `"hair":12`, 1),
		"unknown key":       strings.Replace(valid, `"feature":1`, `"feature":1,"wings":1`, 1),
		"malformed colour":  strings.Replace(valid, `#c68642`, `red`, 1),
		"larger than 1 KB":  `{"v":1,"skin":"#` + strings.Repeat("a", 1100) + `"}`,
		"not an object":     `[1,2]`,
		"wrong version (2)": strings.Replace(valid, `"v":1`, `"v":2`, 1),
	}
	for name, appearance := range cases {
		t.Run(name, func(t *testing.T) {
			r, rec := npcRouter(t, true)
			create := send(r, http.MethodPost, "/api/campaigns/1/npcs", `{"name":"Pip","race":"Halfling","class":"Warrior Sidekick","appearance":`+appearance+`}`)
			if create.Code != http.StatusBadRequest {
				t.Errorf("POST: status %d, want 400 (%s)", create.Code, create.Body)
			}
			update := send(r, http.MethodPut, "/api/campaigns/1/npcs/5", `{"race":"Halfling","appearance":`+appearance+`}`)
			if update.Code != http.StatusBadRequest {
				t.Errorf("PUT: status %d, want 400 (%s)", update.Code, update.Body)
			}
			if got := rec.all(); len(got) != 0 {
				t.Errorf("an invalid appearance must not reach the database, got %d statements: %v", len(got), got)
			}
		})
	}
}

func TestNPCUpdateRaceClassAndAppearance(t *testing.T) { // N3
	r, rec := npcRouter(t, true)
	w := send(r, http.MethodPut, "/api/campaigns/1/npcs/5", `{"race":"Gnome","class":"Expert Sidekick","appearance":`+npcOtherAppearance+`}`)
	if w.Code == http.StatusBadRequest && len(rec.all()) == 0 {
		t.Fatalf("a valid update must not be rejected: %s", w.Body)
	}
	update, ok := rec.find("update")
	if !ok {
		t.Fatalf("no UPDATE of campaign_npcs reached the database (status %d: %s)", w.Code, w.Body)
	}
	if !hasArg(update.args, "Gnome") || !hasArg(update.args, "Expert Sidekick") {
		t.Errorf("UPDATE must carry the race and the class: %v", update.args)
	}
	if !jsonArg(update.args, decodeJSON(t, npcOtherAppearance)) {
		t.Errorf("UPDATE must carry the validated appearance as JSON: %v", update.args)
	}
}

func TestNPCUpdateNullAppearanceClearsIt(t *testing.T) { // N3: appearance null → SQL NULL
	r, rec := npcRouter(t, true)
	w := send(r, http.MethodPut, "/api/campaigns/1/npcs/5", `{"appearance":null}`)
	update, ok := rec.find("update")
	if !ok {
		t.Fatalf("appearance: null must update the NPC (status %d: %s)", w.Code, w.Body)
	}
	q := strings.ToLower(update.query)
	if !strings.Contains(q, "appearance") {
		t.Fatalf("UPDATE must set appearance: %s", update.query)
	}
	literalNull := regexp.MustCompile(`appearance\s*=\s*null`).MatchString(q)
	nullArg := false
	for _, arg := range update.args {
		if arg == nil {
			nullArg = true
		}
		if s, ok := arg.(string); ok && strings.TrimSpace(s) == "null" {
			t.Errorf("appearance: null must be stored as SQL NULL, not as the JSON value null: %v", update.args)
		}
		if b, ok := arg.([]byte); ok && strings.TrimSpace(string(b)) == "null" {
			t.Errorf("appearance: null must be stored as SQL NULL, not as the JSON value null: %v", update.args)
		}
	}
	if !literalNull && !nullArg {
		t.Errorf("appearance: null must set the column to SQL NULL: %s %v", update.query, update.args)
	}
}

func TestNPCWithoutNewFieldsStillCreated(t *testing.T) { // N4
	r, rec := npcRouter(t, true)
	w := send(r, http.MethodPost, "/api/campaigns/1/npcs", `{"name":"Viejo Marlo","role":"Barquero"}`)
	if w.Code == http.StatusBadRequest {
		t.Fatalf("an NPC without race, class or appearance must still be accepted: %s", w.Body)
	}
	insert, ok := rec.find("insert")
	if !ok {
		t.Fatalf("no INSERT into campaign_npcs reached the database (status %d: %s)", w.Code, w.Body)
	}
	for _, arg := range insert.args {
		if b, ok := arg.([]byte); ok && strings.TrimSpace(string(b)) == "null" {
			t.Errorf("an absent appearance must stay NULL, not the JSON value null: %v", insert.args)
		}
	}
}

func TestNPCWritesRequireGM(t *testing.T) { // N5
	r, rec := npcRouter(t, false)
	body := `{"name":"Pip","race":"Halfling","class":"Warrior Sidekick","appearance":` + npcValidAppearance + `}`
	if w := send(r, http.MethodPost, "/api/campaigns/1/npcs", body); w.Code != http.StatusForbidden {
		t.Errorf("player POST: status %d, want 403", w.Code)
	}
	if w := send(r, http.MethodPut, "/api/campaigns/1/npcs/5", body); w.Code != http.StatusForbidden {
		t.Errorf("player PUT: status %d, want 403", w.Code)
	}
	if got := rec.all(); len(got) != 0 {
		t.Errorf("a player must not reach the database, got %d statements", len(got))
	}
}
