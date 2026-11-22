package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/foundry"
	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestSyncReferenceTransactionalRealDB runs SyncReference against a real, already
// migrated Postgres (TEST_DATABASE_DSN) with a fake Foundry relay. One monster has a
// negative AC (violates chk_srd_monsters_stats), so the whole monsters type must roll
// back while spells and classes still commit, and the error lands in foundry_sync_state.
func TestSyncReferenceTransactionalRealDB(t *testing.T) {
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
	cleanup := func() {
		for _, tbl := range []string{"srd_spells", "srd_monsters", "srd_classes"} {
			_, _ = db.Exec(`DELETE FROM ` + tbl + ` WHERE foundry_uuid LIKE 'test-ref-%'`)
		}
	}
	cleanup()
	t.Cleanup(cleanup)

	var campaignID int64
	if err := db.Get(&campaignID, `SELECT id FROM campaigns ORDER BY id LIMIT 1`); err != nil {
		t.Skip("no campaign available for foundry_sync_state")
	}

	doc := func(uuid, name, docType, sys string) map[string]any {
		return map[string]any{"uuid": uuid, "name": name, "type": docType, "system": json.RawMessage(sys)}
	}
	catalog := map[string][]map[string]any{
		"spell": {doc("test-ref-s1", "Test Spark", "spell", `{"level":1}`), doc("test-ref-s2", "Test Glow", "spell", `{"level":0}`)},
		"npc": {
			doc("test-ref-m1", "Test Imp", "npc", `{"attributes":{"ac":{"flat":12},"hp":{"max":9}}}`),
			doc("test-ref-m2", "Test Broken", "npc", `{"attributes":{"ac":{"flat":-5},"hp":{"max":9}}}`),
		},
		"class": {doc("test-ref-c1", "Test Mage", "class", `{"hitDice":"d6"}`)},
	}
	byUUID := map[string]map[string]any{}
	for _, list := range catalog {
		for _, d := range list {
			byUUID[d["uuid"].(string)] = d
		}
	}
	relay := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search":
			filter := r.URL.Query().Get("filter")
			results := []map[string]any{}
			for sub, list := range catalog {
				if strings.HasSuffix(filter, "subType:"+sub) {
					results = append(results, list...)
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"results": results})
		case "/get":
			_ = json.NewEncoder(w).Encode(byUUID[r.URL.Query().Get("uuid")])
		default:
			http.NotFound(w, r)
		}
	}))
	defer relay.Close()

	cfg := config.FoundryConfig{RelayBaseURL: relay.URL, APIKey: "k", ClientID: "c", MaxRetries: 1}
	svc := NewFoundrySyncService(cfg, foundry.New(cfg), repository.NewFoundryRepository(db), nil)

	counts, err := svc.SyncReference(ctx, campaignID)
	if err == nil || !strings.Contains(err.Error(), "monsters") {
		t.Fatalf("expected a monsters error, got %v", err)
	}
	if counts["spells"] != 2 || counts["classes"] != 1 || counts["monsters"] != 0 {
		t.Fatalf("counts=%v", counts)
	}
	var n int
	_ = db.Get(&n, `SELECT COUNT(*) FROM srd_monsters WHERE foundry_uuid LIKE 'test-ref-%'`)
	if n != 0 {
		t.Fatalf("monsters type was not rolled back: %d rows", n)
	}
	_ = db.Get(&n, `SELECT COUNT(*) FROM srd_spells WHERE foundry_uuid LIKE 'test-ref-%'`)
	if n != 2 {
		t.Fatalf("spells not committed: %d rows", n)
	}
	_ = db.Get(&n, `SELECT COUNT(*) FROM srd_classes WHERE foundry_uuid LIKE 'test-ref-%'`)
	if n != 1 {
		t.Fatalf("classes not committed: %d rows", n)
	}
	var state struct {
		Status string `db:"status"`
		Error  string `db:"error"`
	}
	if err := db.Get(&state, `SELECT status, error FROM foundry_sync_state WHERE campaign_id=$1`, campaignID); err != nil {
		t.Fatal(err)
	}
	if state.Status != "error" || !strings.Contains(state.Error, "monsters") || strings.Contains(state.Error, "spells") {
		t.Fatalf("state=%+v", state)
	}

	// Fix the bad monster: a second run succeeds and now writes both monsters.
	catalog["npc"][1] = doc("test-ref-m2", "Test Broken", "npc", `{"attributes":{"ac":{"flat":10},"hp":{"max":9}}}`)
	byUUID["test-ref-m2"] = catalog["npc"][1]
	counts, err = svc.SyncReference(ctx, campaignID)
	if err != nil || counts["monsters"] != 2 {
		t.Fatalf("second run counts=%v err=%v", counts, err)
	}
}
