package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/jmoiron/sqlx"
)

// Repository-level tests of CampaignResourceRepository (closure of T-13) for what the HTTP routes cannot
// reach: unknown kinds, the "bot" kind through Create/Update/Delete, oversized text and how rows are decoded.
// The database is a scripted database/sql driver that records each statement and answers it by prefix.

type stubReply struct {
	columns  []string
	rows     [][]driver.Value
	affected int64
	err      error
}

type stubStatement struct {
	query string // lower case, single spaces
	args  []any
}

type stubDB struct {
	mu      sync.Mutex
	replies map[string]stubReply // by statement prefix
	log     []stubStatement
}

func (s *stubDB) Connect(context.Context) (driver.Conn, error) { return stubConn{s}, nil }
func (s *stubDB) Driver() driver.Driver                        { return stubDriver{s} }

func (s *stubDB) answer(query string, named []driver.NamedValue) stubReply {
	args := make([]any, len(named))
	for i, arg := range named {
		args[i] = arg.Value
	}
	q := strings.ToLower(strings.Join(strings.Fields(query), " "))
	s.mu.Lock()
	defer s.mu.Unlock()
	s.log = append(s.log, stubStatement{query: q, args: args})
	for prefix, reply := range s.replies {
		if strings.HasPrefix(q, prefix) {
			return reply
		}
	}
	return stubReply{err: errors.New("unexpected statement: " + q)}
}

func (s *stubDB) statements() []stubStatement {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]stubStatement(nil), s.log...)
}

type stubDriver struct{ s *stubDB }

func (d stubDriver) Open(string) (driver.Conn, error) { return stubConn(d), nil }

type stubConn struct{ s *stubDB }

func (stubConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("prepare not supported") }
func (stubConn) Close() error                        { return nil }
func (stubConn) Begin() (driver.Tx, error)           { return nil, errors.New("transactions not supported") }
func (c stubConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	reply := c.s.answer(query, args)
	if reply.err != nil {
		return nil, reply.err
	}
	return &stubRows{columns: reply.columns, rows: reply.rows}, nil
}
func (c stubConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	reply := c.s.answer(query, args)
	if reply.err != nil {
		return nil, reply.err
	}
	return driver.RowsAffected(reply.affected), nil
}

type stubRows struct {
	columns []string
	rows    [][]driver.Value
	next    int
}

func (r *stubRows) Columns() []string { return r.columns }
func (r *stubRows) Close() error      { return nil }
func (r *stubRows) Next(dest []driver.Value) error {
	if r.next >= len(r.rows) {
		return io.EOF
	}
	copy(dest, r.rows[r.next])
	r.next++
	return nil
}

func stubRepository(t *testing.T, replies map[string]stubReply) (*CampaignResourceRepository, *stubDB) {
	t.Helper()
	stub := &stubDB{replies: replies}
	db := sqlx.NewDb(sql.OpenDB(stub), "postgres")
	t.Cleanup(func() { _ = db.Close() })
	return NewCampaignResourceRepository(db), stub
}

func noStatements(t *testing.T, stub *stubDB) {
	t.Helper()
	if got := stub.statements(); len(got) != 0 {
		t.Errorf("no statement should reach the database, got %v", got)
	}
}

func TestCampaignResourceRepoUnknownKind(t *testing.T) {
	repo, stub := stubRepository(t, nil)
	ctx := context.Background()
	input := map[string]any{"name": "Mira"}
	if _, err := repo.List(ctx, 7, "spells"); err != ErrResourceNotFound {
		t.Errorf("List: %v, want ErrResourceNotFound", err)
	}
	if _, err := repo.Get(ctx, 7, 42, "spells"); err != ErrResourceNotFound {
		t.Errorf("Get: %v, want ErrResourceNotFound", err)
	}
	if _, err := repo.Create(ctx, 7, 3, "spells", input); err != ErrResourceNotFound {
		t.Errorf("Create: %v, want ErrResourceNotFound", err)
	}
	if _, err := repo.Update(ctx, 7, 42, 3, "spells", input); err != ErrResourceNotFound {
		t.Errorf("Update: %v, want ErrResourceNotFound", err)
	}
	if err := repo.Delete(ctx, 7, 42, "spells"); err != ErrResourceNotFound {
		t.Errorf("Delete: %v, want ErrResourceNotFound", err)
	}
	noStatements(t, stub)
}

