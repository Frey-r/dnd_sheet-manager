package service

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestUpsertLoreKeepsTierAndFlagsChangesRealDB checks the journal mirror against a real,
// migrated Postgres (TEST_DATABASE_DSN): a re-sync keeps the tier the GM set in the app, and
// only new or changed text asks for a (re-)embedding (foundry-integration.md).
func TestUpsertLoreKeepsTierAndFlagsChangesRealDB(t *testing.T) {
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
	tag := fmt.Sprintf("lore%d", time.Now().UnixNano())
	var userID, campaignID int64
	if err := db.QueryRowx(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag[:20], tag+"@test.local").Scan(&userID); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id=$1`, userID) }()
	if err := db.QueryRowx(`INSERT INTO campaigns(name,join_code,gm_user_id) VALUES($1,$2,$3) RETURNING id`, tag, tag[len(tag)-12:], userID).Scan(&campaignID); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(`DELETE FROM campaigns WHERE id=$1`, campaignID) }()

	repo := repository.NewFoundryRepository(db)
	uuid := "test-lore-" + tag
	upsert := func(text string) (int64, bool) {
		t.Helper()
		id, needs, err := repo.UpsertLore(ctx, &domain.LoreEntry{CampaignID: campaignID, ContentText: text, LoreTier: domain.LoreTierCampaignPlot, Title: "Crónica", FoundryUUID: &uuid})
		if err != nil {
			t.Fatal(err)
		}
		return id, needs
	}

	id, needs := upsert("El rey ha muerto.")
	if !needs {
		t.Fatal("a new entry must be embedded")
	}
	if _, err := db.Exec(`UPDATE lore_entries SET lore_tier='gm_hidden_lore' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if _, needs = upsert("El rey ha muerto."); needs {
		t.Fatal("unchanged text must not be re-embedded")
	}
	if _, needs = upsert("El rey vive en secreto."); !needs {
		t.Fatal("changed text must be re-embedded")
	}
	var tier string
	if err := db.Get(&tier, `SELECT lore_tier FROM lore_entries WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if tier != "gm_hidden_lore" {
		t.Fatalf("re-sync overwrote the GM's tier: %q", tier)
	}
}
