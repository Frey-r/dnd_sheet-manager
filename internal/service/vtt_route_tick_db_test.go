package service

import (
	"context"
	"math"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"
)

// T-19 · contratos/T-19-ruta-ticker.md

// K1/K5: a tick stores the computed positions and does not stream vtt.token.moved.
func TestRouteTickPersistsPositionsRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	scene := f.scene(t)
	a, b := f.guardToken(t, "monster"), f.guardToken(t, "npc")
	for _, id := range []int64{a, b} {
		if err := f.play.SetRoute(ctx, scene, f.token(t, id), square); err != nil {
			t.Fatal(err)
		}
	}
	// a has walked 1 s, b is paused by the GM.
	if _, err := f.db.Exec(`UPDATE vtt_tokens SET route_started_at=NOW() - interval '1 second' WHERE id=$1`, a); err != nil {
		t.Fatal(err)
	}
	if err := f.play.PauseRoute(ctx, scene, f.token(t, b)); err != nil {
		t.Fatal(err)
	}
	paused := f.token(t, b)
	now := time.Now()
	f.play.tickRoutes(ctx, now)
	ta := f.token(t, a)
	wx, wy := RoutePosition(*square, routeRate(scene, ta), ClockElapsed(*ta, now))
	if math.Hypot(ta.X-wx, ta.Y-wy) > 1e-6 || ta.X <= 35 {
		t.Fatalf("running token at (%v,%v), want (%v,%v)", ta.X, ta.Y, wx, wy)
	}
	if tb := f.token(t, b); tb.X != paused.X || tb.Y != paused.Y {
		t.Fatalf("paused token moved to (%v,%v)", tb.X, tb.Y)
	}
	if n := f.rt.count("vtt.token.moved"); n != 0 {
		t.Fatalf("route steps must not stream vtt.token.moved, got %d", n)
	}
}

// The tick freezes routes left running in a scene that is no longer active (self-healing).
func TestRouteTickFreezesInactiveSceneRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	scene := f.scene(t)
	id := f.guardToken(t, "npc")
	if err := f.play.SetRoute(ctx, scene, f.token(t, id), square); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(`UPDATE vtt_scenes SET is_active=FALSE WHERE id=$1`, f.sceneID); err != nil {
		t.Fatal(err)
	}
	f.play.tickRoutes(ctx, time.Now())
	if f.token(t, id).RouteStartedAt != nil {
		t.Fatal("a route in an inactive scene must be frozen by the tick")
	}
}

// K3: a moving hostile detector that sees a still player starts the encounter and stops; a neutral one does not.
func TestRouteTickHostileDetectionRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	scene := f.scene(t)
	// The player stands at (700,800); the patrol walks a line next to it.
	line := &domain.Route{Mode: "pingpong", Points: []domain.RoutePoint{{X: 600, Y: 700}, {X: 800, Y: 700}}}
	guard := f.guardToken(t, "npc") // linked to a neutral NPC
	if _, err := f.db.Exec(`UPDATE vtt_tokens SET detects=TRUE WHERE id=$1`, guard); err != nil {
		t.Fatal(err)
	}
	if err := f.play.SetRoute(ctx, scene, f.token(t, guard), line); err != nil {
		t.Fatal(err)
	}
	f.play.tickRoutes(ctx, time.Now())
	if combats, _ := f.repo.ActiveCombats(ctx, f.sceneID); len(combats) != 0 {
		t.Fatal("a neutral patrol must not start an encounter")
	}
	if _, err := f.db.Exec(`UPDATE campaign_npcs SET status='enemy' WHERE id=$1`, f.guardNPC); err != nil {
		t.Fatal(err)
	}
	f.play.tickRoutes(ctx, time.Now())
	combats, _ := f.repo.ActiveCombats(ctx, f.sceneID)
	if len(combats) != 1 {
		t.Fatalf("an enemy patrol that sees the player must start one encounter, got %d", len(combats))
	}
	if f.token(t, guard).RouteStartedAt != nil {
		t.Fatal("the patrol in combat must stop walking")
	}
	if inCombat, _ := f.repo.TokenInCombat(ctx, f.pc); inCombat == 0 {
		t.Fatal("the player must be in the encounter")
	}
}

// K4: when the player moves, only hostile detectors start encounters.
func TestMoveDetectionIgnoresFriendlyRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	scene := f.scene(t)
	var friend int64
	if err := f.db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,detects,disposition,x,y) VALUES($1,$2,'Posadero','monster',TRUE,'friendly',700,700) RETURNING id`,
		f.sceneID, f.campaignID).Scan(&friend); err != nil {
		t.Fatal(err)
	}
	mover := f.token(t, f.pc)
	f.play.checkTriggers(ctx, scene, mover, &trackedPos{x: mover.X, y: mover.Y, sceneID: scene.ID, seenBy: map[int64]bool{}})
	if combats, _ := f.repo.ActiveCombats(ctx, f.sceneID); len(combats) != 0 {
		t.Fatal("a friendly detector must not start an encounter")
	}
	if _, err := f.db.Exec(`UPDATE vtt_tokens SET disposition='hostile' WHERE id=$1`, friend); err != nil {
		t.Fatal(err)
	}
	f.play.checkTriggers(ctx, scene, mover, &trackedPos{x: mover.X, y: mover.Y, sceneID: scene.ID, seenBy: map[int64]bool{}})
	if combats, _ := f.repo.ActiveCombats(ctx, f.sceneID); len(combats) != 1 {
		t.Fatal("a hostile detector that sees the player must start the encounter")
	}
}
