package service

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestVTTSheetSpeedAndHiddenCombatantsRealDB runs against a real, already migrated Postgres
// (TEST_DATABASE_DSN). It checks that a character token is paced by the sheet's current speed,
// not the copy taken when the token was placed (vtt-modes.md), and that combatants carry the
// token's hidden flag so players get them masked (vtt.md).
func TestVTTSheetSpeedAndHiddenCombatantsRealDB(t *testing.T) {
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
	tag := fmt.Sprintf("vttspeed%d", time.Now().UnixNano())

	var userID, campaignID, charID, sceneID, pcToken, hiddenToken, combatID int64
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(db.QueryRowx(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag[:20], tag+"@test.local").Scan(&userID))
	defer func() { _, _ = db.Exec(`DELETE FROM users WHERE id=$1`, userID) }()
	must(db.QueryRowx(`INSERT INTO campaigns(name,join_code,gm_user_id) VALUES($1,$2,$3) RETURNING id`, tag, tag[len(tag)-12:], userID).Scan(&campaignID))
	defer func() { _, _ = db.Exec(`DELETE FROM campaigns WHERE id=$1`, campaignID) }()
	must(db.QueryRowx(`INSERT INTO characters(user_id,campaign_id,name,race,class,speed) VALUES($1,$2,'Thorin','Dwarf','Fighter',25) RETURNING id`, userID, campaignID).Scan(&charID))
	must(db.QueryRowx(`INSERT INTO vtt_scenes(campaign_id,name) VALUES($1,'Cripta') RETURNING id`, campaignID).Scan(&sceneID))
	must(db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,character_id,speed_ft) VALUES($1,$2,'Thorin','pc',$3,30) RETURNING id`, sceneID, campaignID, charID).Scan(&pcToken))
	must(db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,hidden,speed_ft) VALUES($1,$2,'Acechador',TRUE,40) RETURNING id`, sceneID, campaignID).Scan(&hiddenToken))

	repo := repository.NewVTTRepository(db)
	play := NewVTTPlay(repo, nil)

	tok, err := repo.TokenByID(ctx, pcToken)
	must(err)
	if got := play.TokenSpeed(ctx, tok); got != 25 {
		t.Fatalf("character token speed = %d, want the sheet's 25", got)
	}
	monster, err := repo.TokenByID(ctx, hiddenToken)
	must(err)
	if got := play.TokenSpeed(ctx, monster); got != 40 {
		t.Fatalf("token without character speed = %d, want its own 40", got)
	}

	must(db.QueryRowx(`INSERT INTO vtt_combats(scene_id,campaign_id) VALUES($1,$2) RETURNING id`, sceneID, campaignID).Scan(&combatID))
	_, err = db.Exec(`INSERT INTO vtt_combatants(combat_id,token_id,initiative,is_player) VALUES($1,$2,15,TRUE),($1,$3,10,FALSE)`, combatID, pcToken, hiddenToken)
	must(err)
	combat, err := repo.Combat(ctx, campaignID, combatID)
	must(err)
	if len(combat.Combatants) != 2 || combat.Combatants[0].Hidden || !combat.Combatants[1].Hidden {
		t.Fatalf("hidden flags not loaded: %+v", combat.Combatants)
	}

	var objectID int64
	must(db.QueryRowx(`INSERT INTO vtt_objects(scene_id,campaign_id,name,depleted) VALUES($1,$2,'Cofre',TRUE) RETURNING id`, sceneID, campaignID).Scan(&objectID))
	gotScene, err := repo.ResetObject(ctx, campaignID, objectID)
	must(err)
	if gotScene != sceneID {
		t.Fatalf("ResetObject scene id = %d, want %d", gotScene, sceneID)
	}
	if _, err := repo.ResetObject(ctx, campaignID+1000000, objectID); err == nil {
		t.Fatal("resetting another campaign's object must fail")
	}
}
