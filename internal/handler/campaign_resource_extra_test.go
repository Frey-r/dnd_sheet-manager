package handler

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"

	"dnd-campaign-manager/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

// Complementary tests of the campaign resource routes (closure of T-13): the real handler and repository
// run over a scripted database/sql driver that answers each statement with rows, an affected-row count
// or an error, so the success paths that campaign_resource_npc_test.go cannot observe are checked too:
// which SQL and which arguments reach the database and which HTTP response comes out.

const (
	resCampaign = int64(7)
	resUser     = int64(3)
	resID       = int64(42)
)

var errScriptedDown = errors.New("database is down")

// sqlReply is the scripted answer to one statement: rows for a query, an affected-row count for an exec, or an error.
type sqlReply struct {
	columns  []string
	rows     [][]driver.Value
	affected int64
	err      error
}

// sqlRule answers every statement whose normalised text (lower case, single spaces) starts with prefix.
type sqlRule struct {
	prefix string
	reply  sqlReply
}

type sqlCall struct {
	query string // normalised
	args  []any
}

// scriptedDB is a driver.Connector that records every statement and answers it with the first matching rule;
// a statement no rule expects fails, so a test notices any SQL it did not script.
type scriptedDB struct {
	mu    sync.Mutex
	rules []sqlRule
	log   []sqlCall
}

var spaces = regexp.MustCompile(`\s+`)

func normaliseSQL(query string) string {
	return strings.ToLower(strings.TrimSpace(spaces.ReplaceAllString(query, " ")))
}

func (s *scriptedDB) Connect(context.Context) (driver.Conn, error) { return scriptedConn{s}, nil }
func (s *scriptedDB) Driver() driver.Driver                        { return scriptedDriver{s} }

func (s *scriptedDB) answer(query string, named []driver.NamedValue) sqlReply {
	args := make([]any, len(named))
	for i, arg := range named {
		args[i] = arg.Value
	}
	q := normaliseSQL(query)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.log = append(s.log, sqlCall{query: q, args: args})
	for _, rule := range s.rules {
		if strings.HasPrefix(q, rule.prefix) {
			return rule.reply
		}
	}
	return sqlReply{err: errors.New("unexpected statement: " + q)}
}

func (s *scriptedDB) calls() []sqlCall {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]sqlCall(nil), s.log...)
}

// call returns the only recorded statement that starts with prefix.
func (s *scriptedDB) call(t *testing.T, prefix string) sqlCall {
	t.Helper()
	var found []sqlCall
	for _, c := range s.calls() {
		if strings.HasPrefix(c.query, prefix) {
			found = append(found, c)
		}
	}
	if len(found) != 1 {
		t.Fatalf("want exactly one statement starting with %q, got %d: %v", prefix, len(found), s.calls())
	}
	return found[0]
}

func (s *scriptedDB) none(t *testing.T, prefix string) {
	t.Helper()
	for _, c := range s.calls() {
		if strings.HasPrefix(c.query, prefix) {
			t.Errorf("no statement starting with %q should run, got %q %v", prefix, c.query, c.args)
		}
	}
}

type scriptedDriver struct{ s *scriptedDB }

func (d scriptedDriver) Open(string) (driver.Conn, error) { return scriptedConn(d), nil }

type scriptedConn struct{ s *scriptedDB }

func (scriptedConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("prepare not supported") }
func (scriptedConn) Close() error                        { return nil }
func (scriptedConn) Begin() (driver.Tx, error)           { return nil, errors.New("transactions not supported") }
func (c scriptedConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	reply := c.s.answer(query, args)
	if reply.err != nil {
		return nil, reply.err
	}
	return &scriptedRows{columns: reply.columns, rows: reply.rows}, nil
}
func (c scriptedConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	reply := c.s.answer(query, args)
	if reply.err != nil {
		return nil, reply.err
	}
	return driver.RowsAffected(reply.affected), nil
}

type scriptedRows struct {
	columns []string
	rows    [][]driver.Value
	next    int
}

