package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"sync"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// recordingRT keeps every realtime event so the tests can check what reached the clients.
type recordingRT struct {
	mu     sync.Mutex
	events []string
}

func (r *recordingRT) add(e string) { r.mu.Lock(); r.events = append(r.events, e); r.mu.Unlock() }
func (r *recordingRT) Publish(_ context.Context, _, _ int64, e string, _ any) error {
	r.add(e)
	return nil
}
func (r *recordingRT) Broadcast(_ context.Context, _ int64, e string, _ any) error {
	r.add(e)
	return nil
}
func (r *recordingRT) BroadcastTo(_ context.Context, _ int64, _ []int64, e string, _ any) error {
	r.add(e)
	return nil
}
func (r *recordingRT) count(e string) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for _, x := range r.events {
		if x == e {
			n++
		}
	}
	return n
}

type routeFixture struct {
	db                   *sqlx.DB
	repo                 *repository.VTTRepository
	rt                   *recordingRT
	play                 *VTTPlay
	campaignID, sceneID  int64
	userID, guardNPC, pc int64
	otherCampaign, alien int64
}

func newRouteFixture(t *testing.T) *routeFixture {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set")
	}
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	f := &routeFixture{db: db, repo: repository.NewVTTRepository(db), rt: &recordingRT{}}
	f.play = NewVTTPlay(f.repo, f.rt)
	tag := fmt.Sprintf("route%d", time.Now().UnixNano())
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(db.QueryRowx(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag[:20], tag+"@test.local").Scan(&f.userID))
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM users WHERE id=$1`, f.userID) })
	must(db.QueryRowx(`INSERT INTO campaigns(name,join_code,gm_user_id) VALUES($1,$2,$3) RETURNING id`, tag, tag[len(tag)-12:], f.userID).Scan(&f.campaignID))
	must(db.QueryRowx(`INSERT INTO campaigns(name,join_code,gm_user_id) VALUES($1,$2,$3) RETURNING id`, tag+"b", "b"+tag[len(tag)-11:], f.userID).Scan(&f.otherCampaign))
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM campaigns WHERE id IN ($1,$2)`, f.campaignID, f.otherCampaign) })
	// 70 px cells of 5 ft at pace ×2: a 30 ft token walks 140 px/s.
	must(db.QueryRowx(`INSERT INTO vtt_scenes(campaign_id,name,width_px,height_px,is_active,mode) VALUES($1,'Muralla',1400,1000,TRUE,'exploration') RETURNING id`, f.campaignID).Scan(&f.sceneID))
	must(db.QueryRowx(`INSERT INTO campaign_npcs(campaign_id,name,status,image_url,appearance) VALUES($1,'Guardia Brom','neutral','/img/brom.png','{"body":1}') RETURNING id`, f.campaignID).Scan(&f.guardNPC))
	must(db.QueryRowx(`INSERT INTO campaign_npcs(campaign_id,name) VALUES($1,'Ajeno') RETURNING id`, f.otherCampaign).Scan(&f.alien))
	must(db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,owner_user_id,x,y,disposition) VALUES($1,$2,'Lyra','pc',$3,700,800,'friendly') RETURNING id`, f.sceneID, f.campaignID, f.userID).Scan(&f.pc))
	return f
}

func (f *routeFixture) scene(t *testing.T) *domain.VTTScene {
	t.Helper()
	s, err := f.repo.SceneByID(context.Background(), f.sceneID)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func (f *routeFixture) token(t *testing.T, id int64) *domain.VTTToken {
	t.Helper()
	tok, err := f.repo.TokenByID(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func (f *routeFixture) guardToken(t *testing.T, kind string) int64 {
	t.Helper()
	var id int64
	if err := f.db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,npc_id,speed_ft,x,y) VALUES($1,$2,'Guardia','npc',$3,30,35,35) RETURNING id`,
		f.sceneID, f.campaignID, f.guardNPC).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if kind != "npc" {
		_, _ = f.db.Exec(`UPDATE vtt_tokens SET kind=$2, npc_id=NULL WHERE id=$1`, id, kind)
	}
	return id
}

var square = &domain.Route{Mode: "loop", Points: []domain.RoutePoint{{X: 35, Y: 35}, {X: 455, Y: 35}, {X: 455, Y: 455}, {X: 35, Y: 455}}}

