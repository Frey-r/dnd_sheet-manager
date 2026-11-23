package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestLoreScopesRealDB checks security.md / user-stories.md lore isolation against a real,
// migrated Postgres (TEST_DATABASE_DSN): a player never reads another player's character
// lore nor GM-hidden lore, and only the GM may search every tier at once.
func TestLoreScopesRealDB(t *testing.T) {
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
	tag := fmt.Sprintf("lorescope%d", time.Now().UnixNano())

	var gm, alice, bob, campaignID, aliceChar, bobChar int64
	mustGet := func(dest *int64, q string, args ...any) {
		t.Helper()
		if err := db.Get(dest, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	for _, u := range []struct {
		dest *int64
		name string
	}{{&gm, "gm"}, {&alice, "alice"}, {&bob, "bob"}} {
		mustGet(u.dest, `INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag+u.name, tag+u.name+"@test.local")
	}
	mustGet(&campaignID, `INSERT INTO campaigns(name,join_code,gm_user_id) VALUES($1,$2,$3) RETURNING id`, tag, tag[len(tag)-12:], gm)
	mustGet(&aliceChar, `INSERT INTO characters(user_id,campaign_id,name) VALUES($1,$2,'Alicia') RETURNING id`, alice, campaignID)
	mustGet(&bobChar, `INSERT INTO characters(user_id,campaign_id,name) VALUES($1,$2,'Roberto') RETURNING id`, bob, campaignID)
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM lore_entries WHERE campaign_id=$1`, campaignID)
		_, _ = db.Exec(`DELETE FROM characters WHERE campaign_id=$1`, campaignID)
		_, _ = db.Exec(`DELETE FROM campaigns WHERE id=$1`, campaignID)
		_, _ = db.Exec(`DELETE FROM users WHERE id IN ($1,$2,$3)`, gm, alice, bob)
	})

	lore := repository.NewLoreRepository(db)
	add := func(char *int64, tier domain.LoreTier, title string) {
		t.Helper()
		if err := lore.Create(ctx, &domain.LoreEntry{CampaignID: campaignID, CharacterID: char, LoreTier: tier, Title: title, ContentText: "El dragón custodia la torre " + title}); err != nil {
			t.Fatal(err)
		}
	}
	add(&aliceChar, domain.LoreTierCharacter, "Pasado de Alicia")
	add(&bobChar, domain.LoreTierCharacter, "Pasado de Roberto")
	add(&aliceChar, domain.LoreTierGMHidden, "Secreto de Alicia")
	add(nil, domain.LoreTierCampaignPlot, "Trama del dragón")

	rag := NewRAGService(config.OllamaConfig{BaseURL: "http://127.0.0.1:1", Timeout: 1}, lore, repository.NewCharacterRepository(db))
	query := func(char *int64, user int64, isGM bool, tier domain.LoreTier) (string, error) {
		answer, sources, err := rag.Query(ctx, campaignID, char, user, isGM, tier, "dragón torre")
		titles := make([]string, len(sources))
		for i, source := range sources {
			titles[i] = source.Title + "/" + string(source.Tier)
		}
		return answer + "|" + strings.Join(titles, ","), err
	}

	// Player without character_id: only their own character lore.
	got, err := query(nil, alice, false, domain.LoreTierCharacter)
	if err != nil || !strings.Contains(got, "Pasado de Alicia") || strings.Contains(got, "Roberto") || strings.Contains(got, "Secreto") {
		t.Fatalf("player character_lore search leaked or failed: %q err=%v", got, err)
	}
	// Player naming their own character: no GM-hidden entries.
	got, err = query(&aliceChar, alice, false, domain.LoreTierCharacter)
	if err != nil || strings.Contains(got, "Secreto") {
		t.Fatalf("player got hidden lore: %q err=%v", got, err)
	}
	// Player naming someone else's character: forbidden.
	if _, err = query(&bobChar, alice, false, domain.LoreTierCharacter); err != ErrForbidden {
		t.Fatalf("want ErrForbidden for other's character, got %v", err)
	}
	// Unknown character: not found.
	missing := int64(-1)
	if _, err = query(&missing, alice, false, domain.LoreTierCharacter); err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
	// "all" scope is GM-only and spans every tier.
	if _, err = query(nil, alice, false, domain.LoreScopeAll); err != ErrForbidden {
		t.Fatalf("player all-scope: want ErrForbidden, got %v", err)
	}
	got, err = query(nil, gm, true, domain.LoreScopeAll)
	if err != nil || !strings.Contains(got, "Secreto") || !strings.Contains(got, "Trama") || !strings.Contains(got, "Roberto") {
		t.Fatalf("GM all-scope missing tiers: %q err=%v", got, err)
	}

	// Listing: players never see GM-hidden lore, even on their own character.
	visible, err := lore.ListVisible(ctx, campaignID, alice, false)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range visible {
		if e.LoreTier == domain.LoreTierGMHidden || e.Title == "Pasado de Roberto" {
			t.Fatalf("player list leaked %q", e.Title)
		}
	}
	if len(visible) != 2 {
		t.Fatalf("player should see own lore + plot, got %d", len(visible))
	}
}