func (r *scriptedRows) Columns() []string { return r.columns }
func (r *scriptedRows) Close() error      { return nil }
func (r *scriptedRows) Next(dest []driver.Value) error {
	if r.next >= len(r.rows) {
		return io.EOF
	}
	copy(dest, r.rows[r.next])
	r.next++
	return nil
}

// resourceRouter mounts the campaign resource routes under /api for user 3 with the given GM flag.
func resourceRouter(t *testing.T, gm bool, rules ...sqlRule) (*gin.Engine, *scriptedDB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	script := &scriptedDB{rules: rules}
	db := sqlx.NewDb(sql.OpenDB(script), "postgres")
	t.Cleanup(func() { _ = db.Close() })
	r := gin.New()
	auth := r.Group("/api", func(c *gin.Context) {
		c.Set("user_id", resUser)
		c.Set("is_gm", gm)
	})
	NewCampaignResourceHandler(repository.NewCampaignResourceRepository(db)).RegisterRoutes(auth)
	return r, script
}

func request(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func resourcePath(kind string, id ...int64) string {
	path := "/api/campaigns/" + strconv.FormatInt(resCampaign, 10) + "/" + kind
	for _, v := range id {
		path += "/" + strconv.FormatInt(v, 10)
	}
	return path
}

// wantResponse checks the status and that the body is the JSON document want.
func wantResponse(t *testing.T, w *httptest.ResponseRecorder, status int, want string) {
	t.Helper()
	if w.Code != status {
		t.Fatalf("status %d, want %d (%s)", w.Code, status, w.Body)
	}
	if !sameJSON(w.Body.Bytes(), []byte(want)) {
		t.Errorf("body %s, want %s", w.Body, want)
	}
}

func sameJSON(a, b []byte) bool {
	var x, y any
	return json.Unmarshal(a, &x) == nil && json.Unmarshal(b, &y) == nil && reflect.DeepEqual(x, y)
}

// jsonValue reports whether a statement argument is the JSON document want (sent as bytes or text).
func jsonValue(arg any, want string) bool {
	switch v := arg.(type) {
	case []byte:
		return sameJSON(v, []byte(want))
	case string:
		return sameJSON([]byte(v), []byte(want))
	}
	return false
}

var (
	insertSQL = regexp.MustCompile(`^insert into (\w+) \(([^)]*)\) values \(([^)]*)\) returning id$`)
	updateSQL = regexp.MustCompile(`^update (\w+) set (.*), updated_at=now\(\) where campaign_id=\$(\d+) and id=\$(\d+)$`)
)

// placeholder returns the argument bound to "$n".
func placeholder(t *testing.T, c sqlCall, ref string) any {
	t.Helper()
	n, err := strconv.Atoi(strings.TrimPrefix(strings.TrimSpace(ref), "$"))
	if err != nil || n < 1 || n > len(c.args) {
		t.Fatalf("bad placeholder %q in %q (%d args)", ref, c.query, len(c.args))
	}
	return c.args[n-1]
}

// insertValues maps each column of an INSERT … RETURNING id to the argument bound to it.
func insertValues(t *testing.T, c sqlCall, table string) map[string]any {
	t.Helper()
	m := insertSQL.FindStringSubmatch(c.query)
	if m == nil || m[1] != table {
		t.Fatalf("not an INSERT INTO %s … RETURNING id: %q", table, c.query)
	}
	columns, refs := strings.Split(m[2], ","), strings.Split(m[3], ",")
	if len(columns) != len(refs) || len(refs) != len(c.args) {
		t.Fatalf("columns, placeholders and arguments differ: %q %v", c.query, c.args)
	}
	values := map[string]any{}
	for i, column := range columns {
		values[strings.TrimSpace(column)] = placeholder(t, c, refs[i])
	}
	return values
}

// updateValues maps each column set by an UPDATE to its argument and checks the campaign and id filters.
func updateValues(t *testing.T, c sqlCall, table string) map[string]any {
	t.Helper()
	m := updateSQL.FindStringSubmatch(c.query)
	if m == nil || m[1] != table {
		t.Fatalf("not an UPDATE %s … WHERE campaign_id AND id: %q", table, c.query)
	}
	if placeholder(t, c, "$"+m[3]) != resCampaign || placeholder(t, c, "$"+m[4]) != resID {
		t.Errorf("UPDATE must filter by campaign %d and id %d: %q %v", resCampaign, resID, c.query, c.args)
	}
	values := map[string]any{}
	for _, set := range strings.Split(m[2], ",") {
		column, ref, ok := strings.Cut(set, "=")
		if !ok {
			t.Fatalf("bad SET clause %q in %q", set, c.query)
		}
		values[strings.TrimSpace(column)] = placeholder(t, c, ref)
	}
	if len(values)+2 != len(c.args) {
		t.Errorf("UPDATE binds %d arguments for %d columns: %v", len(c.args), len(values), c.args)
	}
	return values
}

func wantArgs(t *testing.T, c sqlCall, want ...any) {
	t.Helper()
	if !reflect.DeepEqual(c.args, want) {
		t.Errorf("%q: args %v, want %v", c.query, c.args, want)
	}
}

// resourceFixture is what each kind stores and reads back.
type resourceFixture struct {
	kind, table string
	createBody  string
	plain       map[string]any    // columns sent as they are
	jsonColumns map[string]string // columns sent as JSON documents
	columns     []string          // columns of the row the database returns
	row         []driver.Value
	response    string // that row as the API returns it
}

var resourceFixtures = []resourceFixture{
	{
		kind: "npcs", table: "campaign_npcs",
		createBody:  `{"name":"Mira","role":"Posadera","race":"Elf","stats":{"str":10},"appearance":` + npcValidAppearance + `,"ignored":"x"}`,
		plain:       map[string]any{"name": "Mira", "role": "Posadera", "race": "Elf"},
		jsonColumns: map[string]string{"stats": `{"str":10}`, "appearance": npcValidAppearance},
		columns:     []string{"id", "campaign_id", "name", "role", "race", "stats", "appearance"},
		row:         []driver.Value{resID, resCampaign, "Mira", "Posadera", "Elf", []byte(`{"str":10}`), []byte(npcValidAppearance)},
		response:    `{"id":42,"campaign_id":7,"name":"Mira","role":"Posadera","race":"Elf","stats":{"str":10},"appearance":` + npcValidAppearance + `}`,
	},
	{
		kind: "maps", table: "campaign_maps",
		createBody:  `{"name":"Puerto","location":"Costa","pins":[{"x":1,"y":2,"label":"Faro"}]}`,
		plain:       map[string]any{"name": "Puerto", "location": "Costa"},
		jsonColumns: map[string]string{"pins": `[{"x":1,"y":2,"label":"Faro"}]`},
		columns:     []string{"id", "campaign_id", "name", "location", "pins"},
		row:         []driver.Value{resID, resCampaign, "Puerto", "Costa", []byte(`[{"x":1,"y":2,"label":"Faro"}]`)},
		response:    `{"id":42,"campaign_id":7,"name":"Puerto","location":"Costa","pins":[{"x":1,"y":2,"label":"Faro"}]}`,
	},
	{
		kind: "events", table: "campaign_events",
		createBody:  `{"title":"Boda","event_date":"2026-05-01","related_npcs":["Mira"],"related_locations":["Puerto","Faro"]}`,
		plain:       map[string]any{"title": "Boda", "event_date": "2026-05-01"},
		jsonColumns: map[string]string{"related_npcs": `["Mira"]`, "related_locations": `["Puerto","Faro"]`},
		columns:     []string{"id", "campaign_id", "title", "event_date", "related_npcs", "related_locations"},
		row:         []driver.Value{resID, resCampaign, "Boda", "2026-05-01", []byte(`["Mira"]`), []byte(`["Puerto","Faro"]`)},
		response:    `{"id":42,"campaign_id":7,"title":"Boda","event_date":"2026-05-01","related_npcs":["Mira"],"related_locations":["Puerto","Faro"]}`,
	},
	{
		kind: "notes", table: "campaign_notes",
		createBody: `{"title":"Plan","content":"Emboscada en el puente"}`,
		plain:      map[string]any{"title": "Plan", "content": "Emboscada en el puente"},
		columns:    []string{"id", "campaign_id", "author_id", "title", "content"},
		row:        []driver.Value{resID, resCampaign, resUser, "Plan", "Emboscada en el puente"},
		response:   `{"id":42,"campaign_id":7,"author_id":3,"title":"Plan","content":"Emboscada en el puente"}`,
	},
}

func (f resourceFixture) selectOne() string {
	return "select * from " + f.table + " where campaign_id=$1 and id=$2"
}

func (f resourceFixture) rowReply() sqlReply {
	return sqlReply{columns: f.columns, rows: [][]driver.Value{f.row}}
}

func TestCampaignResourceCreateStoresEachKind(t *testing.T) {
	for _, f := range resourceFixtures {
		t.Run(f.kind, func(t *testing.T) {
			r, db := resourceRouter(t, true,
				sqlRule{"insert into " + f.table, sqlReply{columns: []string{"id"}, rows: [][]driver.Value{{resID}}}},
				sqlRule{f.selectOne(), f.rowReply()},
			)
			w := request(r, http.MethodPost, resourcePath(f.kind), f.createBody)
			wantResponse(t, w, http.StatusCreated, f.response)

			values := insertValues(t, db.call(t, "insert into "), f.table)
			want := len(f.plain) + len(f.jsonColumns) + 1 // + campaign_id
			if values["campaign_id"] != resCampaign {
				t.Errorf("INSERT must set campaign_id=%d: %v", resCampaign, values)
			}
			if f.kind == "notes" {
				want++
				if values["author_id"] != resUser {
					t.Errorf("a note must record its author %d: %v", resUser, values)
				}
			} else if _, ok := values["author_id"]; ok {
				t.Errorf("only notes have an author: %v", values)
			}
			if len(values) != want {
				t.Errorf("INSERT sets %d columns, want %d (unknown fields are dropped): %v", len(values), want, values)
			}
			for column, value := range f.plain {
				if values[column] != value {
					t.Errorf("%s = %v, want %v", column, values[column], value)
				}
			}
			for column, doc := range f.jsonColumns {
				if !jsonValue(values[column], doc) {
					t.Errorf("%s must be stored as the JSON document %s, got %v", column, doc, values[column])
				}
			}
			wantArgs(t, db.call(t, f.selectOne()), resCampaign, resID)
		})
	}
}

func TestCampaignResourceCreateFailsWhenTheDatabaseFails(t *testing.T) {
	for _, f := range resourceFixtures {
		t.Run(f.kind, func(t *testing.T) {
			r, db := resourceRouter(t, true, sqlRule{"insert into " + f.table, sqlReply{err: errScriptedDown}})
			w := request(r, http.MethodPost, resourcePath(f.kind), f.createBody)
			wantResponse(t, w, http.StatusInternalServerError, `{"error":"internal error"}`)
			db.none(t, "select")
		})
	}
}

func TestCampaignResourceCreateValidatesTheInput(t *testing.T) {
	cases := []struct {
		name, kind, body, err string
	}{
		{"invalid JSON", "npcs", `{"name":`, "invalid JSON"},
		{"npc without name", "npcs", `{"title":"Mira"}`, "name is required"},
		{"npc with blank name", "npcs", `{"name":"   "}`, "name is required"},
		{"npc with a non-text name", "npcs", `{"name":5}`, "name is required"},
		{"map with empty name", "maps", `{"name":"","pins":[]}`, "name is required"},
		{"note needs a title, not a name", "notes", `{"name":"Plan","content":"x"}`, "title is required"},
		{"note with blank title", "notes", `{"title":" \t "}`, "title is required"},
		{"event needs a title, not a name", "events", `{"name":"Boda","event_date":"2026-05-01"}`, "title is required"},
		{"event without date", "events", `{"title":"Boda"}`, "event_date is required"},
		{"event with a non-text date", "events", `{"title":"Boda","event_date":20260501}`, "event_date is required"},
		{"event with a malformed date", "events", `{"title":"Boda","event_date":"01/05/2026"}`, "event_date must be YYYY-MM-DD"},
		{"event with an impossible date", "events", `{"title":"Boda","event_date":"2026-02-30"}`, "event_date must be YYYY-MM-DD"},
		{"event with bad relations", "events", `{"title":"Boda","event_date":"2026-05-01","related_npcs":"Mira"}`, "related_npcs must be an array of strings"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, db := resourceRouter(t, true)
			w := request(r, http.MethodPost, resourcePath(tc.kind), tc.body)
			wantResponse(t, w, http.StatusBadRequest, `{"error":`+strconv.Quote(tc.err)+`}`)
			if got := db.calls(); len(got) != 0 {
				t.Errorf("invalid input must not reach the database: %v", got)
			}
		})
	}
}