// A1/A2: the token lists the linked NPC's relation and appearance; the relation drives the disposition live.
func TestRouteLinkedNPCRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	id := f.guardToken(t, "npc")
	tok := f.token(t, id)
	if tok.NpcStatus == nil || *tok.NpcStatus != "neutral" || string(tok.NpcAppearance) != `{"body": 1}` {
		t.Fatalf("joined npc fields = %v / %s", tok.NpcStatus, tok.NpcAppearance)
	}
	if EffectiveDisposition(*tok) != "neutral" {
		t.Fatal("neutral NPC token must be neutral")
	}
	if _, err := f.db.Exec(`UPDATE campaign_npcs SET status='enemy' WHERE id=$1`, f.guardNPC); err != nil {
		t.Fatal(err)
	}
	tokens, err := f.repo.ListTokens(ctx, f.sceneID, true)
	if err != nil {
		t.Fatal(err)
	}
	for _, x := range tokens {
		if x.ID == id && EffectiveDisposition(x) != "hostile" {
			t.Fatal("after the relation turns to enemy the token must be hostile")
		}
	}
	npc, err := f.repo.CampaignNPC(ctx, f.campaignID, f.guardNPC)
	if err != nil || npc.Name != "Guardia Brom" || npc.ImageURL != "/img/brom.png" {
		t.Fatalf("CampaignNPC = %+v, %v", npc, err)
	}
	if _, err := f.repo.CampaignNPC(ctx, f.campaignID, f.alien); !errors.Is(err, repository.ErrVTTNotFound) {
		t.Fatalf("another campaign's NPC must be not found, got %v", err)
	}
	if _, err := f.db.Exec(`DELETE FROM campaign_npcs WHERE id=$1`, f.guardNPC); err != nil {
		t.Fatal(err)
	}
	if left := f.token(t, id); left.NpcID != nil {
		t.Fatal("deleting the NPC must keep the token, unlinked")
	}
}