// The bot settings are one row per campaign: they cannot be deleted through the generic resource API.
func TestCampaignResourceRepoBotCannotBeDeleted(t *testing.T) {
	repo, stub := stubRepository(t, map[string]stubReply{"delete": {affected: 1}})
	if err := repo.Delete(context.Background(), 7, 42, "bot"); err != ErrResourceNotFound {
		t.Errorf("Delete bot: %v, want ErrResourceNotFound", err)
	}
	noStatements(t, stub)
}

// Create and Update of the "bot" kind are the upsert of SaveBot: read the current settings, upsert, read back.
func TestCampaignResourceRepoBotCreateAndUpdateUpsert(t *testing.T) {
	stored := stubReply{
		columns: []string{"campaign_id", "enabled", "personality", "actions"},
		rows:    [][]driver.Value{{int64(7), true, "Amable", []byte(`{"narrate":true}`)}},
	}
	want := map[string]any{"campaign_id": int64(7), "enabled": true, "personality": "Amable", "actions": map[string]any{"narrate": true}}
	writes := map[string]func(*CampaignResourceRepository) (map[string]any, error){
		"Create": func(r *CampaignResourceRepository) (map[string]any, error) {
			return r.Create(context.Background(), 7, 3, "bot", map[string]any{"enabled": true, "personality": "Amable", "unknown": 1})
		},
		"Update": func(r *CampaignResourceRepository) (map[string]any, error) {
			return r.Update(context.Background(), 7, 42, 3, "bot", map[string]any{"enabled": true, "personality": "Amable", "unknown": 1})
		},
	}
	for name, write := range writes {
		t.Run(name, func(t *testing.T) {
			repo, stub := stubRepository(t, map[string]stubReply{
				"select enabled, personality, actions from campaign_bot_settings where campaign_id=$1": {columns: []string{"enabled", "personality", "actions"}},
				"insert into campaign_bot_settings (campaign_id, enabled, personality, actions)":       {affected: 1},
				"select * from campaign_bot_settings where campaign_id=$1":                              stored,
			})
			got, err := write(repo)
			if err != nil {
				t.Fatalf("%s bot: %v", name, err)
			}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("%s bot returned %v, want %v", name, got, want)
			}
			log := stub.statements()
			if len(log) != 3 || !strings.HasPrefix(log[0].query, "select enabled") || !strings.HasPrefix(log[1].query, "insert into campaign_bot_settings") ||
				!strings.HasPrefix(log[2].query, "select * from campaign_bot_settings") {
				t.Fatalf("%s bot must read, upsert and read back the settings: %v", name, log)
			}
			if args := log[1].args; len(args) != 4 || args[0] != int64(7) || args[1] != true || args[2] != "Amable" {
				t.Errorf("upsert args %v, want campaign 7, enabled true, personality Amable", args)
			}
		})
	}
}

func TestCampaignResourceRepoRejectsOversizedText(t *testing.T) {
	ctx := context.Background()
	huge := strings.Repeat("a", 1_000_001)
	repo, stub := stubRepository(t, nil)
	if _, err := repo.Create(ctx, 7, 3, "notes", map[string]any{"title": "Plan", "content": huge}); err == nil || err.Error() != "field content is too long" {
		t.Errorf("Create with 1 000 001 bytes: %v, want field content is too long", err)
	}
	if _, err := repo.Update(ctx, 7, 42, 3, "notes", map[string]any{"content": huge}); err == nil {
		t.Error("Update with 1 000 001 bytes must fail")
	}
	if _, err := repo.Create(ctx, 7, 3, "npcs", map[string]any{"name": "Mira", "stats": map[string]any{"bad": make(chan int)}}); err == nil {
		t.Error("Create with a value that is not JSON must fail")
	}
	noStatements(t, stub)

	// The limit itself is allowed.
	repo, stub = stubRepository(t, map[string]stubReply{
		"insert into campaign_notes":                                 {columns: []string{"id"}, rows: [][]driver.Value{{int64(42)}}},
		"select * from campaign_notes where campaign_id=$1 and id=$2": {columns: []string{"id"}, rows: [][]driver.Value{{int64(42)}}},
	})
	if _, err := repo.Create(ctx, 7, 3, "notes", map[string]any{"title": "Plan", "content": huge[1:]}); err != nil {
		t.Errorf("Create with exactly 1 000 000 bytes: %v", err)
	}
	if got := stub.statements(); len(got) != 2 {
		t.Errorf("want the INSERT and the read back, got %v", got)
	}
}