func TestCampaignResourceListAndGet(t *testing.T) {
	for _, f := range resourceFixtures {
		t.Run(f.kind, func(t *testing.T) {
			list := "select * from " + f.table + " where campaign_id=$1 order by id desc"
			older := append([]driver.Value{int64(41)}, f.row[1:]...)
			r, db := resourceRouter(t, true,
				sqlRule{list, sqlReply{columns: f.columns, rows: [][]driver.Value{f.row, older}}},
				sqlRule{f.selectOne(), f.rowReply()},
			)
			w := request(r, http.MethodGet, resourcePath(f.kind), "")
			wantResponse(t, w, http.StatusOK, `[`+f.response+`,`+strings.Replace(f.response, `"id":42`, `"id":41`, 1)+`]`)
			wantArgs(t, db.call(t, list), resCampaign)

			w = request(r, http.MethodGet, resourcePath(f.kind, resID), "")
			wantResponse(t, w, http.StatusOK, f.response)
			wantArgs(t, db.call(t, f.selectOne()), resCampaign, resID)
		})
	}
}

func TestCampaignResourceListEmptyAndErrors(t *testing.T) {
	r, _ := resourceRouter(t, true, sqlRule{"select * from campaign_notes", sqlReply{columns: []string{"id"}}})
	wantResponse(t, request(r, http.MethodGet, resourcePath("notes"), ""), http.StatusOK, `[]`)

	r, _ = resourceRouter(t, true, sqlRule{"select", sqlReply{err: errScriptedDown}})
	wantInternalError(t, request(r, http.MethodGet, resourcePath("maps"), ""), errScriptedDown.Error())
	wantInternalError(t, request(r, http.MethodGet, resourcePath("maps", resID), ""), errScriptedDown.Error())
}