// A3/A4/A5: set, freeze in combat, resume after it, drag pauses, resume and restart.
func TestRouteLifecycleRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	scene := f.scene(t)
	pcTok := f.token(t, f.pc)
	if err := f.play.SetRoute(ctx, scene, pcTok, square); !errors.Is(err, ErrRouteNotAllowed) {
		t.Fatalf("pc route err = %v", err)
	}
	id := f.guardToken(t, "npc")
	tok := f.token(t, id)
	bad := &domain.Route{Mode: "loop", Points: []domain.RoutePoint{{X: 1, Y: 1}, {X: 5000, Y: 1}}}
	var re RouteError
	if err := f.play.SetRoute(ctx, scene, tok, bad); !errors.As(err, &re) {
		t.Fatalf("invalid route err = %v", err)
	}
	tok.X, tok.Y = 900, 900
	if err := f.play.SetRoute(ctx, scene, tok, square); err != nil {
		t.Fatal(err)
	}
	tok = f.token(t, id)
	if tok.Route == nil || tok.RouteStartedAt == nil || tok.RouteElapsedMs != 0 || tok.X != 35 || tok.Y != 35 {
		t.Fatalf("after SetRoute: route=%v started=%v elapsed=%d pos=(%v,%v)", tok.Route, tok.RouteStartedAt, tok.RouteElapsedMs, tok.X, tok.Y)
	}
	if f.rt.count("vtt.route.updated") == 0 {
		t.Fatal("SetRoute must announce vtt.route.updated")
	}

	// Pretend it has walked 3 s, then a combat starts with it.
	started := time.Now().Add(-3 * time.Second)
	if _, err := f.db.Exec(`UPDATE vtt_tokens SET route_started_at=$2 WHERE id=$1`, id, started); err != nil {
		t.Fatal(err)
	}
	combat, err := f.play.StartEncounter(ctx, scene, 35, 35, []int64{id}, []int64{f.pc})
	if err != nil {
		t.Fatal(err)
	}
	tok = f.token(t, id)
	if tok.RouteStartedAt != nil || tok.RouteElapsedMs < 2900 || tok.RouteElapsedMs > 4000 {
		t.Fatalf("combat must freeze the clock near 3 s: started=%v elapsed=%d", tok.RouteStartedAt, tok.RouteElapsedMs)
	}
	wx, wy := RoutePosition(*square, routeRate(scene, tok), time.Duration(tok.RouteElapsedMs)*time.Millisecond)
	if math.Hypot(tok.X-wx, tok.Y-wy) > 1e-6 {
		t.Fatalf("frozen position (%v,%v) does not match the clock %d ms", tok.X, tok.Y, tok.RouteElapsedMs)
	}
	frozen := tok.RouteElapsedMs
	if err := f.play.EndCombat(ctx, combat); err != nil {
		t.Fatal(err)
	}
	tok = f.token(t, id)
	if tok.RouteStartedAt == nil || tok.RouteElapsedMs != frozen {
		t.Fatalf("ending the combat must resume from %d ms: started=%v elapsed=%d", frozen, tok.RouteStartedAt, tok.RouteElapsedMs)
	}

	// GM drag pauses where dropped.
	if err := f.play.PauseForDrag(ctx, scene, tok, 700, 700); err != nil {
		t.Fatal(err)
	}
	tok = f.token(t, id)
	if !tok.RoutePaused || tok.RouteStartedAt != nil || tok.X != 700 {
		t.Fatalf("drag: paused=%v started=%v x=%v", tok.RoutePaused, tok.RouteStartedAt, tok.X)
	}
	// A scene sync must not restart a GM-paused route.
	f.play.SyncSceneRoutes(ctx, scene)
	if f.token(t, id).RouteStartedAt != nil {
		t.Fatal("a paused route must stay stopped on sync")
	}
	if err := f.play.ResumeRoute(ctx, scene, tok); err != nil {
		t.Fatal(err)
	}
	tok = f.token(t, id)
	if tok.RoutePaused || tok.RouteStartedAt == nil || tok.X == 700 {
		t.Fatalf("resume must go back on the route and walk: paused=%v started=%v x=%v", tok.RoutePaused, tok.RouteStartedAt, tok.X)
	}
	if err := f.play.PauseRoute(ctx, scene, tok); err != nil {
		t.Fatal(err)
	}
	if tok = f.token(t, id); !tok.RoutePaused || tok.RouteStartedAt != nil {
		t.Fatal("pause must stop the clock")
	}
	if err := f.play.RestartRoute(ctx, scene, tok); err != nil {
		t.Fatal(err)
	}
	if tok = f.token(t, id); tok.RoutePaused || tok.RouteElapsedMs != 0 || tok.X != 35 || tok.RouteStartedAt == nil {
		t.Fatalf("restart: paused=%v elapsed=%d x=%v started=%v", tok.RoutePaused, tok.RouteElapsedMs, tok.X, tok.RouteStartedAt)
	}

	// The scene leaves exploration: everything freezes; it comes back: everything walks.
	before := *scene
	scene.Mode = "narrative"
	if _, err := f.db.Exec(`UPDATE vtt_scenes SET mode='narrative' WHERE id=$1`, f.sceneID); err != nil {
		t.Fatal(err)
	}
	f.play.SceneChanged(ctx, &before, scene)
	if f.token(t, id).RouteStartedAt != nil {
		t.Fatal("narrative mode must freeze routes")
	}
	before = *scene
	scene.Mode = "exploration"
	f.play.SceneChanged(ctx, &before, scene)
	if f.token(t, id).RouteStartedAt == nil {
		t.Fatal("back to exploration must resume routes")
	}

	// Removing the route.
	tok = f.token(t, id)
	if err := f.play.SetRoute(ctx, scene, tok, nil); err != nil {
		t.Fatal(err)
	}
	if tok = f.token(t, id); tok.Route != nil || tok.RouteStartedAt != nil {
		t.Fatal("nil route must clear it")
	}
}

// Changing the scene pace keeps the token in place.
func TestRouteRetimeRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	scene := f.scene(t)
	id := f.guardToken(t, "monster")
	tok := f.token(t, id)
	if err := f.play.SetRoute(ctx, scene, tok, square); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(`UPDATE vtt_tokens SET route_started_at=NOW() - interval '2 seconds' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	tok = f.token(t, id)
	now := time.Now()
	x0, y0 := RoutePosition(*tok.Route, routeRate(scene, tok), ClockElapsed(*tok, now))
	before := *scene
	scene.Pace = 4
	f.play.SceneChanged(ctx, &before, scene)
	tok = f.token(t, id)
	x1, y1 := RoutePosition(*tok.Route, routeRate(scene, tok), ClockElapsed(*tok, time.Now()))
	// a few ms pass between both readings: allow a little walking at the new rate.
	if math.Hypot(x1-x0, y1-y0) > 10 {
		t.Fatalf("pace change moved the token from (%.1f,%.1f) to (%.1f,%.1f)", x0, y0, x1, y1)
	}
}