// Only the declared JSON columns are decoded; anything else the driver hands over as bytes (lib/pq does so
// for numeric or uuid columns) is returned untouched, and an undecodable JSON column is left as it came.
func TestCampaignResourceRepoDecodesOnlyJSONColumns(t *testing.T) {
	repo, _ := stubRepository(t, map[string]stubReply{
		"select * from campaign_maps where campaign_id=$1 order by id desc": {
			columns: []string{"id", "name", "description", "pins"},
			rows: [][]driver.Value{
				{int64(2), "Puerto", []byte(`{"looks":"like json"}`), []byte(`[{"x":1}]`)},
				{int64(1), "Faro", []byte(`[1,2]`), []byte(`not json`)},
			},
		},
	})
	rows, err := repo.List(context.Background(), 7, "maps")
	if err != nil {
		t.Fatal(err)
	}
	want := []map[string]any{
		{"id": int64(2), "name": "Puerto", "description": []byte(`{"looks":"like json"}`), "pins": []any{map[string]any{"x": float64(1)}}},
		{"id": int64(1), "name": "Faro", "description": []byte(`[1,2]`), "pins": []byte(`not json`)},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("List decoded %v, want %v", rows, want)
	}
}

func TestCampaignResourceRepoGetBotMissingAndFailing(t *testing.T) {
	repo, _ := stubRepository(t, map[string]stubReply{"select * from campaign_bot_settings": {columns: []string{"campaign_id"}}})
	if _, err := repo.GetBot(context.Background(), 7); err != ErrResourceNotFound {
		t.Errorf("GetBot without settings: %v, want ErrResourceNotFound", err)
	}
	down := errors.New("database is down")
	repo, _ = stubRepository(t, map[string]stubReply{"select * from campaign_bot_settings": {err: down}})
	if _, err := repo.GetBot(context.Background(), 7); err != down {
		t.Errorf("GetBot with a failing database: %v, want %v", err, down)
	}
}

// jsonDocument decodes a statement argument sent as JSON bytes or text.
func jsonDocument(arg any) (any, bool) {
	var raw []byte
	switch v := arg.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	default:
		return nil, false
	}
	var doc any
	if json.Unmarshal(raw, &doc) != nil {
		return nil, false
	}
	return doc, true
}

// T-15 B4 (contratos/T-15-recursos-campana-errores.md): Create and Update of the "bot" kind store actions as
// the JSON document (object or array) they were given, not as a base64 string nor as JSON inside a string.
func TestCampaignResourceRepoBotActionsAreNotDoubleEncoded(t *testing.T) { // B4
	actions := map[string]any{
		"object": map[string]any{"roll_dice": true, "narrate": false},
		"array":  []any{"roll_dice", "narrate"},
	}
	writes := map[string]func(*CampaignResourceRepository, any) (map[string]any, error){
		"Create": func(r *CampaignResourceRepository, a any) (map[string]any, error) {
			return r.Create(context.Background(), 7, 3, "bot", map[string]any{"enabled": true, "actions": a})
		},
		"Update": func(r *CampaignResourceRepository, a any) (map[string]any, error) {
			return r.Update(context.Background(), 7, 42, 3, "bot", map[string]any{"enabled": true, "actions": a})
		},
	}
	for name, write := range writes {
		for shape, value := range actions {
			t.Run(name+" "+shape, func(t *testing.T) {
				repo, stub := stubRepository(t, map[string]stubReply{
					"select enabled, personality, actions from campaign_bot_settings where campaign_id=$1": {columns: []string{"enabled", "personality", "actions"}},
					"insert into campaign_bot_settings (campaign_id, enabled, personality, actions)":       {affected: 1},
					"select * from campaign_bot_settings where campaign_id=$1":                             {columns: []string{"campaign_id"}, rows: [][]driver.Value{{int64(7)}}},
				})
				if _, err := write(repo, value); err != nil {
					t.Fatalf("%s bot: %v", name, err)
				}
				var upsert stubStatement
				for _, s := range stub.statements() {
					if strings.HasPrefix(s.query, "insert into campaign_bot_settings") {
						upsert = s
					}
				}
				if len(upsert.args) != 4 {
					t.Fatalf("%s bot must upsert campaign, enabled, personality and actions: %v", name, stub.statements())
				}
				stored, ok := jsonDocument(upsert.args[3])
				if !ok {
					t.Fatalf("actions must be stored as JSON, got %T %v", upsert.args[3], upsert.args[3])
				}
				if text, isString := stored.(string); isString {
					t.Fatalf("actions are double encoded: stored the JSON string %q instead of the %s", text, shape)
				}
				if !reflect.DeepEqual(stored, value) {
					t.Errorf("actions stored as %v, want %v", stored, value)
				}
			})
		}
	}
}