func TestCampaignResourceGetMissingIsNotFound(t *testing.T) {
	r, _ := resourceRouter(t, true, sqlRule{"select * from campaign_events", sqlReply{columns: []string{"id"}}})
	wantResponse(t, request(r, http.MethodGet, resourcePath("events", resID), ""), http.StatusNotFound, `{"error":"not found"}`)
}

func TestCampaignResourceUpdateEachKind(t *testing.T) {
	cases := map[string]struct {
		body        string
		plain       map[string]any
		jsonColumns map[string]string
	}{
		"npcs":   {`{"role":"Espía","stats":{"dex":14},"id":99}`, map[string]any{"role": "Espía"}, map[string]string{"stats": `{"dex":14}`}},
		"maps":   {`{"pins":[{"x":3,"y":4}]}`, nil, map[string]string{"pins": `[{"x":3,"y":4}]`}},
		"events": {`{"event_date":"2026-06-01","related_npcs":null,"related_locations":["Faro"]}`, map[string]any{"event_date": "2026-06-01"}, map[string]string{"related_npcs": `[]`, "related_locations": `["Faro"]`}},
		"notes":  {`{"content":"Cambio de planes","author_id":9}`, map[string]any{"content": "Cambio de planes"}, nil},
	}
	for _, f := range resourceFixtures {
		tc := cases[f.kind]
		t.Run(f.kind, func(t *testing.T) {
			r, db := resourceRouter(t, true,
				sqlRule{"update " + f.table, sqlReply{affected: 1}},
				sqlRule{f.selectOne(), f.rowReply()},
			)
			w := request(r, http.MethodPut, resourcePath(f.kind, resID), tc.body)
			wantResponse(t, w, http.StatusOK, f.response)

			values := updateValues(t, db.call(t, "update "), f.table)
			if len(values) != len(tc.plain)+len(tc.jsonColumns) {
				t.Errorf("UPDATE must set only the known fields sent: %v", values)
			}
			for column, value := range tc.plain {
				if values[column] != value {
					t.Errorf("%s = %v, want %v", column, values[column], value)
				}
			}
			for column, doc := range tc.jsonColumns {
				if !jsonValue(values[column], doc) {
					t.Errorf("%s must be stored as the JSON document %s, got %v", column, doc, values[column])
				}
			}
			wantArgs(t, db.call(t, f.selectOne()), resCampaign, resID)
		})
	}
}

