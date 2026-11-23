package handler

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

// T-15 (contratos/T-15-recursos-campana-errores.md, origin E-0019): how the campaign resource routes answer
// database failures (B1), who may read the bot settings (B2) and what a PUT /bot without actions keeps (B3).
// They reuse the scripted database/sql driver of campaign_resource_extra_test.go; B4 is in
// internal/repository/campaign_resource_repo_test.go.

// errLeakyDB looks like what lib/pq returns: it names tables and hosts that must never reach the client.
var errLeakyDB = errors.New(`pq: relation "campaign_secrets" does not exist at db.internal:5432`)

var leakFragments = []string{"pq:", "campaign_secrets", "db.internal", "does not exist"}

// wantInternalError checks B1: a database failure answers 500 with a generic {"error":"…"} that does not
// contain the database error (none of the leaked fragments appears in the body).
func wantInternalError(t *testing.T, w *httptest.ResponseRecorder, leaked ...string) {
	t.Helper()
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("a database failure must answer 500, got status %d (%s)", w.Code, w.Body)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("a 500 must be a JSON object: %v (%s)", err, w.Body)
	}
	message, ok := body["error"].(string)
	if len(body) != 1 || !ok || strings.TrimSpace(message) == "" {
		t.Errorf(`a 500 must be only a generic {"error":"…"}, got %s`, w.Body)
	}
	for _, fragment := range leaked {
		if strings.Contains(w.Body.String(), fragment) {
			t.Errorf("a 500 must not reveal the database error (%q): %s", fragment, w.Body)
		}
	}
}

// B1: every route that answers through respond turns a database error into a generic 500.
func TestCampaignResourceDatabaseErrorIsInternal(t *testing.T) { // B1
	down := sqlReply{err: errLeakyDB}
	empty := sqlReply{columns: []string{"enabled", "personality", "actions"}}
	cases := []struct {
		name, method, path, body string
		rules                    []sqlRule
	}{
		{"list", http.MethodGet, resourcePath("maps"), "", []sqlRule{{"select", down}}},
		{"get", http.MethodGet, resourcePath("maps", resID), "", []sqlRule{{"select", down}}},
		{"update", http.MethodPut, resourcePath("maps", resID), `{"name":"Puerto"}`, []sqlRule{{"update campaign_maps", down}}},
		{"update read back", http.MethodPut, resourcePath("maps", resID), `{"name":"Puerto"}`,
			[]sqlRule{{"update campaign_maps", sqlReply{affected: 1}}, {"select", down}}},
		{"delete", http.MethodDelete, resourcePath("notes", resID), "", []sqlRule{{"delete from campaign_notes", down}}},
		{"bot read", http.MethodGet, resourcePath("bot"), "", []sqlRule{{botRead, down}}},
		{"bot save reading the current settings", http.MethodPut, resourcePath("bot"), `{"enabled":true}`, []sqlRule{{botCurrent, down}}},
		{"bot save upsert", http.MethodPut, resourcePath("bot"), `{"enabled":true}`,
			[]sqlRule{{botCurrent, empty}, {"insert into campaign_bot_settings", down}}},
		{"bot save read back", http.MethodPut, resourcePath("bot"), `{"enabled":true}`,
			[]sqlRule{{botCurrent, empty}, {"insert into campaign_bot_settings", sqlReply{affected: 1}}, {botRead, down}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, _ := resourceRouter(t, true, tc.rules...)
			wantInternalError(t, request(r, tc.method, tc.path, tc.body), leakFragments...)
		})
	}
}

// B1: validation errors, including the ones the repository detects, stay 400 with their message.
func TestCampaignResourceValidationErrorsStayBadRequest(t *testing.T) { // B1
	huge := strings.Repeat("a", 1_000_001)
	t.Run("update without a known field", func(t *testing.T) {
		r, db := resourceRouter(t, true)
		w := request(r, http.MethodPut, resourcePath("npcs", resID), `{"secret":"x","campaign_id":8}`)
		wantResponse(t, w, http.StatusBadRequest, `{"error":"no valid fields to update"}`)
		if got := db.calls(); len(got) != 0 {
			t.Errorf("an invalid update must not reach the database: %v", got)
		}
	})
	t.Run("update with an oversized text", func(t *testing.T) {
		r, db := resourceRouter(t, true)
		w := request(r, http.MethodPut, resourcePath("notes", resID), `{"content":`+strconv.Quote(huge)+`}`)
		if w.Code != http.StatusBadRequest {
			t.Errorf("an oversized text is a validation error: status %d, want 400", w.Code)
		}
		if got := db.calls(); len(got) != 0 {
			t.Errorf("an oversized text must not reach the database: %d statements", len(got))
		}
	})
	t.Run("bot save with an oversized personality", func(t *testing.T) {
		r, db := resourceRouter(t, true, sqlRule{botCurrent, sqlReply{columns: []string{"enabled", "personality", "actions"}}})
		w := request(r, http.MethodPut, resourcePath("bot"), `{"personality":`+strconv.Quote(huge)+`}`)
		wantResponse(t, w, http.StatusBadRequest, `{"error":"field personality is too long"}`)
		db.none(t, "insert")
	})
}

