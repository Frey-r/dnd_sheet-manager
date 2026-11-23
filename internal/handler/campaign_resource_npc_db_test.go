package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"testing"
	"time"

	"dnd-campaign-manager/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestNPCAppearanceRoundTripRealDB runs against a migrated Postgres (TEST_DATABASE_DSN), like
// repository/trade_items_db_test.go: T-13 N1–N4 through the real routes, repository and schema
// (contratos/T-13-npc-datos.md, D-0041).
func TestNPCAppearanceRoundTripRealDB(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set")
	}
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	tag := fmt.Sprintf("npc%d", time.Now().UnixNano())
	mustID := func(query string, args ...any) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRowxContext(ctx, query, args...).Scan(&id); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		return id
	}
	gm := mustID(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag, tag+"@test.local")
	campaign := mustID(`INSERT INTO campaigns(name,gm_user_id,join_code) VALUES($1,$2,$3) RETURNING id`, tag, gm, tag[len(tag)-8:])
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM campaigns WHERE id=$1`, campaign)
		_, _ = db.Exec(`DELETE FROM users WHERE id=$1`, gm)
	})
	// An NPC created before T-13: only the columns that existed then.
	legacy := mustID(`INSERT INTO campaign_npcs(campaign_id,name,role) VALUES($1,'Viejo Marlo','Barquero') RETURNING id`, campaign)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := r.Group("/api", func(c *gin.Context) {
		c.Set("user_id", gm)
		c.Set("is_gm", true)
	})
	NewCampaignResourceHandler(repository.NewCampaignResourceRepository(db)).RegisterRoutes(auth)
	base := fmt.Sprintf("/api/campaigns/%d/npcs", campaign)
	object := func(t *testing.T, raw string) map[string]any {
		t.Helper()
		var out map[string]any
		if err := json.Unmarshal([]byte(raw), &out); err != nil {
			t.Fatalf("response is not a JSON object: %v (%s)", err, raw)
		}
		return out
	}
	count := func() int {
		var n int
		if err := db.Get(&n, `SELECT count(*) FROM campaign_npcs WHERE campaign_id=$1`, campaign); err != nil {
			t.Fatal(err)
		}
		return n
	}
	idOf := func(t *testing.T, m map[string]any) int64 {
		t.Helper()
		f, ok := m["id"].(float64)
		if !ok {
			t.Fatalf("response without a numeric id: %v", m)
		}
		return int64(f)
	}
	appearanceIsNull := func(id int64) bool {
		var isNull bool
		if err := db.Get(&isNull, `SELECT appearance IS NULL FROM campaign_npcs WHERE id=$1`, id); err != nil {
			t.Fatal(err)
		}
		return isNull
	}

	// N1: create with race, class and a valid appearance → stored and returned.
	w := send(r, http.MethodPost, base, `{"name":"Pip","race":"Halfling (Player's Handbook)","class":"Warrior Sidekick","status":"ally","stats":{"hp":9,"ac":13},"appearance":`+npcValidAppearance+`}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("N1 create: status %d (%s)", w.Code, w.Body)
	}
	pip := object(t, w.Body.String())
	if pip["race"] != "Halfling (Player's Handbook)" || pip["class"] != "Warrior Sidekick" {
		t.Errorf("N1 create must return race and class: %v", pip)
	}
	if !reflect.DeepEqual(pip["appearance"], decodeJSON(t, npcValidAppearance)) {
		t.Errorf("N1 create must return the appearance as an object: %#v", pip["appearance"])
	}
	id := idOf(t, pip)

	// N2: an invalid appearance → 400 and nothing stored or changed.
	before := count()
	if w := send(r, http.MethodPost, base, `{"name":"Malo","appearance":{"v":1,"hair":12}}`); w.Code != http.StatusBadRequest {
		t.Errorf("N2 create: status %d, want 400", w.Code)
	}
	if w := send(r, http.MethodPut, fmt.Sprintf("%s/%d", base, id), `{"race":"Gnome","appearance":{"v":1,"wings":true}}`); w.Code != http.StatusBadRequest {
		t.Errorf("N2 update: status %d, want 400", w.Code)
	}
	if count() != before {
		t.Errorf("N2: an invalid appearance must not create an NPC")
	}
	var race string
	if err := db.Get(&race, `SELECT race FROM campaign_npcs WHERE id=$1`, id); err != nil || race != "Halfling (Player's Handbook)" {
		t.Errorf("N2: a rejected update must not change the NPC (race %q, %v)", race, err)
	}

	// N3: update race, class and appearance; appearance null clears it (SQL NULL).
	w = send(r, http.MethodPut, fmt.Sprintf("%s/%d", base, id), `{"race":"Gnome","class":"Expert Sidekick","appearance":`+npcOtherAppearance+`}`)
	if w.Code != http.StatusOK {
		t.Fatalf("N3 update: status %d (%s)", w.Code, w.Body)
	}
	updated := object(t, w.Body.String())
	if updated["race"] != "Gnome" || updated["class"] != "Expert Sidekick" || !reflect.DeepEqual(updated["appearance"], decodeJSON(t, npcOtherAppearance)) {
		t.Errorf("N3 update must return the new race, class and appearance: %v", updated)
	}
	w = send(r, http.MethodPut, fmt.Sprintf("%s/%d", base, id), `{"appearance":null}`)
	if w.Code != http.StatusOK {
		t.Fatalf("N3 clear: status %d (%s)", w.Code, w.Body)
	}
	cleared := object(t, w.Body.String())
	if v, ok := cleared["appearance"]; !ok || v != nil {
		t.Errorf("N3 clear must return appearance: null, got %#v", cleared["appearance"])
	}
	if cleared["race"] != "Gnome" || cleared["class"] != "Expert Sidekick" {
		t.Errorf("N3 clear must keep race and class: %v", cleared)
	}
	if !appearanceIsNull(id) {
		t.Errorf("N3 clear must store SQL NULL, not the JSON value null")
	}

	// N4: legacy NPCs list with race "", class "" and appearance null; creating without them works.
	w = send(r, http.MethodGet, base, "")
	if w.Code != http.StatusOK {
		t.Fatalf("N4 list: status %d (%s)", w.Code, w.Body)
	}
	var list []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("N4 list is not an array: %v", err)
	}
	found := false
	for _, npc := range list {
		if npc["id"] != float64(legacy) {
			continue
		}
		found = true
		if v, ok := npc["appearance"]; npc["race"] != "" || npc["class"] != "" || !ok || v != nil {
			t.Errorf(`N4 legacy NPC must list race "", class "" and appearance null: %v`, npc)
		}
	}
	if !found {
		t.Errorf("N4: the legacy NPC is missing from the list")
	}
	w = send(r, http.MethodPost, base, `{"name":"Sin rasgos"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("N4 create without the new fields: status %d (%s)", w.Code, w.Body)
	}
	plain := object(t, w.Body.String())
	if v, ok := plain["appearance"]; plain["race"] != "" || plain["class"] != "" || !ok || v != nil {
		t.Errorf(`N4 create without the new fields must return race "", class "" and appearance null: %v`, plain)
	}
	if !appearanceIsNull(idOf(t, plain)) {
		t.Errorf("N4: an absent appearance must be stored as SQL NULL")
	}
}