func TestCampaignResourceUpdateFailures(t *testing.T) {
	t.Run("missing resource", func(t *testing.T) {
		r, db := resourceRouter(t, true, sqlRule{"update campaign_notes", sqlReply{affected: 0}})
		w := request(r, http.MethodPut, resourcePath("notes", resID), `{"title":"Plan B"}`)
		wantResponse(t, w, http.StatusNotFound, `{"error":"not found"}`)
		db.none(t, "select")
	})
	t.Run("database error", func(t *testing.T) {
		r, db := resourceRouter(t, true, sqlRule{"update campaign_maps", sqlReply{err: errScriptedDown}})
		w := request(r, http.MethodPut, resourcePath("maps", resID), `{"name":"Puerto"}`)
		wantInternalError(t, w, errScriptedDown.Error())
		db.none(t, "select")
	})
	t.Run("no known field", func(t *testing.T) {
		r, db := resourceRouter(t, true)
		w := request(r, http.MethodPut, resourcePath("npcs", resID), `{"secret":"x","campaign_id":8}`)
		wantResponse(t, w, http.StatusBadRequest, `{"error":"no valid fields to update"}`)
		if got := db.calls(); len(got) != 0 {
			t.Errorf("an update without known fields must not reach the database: %v", got)
		}
	})
	t.Run("invalid JSON", func(t *testing.T) {
		r, db := resourceRouter(t, true)
		w := request(r, http.MethodPut, resourcePath("events", resID), `[1`)
		wantResponse(t, w, http.StatusBadRequest, `{"error":"invalid JSON"}`)
		if got := db.calls(); len(got) != 0 {
			t.Errorf("invalid JSON must not reach the database: %v", got)
		}
	})
	t.Run("invalid relations", func(t *testing.T) {
		r, db := resourceRouter(t, true)
		w := request(r, http.MethodPut, resourcePath("events", resID), `{"related_locations":[1]}`)
		wantResponse(t, w, http.StatusBadRequest, `{"error":"related_locations must be an array of strings"}`)
		if got := db.calls(); len(got) != 0 {
			t.Errorf("invalid relations must not reach the database: %v", got)
		}
	})
}

