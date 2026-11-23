package handler

import (
	"bytes"
	"database/sql/driver"
	"log"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// T-16 (contratos/T-16-create-errores.md, origin E-0022): POST /campaigns/:id/<kind> answers its errors through
// the same single point as respond (404, 400 with the ResourceInputError message, generic 500 with a log line)
// and keeps its 201. They reuse the scripted driver of campaign_resource_extra_test.go and wantInternalError,
// errLeakyDB and leakFragments of campaign_resource_errors_test.go. E4 is the whole package suite
// (go test ./internal/handler/), including the tests of T-13 and T-15.

// captureLog sends the standard logger to a buffer until the test ends, then restores the previous writer.
// The tests that use it are not parallel, so nothing else writes to the buffer meanwhile.
func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(previous) })
	return &buf
}

// E1: a text over the repository limit is input the client can fix: 400 with the ResourceInputError message,
// and no statement reaches the database.
func TestCampaignResourceCreateOversizedTextIsBadRequest(t *testing.T) { // E1
	huge := strconv.Quote(strings.Repeat("a", 1_000_001))
	cases := []struct {
		kind, field, body string
	}{
		{"npcs", "description", `{"name":"Mira","description":` + huge + `}`},
		{"maps", "location", `{"name":"Puerto","location":` + huge + `}`},
		{"events", "description", `{"title":"Boda","event_date":"2026-05-01","description":` + huge + `}`},
		{"notes", "content", `{"title":"Plan","content":` + huge + `}`},
	}
	for _, tc := range cases {
		t.Run(tc.kind, func(t *testing.T) {
			r, db := resourceRouter(t, true)
			w := request(r, http.MethodPost, resourcePath(tc.kind), tc.body)
			wantResponse(t, w, http.StatusBadRequest, `{"error":"field `+tc.field+` is too long"}`)
			if got := db.calls(); len(got) != 0 {
				t.Errorf("an oversized text must not reach the database: %d statements", len(got))
			}
		})
	}
}

// E2: a database failure while creating is internal: generic 500 {"error":"internal error"} without the database
// text, the error is logged with the method and the route, and a failed INSERT does not read anything back.
func TestCampaignResourceCreateDatabaseErrorIsInternal(t *testing.T) { // E2
	for _, f := range resourceFixtures {
		inserted := sqlReply{columns: []string{"id"}, rows: [][]driver.Value{{resID}}}
		cases := []struct {
			name       string
			rules      []sqlRule
			statements int
		}{
			{"insert", []sqlRule{{"insert into " + f.table, sqlReply{err: errLeakyDB}}}, 1},
			{"read back", []sqlRule{{"insert into " + f.table, inserted}, {f.selectOne(), sqlReply{err: errLeakyDB}}}, 2},
		}
		for _, tc := range cases {
			t.Run(f.kind+"/"+tc.name, func(t *testing.T) {
				logged := captureLog(t)
				r, db := resourceRouter(t, true, tc.rules...)
				w := request(r, http.MethodPost, resourcePath(f.kind), f.createBody)

				wantInternalError(t, w, leakFragments...)
				if !sameJSON(w.Body.Bytes(), []byte(`{"error":"internal error"}`)) {
					t.Errorf(`a database failure while creating must answer {"error":"internal error"}, got %s`, w.Body)
				}
				line := logged.String()
				if !strings.Contains(line, errLeakyDB.Error()) {
					t.Errorf("the database error must reach the server log, got %q", line)
				}
				if !strings.Contains(line, http.MethodPost) ||
					!(strings.Contains(line, "/campaigns/:id/"+f.kind) || strings.Contains(line, resourcePath(f.kind))) {
					t.Errorf("the log line must name the method and the route of %s, got %q", resourcePath(f.kind), line)
				}
				if got := db.calls(); len(got) != tc.statements {
					t.Errorf("want %d statements, got %d: %v", tc.statements, len(got), got)
				}
				if tc.name == "insert" {
					db.none(t, "select")
				}
			})
		}
	}
}

// E3: a valid resource still answers 201 with the created row.
func TestCampaignResourceCreateSuccessIsCreated(t *testing.T) { // E3
	for _, f := range resourceFixtures {
		t.Run(f.kind, func(t *testing.T) {
			logged := captureLog(t)
			r, _ := resourceRouter(t, true,
				sqlRule{"insert into " + f.table, sqlReply{columns: []string{"id"}, rows: [][]driver.Value{{resID}}}},
				sqlRule{f.selectOne(), f.rowReply()},
			)
			wantResponse(t, request(r, http.MethodPost, resourcePath(f.kind), f.createBody), http.StatusCreated, f.response)
			if logged.Len() != 0 {
				t.Errorf("a successful create must not log an error, got %q", logged)
			}
		})
	}
}