// B1: "not found" stays 404.
func TestCampaignResourceNotFoundStaysNotFound(t *testing.T) { // B1
	r, _ := resourceRouter(t, true, sqlRule{"select * from campaign_events", sqlReply{columns: []string{"id"}}})
	wantResponse(t, request(r, http.MethodGet, resourcePath("events", resID), ""), http.StatusNotFound, `{"error":"not found"}`)

	r, _ = resourceRouter(t, true, sqlRule{"update campaign_maps", sqlReply{affected: 0}})
	wantResponse(t, request(r, http.MethodPut, resourcePath("maps", resID), `{"name":"Puerto"}`), http.StatusNotFound, `{"error":"not found"}`)

	r, _ = resourceRouter(t, true, sqlRule{"delete from campaign_notes", sqlReply{affected: 0}})
	wantResponse(t, request(r, http.MethodDelete, resourcePath("notes", resID), ""), http.StatusNotFound, `{"error":"not found"}`)
}

// B2: the bot settings (personality and enabled actions) are GM preparation material like the other resources.
func TestCampaignBotReadRequiresGM(t *testing.T) { // B2
	t.Run("player", func(t *testing.T) {
		r, db := resourceRouter(t, false, sqlRule{botRead, botStored})
		w := request(r, http.MethodGet, resourcePath("bot"), "")
		wantResponse(t, w, http.StatusForbidden, `{"error":"gm membership required"}`)
		if got := db.calls(); len(got) != 0 {
			t.Errorf("a player must not reach the database: %v", got)
		}
	})
	t.Run("gm", func(t *testing.T) {
		r, db := resourceRouter(t, true, sqlRule{botRead, botStored})
		wantResponse(t, request(r, http.MethodGet, resourcePath("bot"), ""), http.StatusOK, botStoredJSON)
		wantArgs(t, db.call(t, botRead), resCampaign)
	})
}

// B3: a PUT /bot without "actions" keeps the stored actions, as it already keeps enabled and personality,
// with the same three statements (read the current settings, upsert, read back).
func TestCampaignBotSaveWithoutActionsKeepsThem(t *testing.T) { // B3
	const storedActions = `{"roll_dice":true,"narrate":false}`
	current := sqlReply{
		columns: []string{"enabled", "personality", "actions"},
		rows:    [][]driver.Value{{true, "Viejo", []byte(storedActions)}},
	}
	for _, body := range []string{`{"personality":"Amable"}`, `{"enabled":false}`, `{"enabled":true,"personality":"Amable"}`} {
		t.Run(body, func(t *testing.T) {
			r, db := resourceRouter(t, true,
				sqlRule{botCurrent, current},
				sqlRule{"insert into campaign_bot_settings", sqlReply{affected: 1}},
				sqlRule{botRead, botStored},
			)
			wantResponse(t, request(r, http.MethodPut, resourcePath("bot"), body), http.StatusOK, botStoredJSON)
			upsert := db.call(t, "insert into campaign_bot_settings")
			if len(upsert.args) != 4 || !jsonValue(upsert.args[3], storedActions) {
				t.Errorf("a save without actions must keep the stored actions %s, upsert args %v", storedActions, upsert.args)
			}
			if got := db.calls(); len(got) != 3 {
				t.Errorf("keeping the actions must not add statements: want 3, got %d: %v", len(got), got)
			}
		})
	}
	t.Run("first save without actions starts empty", func(t *testing.T) {
		r, db := resourceRouter(t, true,
			sqlRule{botCurrent, sqlReply{columns: []string{"enabled", "personality", "actions"}}},
			sqlRule{"insert into campaign_bot_settings", sqlReply{affected: 1}},
			sqlRule{botRead, botStored},
		)
		wantResponse(t, request(r, http.MethodPut, resourcePath("bot"), `{"enabled":true}`), http.StatusOK, botStoredJSON)
		upsert := db.call(t, "insert into campaign_bot_settings")
		if len(upsert.args) != 4 || !jsonValue(upsert.args[3], `{}`) {
			t.Errorf("a first save without actions must store {}, upsert args %v", upsert.args)
		}
	})
	t.Run("sent actions replace the stored ones", func(t *testing.T) {
		r, db := resourceRouter(t, true,
			sqlRule{botCurrent, current},
			sqlRule{"insert into campaign_bot_settings", sqlReply{affected: 1}},
			sqlRule{botRead, botStored},
		)
		wantResponse(t, request(r, http.MethodPut, resourcePath("bot"), `{"actions":{"narrate":true}}`), http.StatusOK, botStoredJSON)
		upsert := db.call(t, "insert into campaign_bot_settings")
		if len(upsert.args) != 4 || !jsonValue(upsert.args[3], `{"narrate":true}`) {
			t.Errorf("sent actions must replace the stored ones, upsert args %v", upsert.args)
		}
	})
}