func TestCampaignResourceDeleteEachKind(t *testing.T) {
	for _, f := range resourceFixtures {
		t.Run(f.kind, func(t *testing.T) {
			del := "delete from " + f.table + " where campaign_id=$1 and id=$2"
			r, db := resourceRouter(t, true, sqlRule{del, sqlReply{affected: 1}})
			wantResponse(t, request(r, http.MethodDelete, resourcePath(f.kind, resID), ""), http.StatusOK, `{"message":"deleted"}`)
			wantArgs(t, db.call(t, del), resCampaign, resID)

			r, _ = resourceRouter(t, true, sqlRule{del, sqlReply{affected: 0}})
			wantResponse(t, request(r, http.MethodDelete, resourcePath(f.kind, resID), ""), http.StatusNotFound, `{"error":"not found"}`)

			r, _ = resourceRouter(t, true, sqlRule{del, sqlReply{err: errScriptedDown}})
			wantInternalError(t, request(r, http.MethodDelete, resourcePath(f.kind, resID), ""), errScriptedDown.Error())
		})
	}
}

func TestCampaignResourceRoutesRequireGM(t *testing.T) {
	r, db := resourceRouter(t, false)
	for _, f := range resourceFixtures {
		for _, call := range []struct{ method, path, body string }{
			{http.MethodGet, resourcePath(f.kind), ""},
			{http.MethodPost, resourcePath(f.kind), f.createBody},
			{http.MethodGet, resourcePath(f.kind, resID), ""},
			{http.MethodPut, resourcePath(f.kind, resID), f.createBody},
			{http.MethodDelete, resourcePath(f.kind, resID), ""},
		} {
			w := request(r, call.method, call.path, call.body)
			if w.Code != http.StatusForbidden || !sameJSON(w.Body.Bytes(), []byte(`{"error":"gm membership required"}`)) {
				t.Errorf("player %s %s: %d %s, want 403", call.method, call.path, w.Code, w.Body)
			}
		}
	}
	w := request(r, http.MethodPut, resourcePath("bot"), `{"enabled":true}`)
	wantResponse(t, w, http.StatusForbidden, `{"error":"gm membership required"}`)
	if got := db.calls(); len(got) != 0 {
		t.Errorf("a player must not reach the database: %v", got)
	}
}

const (
	botRead    = "select * from campaign_bot_settings where campaign_id=$1"
	botCurrent = "select enabled, personality, actions from campaign_bot_settings where campaign_id=$1"
	botUpsert  = "insert into campaign_bot_settings (campaign_id, enabled, personality, actions) values ($1,$2,$3,$4) on conflict (campaign_id) do update set enabled=$2, personality=$3, actions=$4, updated_at=now()"
)

var botStored = sqlReply{
	columns: []string{"campaign_id", "enabled", "personality", "actions"},
	rows:    [][]driver.Value{{resCampaign, true, "Sarcástico", []byte(`{"roll_dice":true,"narrate":false}`)}},
}

const botStoredJSON = `{"campaign_id":7,"enabled":true,"personality":"Sarcástico","actions":{"roll_dice":true,"narrate":false}}`

func TestCampaignBotRead(t *testing.T) {
	t.Run("not configured", func(t *testing.T) {
		r, db := resourceRouter(t, true, sqlRule{botRead, sqlReply{columns: botStored.columns}})
		w := request(r, http.MethodGet, resourcePath("bot"), "")
		wantResponse(t, w, http.StatusOK, `{"enabled":false,"personality":"","actions":{}}`)
		wantArgs(t, db.call(t, botRead), resCampaign)
	})
	t.Run("configured", func(t *testing.T) {
		r, _ := resourceRouter(t, true, sqlRule{botRead, botStored})
		wantResponse(t, request(r, http.MethodGet, resourcePath("bot"), ""), http.StatusOK, botStoredJSON)
	})
	t.Run("database error", func(t *testing.T) {
		r, _ := resourceRouter(t, true, sqlRule{botRead, sqlReply{err: errScriptedDown}})
		wantInternalError(t, request(r, http.MethodGet, resourcePath("bot"), ""), errScriptedDown.Error())
	})
}

func TestCampaignBotSave(t *testing.T) {
	t.Run("first save", func(t *testing.T) {
		r, db := resourceRouter(t, true,
			sqlRule{botCurrent, sqlReply{columns: []string{"enabled", "personality", "actions"}}},
			sqlRule{"insert into campaign_bot_settings", sqlReply{affected: 1}},
			sqlRule{botRead, botStored},
		)
		w := request(r, http.MethodPut, resourcePath("bot"), `{"enabled":true,"personality":"Sarcástico","actions":{"roll_dice":true,"narrate":false},"campaign_id":8}`)
		wantResponse(t, w, http.StatusOK, botStoredJSON)
		wantArgs(t, db.call(t, botCurrent), resCampaign)
		upsert := db.call(t, "insert into campaign_bot_settings")
		if upsert.query != botUpsert {
			t.Errorf("upsert: %q, want %q", upsert.query, botUpsert)
		}
		if len(upsert.args) != 4 || upsert.args[0] != resCampaign || upsert.args[1] != true || upsert.args[2] != "Sarcástico" ||
			!jsonValue(upsert.args[3], `{"roll_dice":true,"narrate":false}`) {
			t.Errorf("upsert args %v, want [7 true Sarcástico {actions JSON}]", upsert.args)
		}
		wantArgs(t, db.call(t, botRead), resCampaign)
	})
	t.Run("first partial save starts disabled and without personality", func(t *testing.T) {
		r, db := resourceRouter(t, true,
			sqlRule{botCurrent, sqlReply{columns: []string{"enabled", "personality", "actions"}}},
			sqlRule{"insert into campaign_bot_settings", sqlReply{affected: 1}},
			sqlRule{botRead, botStored},
		)
		w := request(r, http.MethodPut, resourcePath("bot"), `{"actions":{"narrate":true}}`)
		wantResponse(t, w, http.StatusOK, botStoredJSON)
		upsert := db.call(t, "insert into campaign_bot_settings")
		if len(upsert.args) != 4 || upsert.args[1] != false || upsert.args[2] != "" || !jsonValue(upsert.args[3], `{"narrate":true}`) {
			t.Errorf("a first save without enabled or personality must store false and \"\": %v", upsert.args)
		}
	})
	t.Run("partial save keeps the stored values", func(t *testing.T) {
		r, db := resourceRouter(t, true,
			sqlRule{botCurrent, sqlReply{columns: []string{"enabled", "personality", "actions"}, rows: [][]driver.Value{{true, "Viejo", []byte(`{}`)}}}},
			sqlRule{"insert into campaign_bot_settings", sqlReply{affected: 1}},
			sqlRule{botRead, botStored},
		)
		w := request(r, http.MethodPut, resourcePath("bot"), `{"personality":"Amable"}`)
		wantResponse(t, w, http.StatusOK, botStoredJSON)
		upsert := db.call(t, "insert into campaign_bot_settings")
		if len(upsert.args) != 4 || upsert.args[1] != true || upsert.args[2] != "Amable" {
			t.Errorf("a partial save must keep enabled=true and set the personality: %v", upsert.args)
		}
	})
	t.Run("reading the current settings fails", func(t *testing.T) {
		r, db := resourceRouter(t, true, sqlRule{botCurrent, sqlReply{err: errScriptedDown}})
		w := request(r, http.MethodPut, resourcePath("bot"), `{"enabled":true}`)
		wantInternalError(t, w, errScriptedDown.Error())
		db.none(t, "insert")
	})
	t.Run("the upsert fails", func(t *testing.T) {
		r, db := resourceRouter(t, true,
			sqlRule{botCurrent, sqlReply{columns: []string{"enabled", "personality", "actions"}}},
			sqlRule{"insert into campaign_bot_settings", sqlReply{err: errScriptedDown}},
		)
		w := request(r, http.MethodPut, resourcePath("bot"), `{"enabled":true}`)
		wantInternalError(t, w, errScriptedDown.Error())
		db.none(t, botRead)
	})
	t.Run("invalid JSON", func(t *testing.T) {
		r, db := resourceRouter(t, true)
		wantResponse(t, request(r, http.MethodPut, resourcePath("bot"), `{"enabled":`), http.StatusBadRequest, `{"error":"invalid JSON"}`)
		if got := db.calls(); len(got) != 0 {
			t.Errorf("invalid JSON must not reach the database: %v", got)
		}
	})
}
