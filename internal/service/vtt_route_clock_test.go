package service

import (
	"math"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"
)

func strp(s string) *string { return &s }
func i64p(v int64) *int64   { return &v }

// A2: linked tokens follow the NPC's relation live; loose tokens use their column; defaults per kind.
func TestEffectiveDisposition(t *testing.T) {
	cases := []struct {
		name  string
		token domain.VTTToken
		want  string
	}{
		{"linked enemy", domain.VTTToken{Kind: "npc", NpcID: i64p(3), NpcStatus: strp("enemy"), Disposition: "friendly"}, "hostile"},
		{"linked ally", domain.VTTToken{Kind: "npc", NpcID: i64p(3), NpcStatus: strp("ally"), Disposition: "hostile"}, "friendly"},
		{"linked neutral", domain.VTTToken{Kind: "monster", NpcID: i64p(3), NpcStatus: strp("neutral"), Disposition: "hostile"}, "neutral"},
		{"linked unknown status", domain.VTTToken{Kind: "npc", NpcID: i64p(3), NpcStatus: strp("dead"), Disposition: "hostile"}, "neutral"},
		{"linked without loaded status uses column", domain.VTTToken{Kind: "npc", NpcID: i64p(3), Disposition: "hostile"}, "hostile"},
		{"loose friendly", domain.VTTToken{Kind: "monster", Disposition: "friendly"}, "friendly"},
		{"loose monster default", domain.VTTToken{Kind: "monster"}, "hostile"},
		{"loose npc default", domain.VTTToken{Kind: "npc"}, "neutral"},
		{"loose invalid column", domain.VTTToken{Kind: "monster", Disposition: "angry"}, "hostile"},
		{"player character", domain.VTTToken{Kind: "pc", Disposition: "hostile"}, "friendly"},
	}
	for _, c := range cases {
		if got := EffectiveDisposition(c.token); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestDefaultDisposition(t *testing.T) {
	if DefaultDisposition("monster") != "hostile" || DefaultDisposition("npc") != "neutral" || DefaultDisposition("pc") != "friendly" {
		t.Fatal("defaults per kind are monster→hostile, npc→neutral, pc→friendly")
	}
	for _, v := range []string{"hostile", "neutral", "friendly"} {
		if !ValidDisposition(v) {
			t.Errorf("%s should be valid", v)
		}
	}
	if ValidDisposition("") || ValidDisposition("enemy") {
		t.Fatal("only hostile, neutral and friendly are valid dispositions")
	}
}

// A4: the spec example — freeze at 7 s, resume 2 minutes later, keep walking from 7 s.
func TestRouteClockFreezeResume(t *testing.T) {
	t0 := time.Date(2026, 11, 23, 20, 0, 0, 0, time.UTC)
	tok := domain.VTTToken{Route: &domain.Route{Mode: "loop"}}
	if got := ClockElapsed(tok, t0); got != 0 {
		t.Fatalf("stopped fresh clock = %v, want 0", got)
	}
	ResumeClock(&tok, t0)
	if tok.RouteStartedAt == nil || !tok.RouteStartedAt.Equal(t0) {
		t.Fatal("resume must start the clock now")
	}
	ResumeClock(&tok, t0.Add(3*time.Second)) // already running: no-op
	if !tok.RouteStartedAt.Equal(t0) {
		t.Fatal("resuming a running clock must not restart it")
	}
	if got := ClockElapsed(tok, t0.Add(7*time.Second)); got != 7*time.Second {
		t.Fatalf("running elapsed = %v, want 7s", got)
	}
	FreezeClock(&tok, t0.Add(7*time.Second))
	if tok.RouteStartedAt != nil || tok.RouteElapsedMs != 7000 {
		t.Fatalf("freeze must accumulate 7000 ms and stop, got %d / %v", tok.RouteElapsedMs, tok.RouteStartedAt)
	}
	FreezeClock(&tok, t0.Add(9*time.Second)) // already frozen: no-op
	if tok.RouteElapsedMs != 7000 {
		t.Fatal("freezing a frozen clock must not change it")
	}
	if got := ClockElapsed(tok, t0.Add(2*time.Minute)); got != 7*time.Second {
		t.Fatalf("frozen elapsed = %v, want 7s", got)
	}
	resumeAt := t0.Add(2*time.Minute + 7*time.Second)
	ResumeClock(&tok, resumeAt)
	if got := ClockElapsed(tok, resumeAt.Add(time.Second)); got != 8*time.Second {
		t.Fatalf("after resume elapsed = %v, want 8s", got)
	}
	// A clock started in the future (skew) never goes negative.
	future := t0.Add(time.Hour)
	skew := domain.VTTToken{RouteElapsedMs: 500, RouteStartedAt: &future}
	if got := ClockElapsed(skew, t0); got != 500*time.Millisecond {
		t.Fatalf("future start elapsed = %v, want the accumulated 500ms", got)
	}
}

func TestRouteClockView(t *testing.T) {
	t0 := time.Date(2026, 11, 23, 20, 0, 0, 0, time.UTC)
	started := t0.Add(-1500 * time.Millisecond)
	running := domain.VTTToken{Route: &domain.Route{Mode: "once"}, RouteElapsedMs: 1000, RouteStartedAt: &started}
	if v := RouteClockView(running, t0); v == nil || v.ElapsedMs != 2500 || !v.Running {
		t.Fatalf("running view = %+v, want 2500 ms running", v)
	}
	stopped := domain.VTTToken{Route: &domain.Route{Mode: "once"}, RouteElapsedMs: 1000}
	if v := RouteClockView(stopped, t0); v == nil || v.ElapsedMs != 1000 || v.Running {
		t.Fatalf("stopped view = %+v, want 1000 ms stopped", v)
	}
	if v := RouteClockView(domain.VTTToken{}, t0); v != nil {
		t.Fatal("a token without route has no clock")
	}
}

// §3: the clock runs only in an active exploration scene, outside combat and not paused by the GM.
func TestRouteShouldRun(t *testing.T) {
	scene := &domain.VTTScene{IsActive: true, Mode: "exploration"}
	tok := domain.VTTToken{Kind: "npc", Route: &domain.Route{Mode: "loop"}}
	if !RouteShouldRun(scene, tok, false) {
		t.Fatal("route in an active exploration scene should run")
	}
	if RouteShouldRun(scene, tok, true) {
		t.Fatal("a token in combat must not walk its route")
	}
	paused := tok
	paused.RoutePaused = true
	if RouteShouldRun(scene, paused, false) {
		t.Fatal("a GM-paused route must not run")
	}
	noRoute := tok
	noRoute.Route = nil
	if RouteShouldRun(scene, noRoute, false) {
		t.Fatal("no route, nothing to run")
	}
	for _, s := range []*domain.VTTScene{{IsActive: false, Mode: "exploration"}, {IsActive: true, Mode: "combat"}, {IsActive: true, Mode: "narrative"}} {
		if RouteShouldRun(s, tok, false) {
			t.Fatalf("route must not run in scene %+v", *s)
		}
	}
}

func TestRouteRate(t *testing.T) {
	scene := &domain.VTTScene{GridSizePx: 70, FeetPerCell: 5, Pace: 2}
	if got := RouteRate(scene, 0); got != 0 {
		t.Fatalf("speed 0 must stand still, got %v", got)
	}
	if got, want := RouteRate(scene, 30), ExplorationRatePxPerSec(scene, 30, false); got != want {
		t.Fatalf("route rate = %v, want the walking exploration rate %v", got, want)
	}
}

// Changing the rate keeps the token where it is: the elapsed time is rescaled.
func TestRescaleElapsedKeepsPosition(t *testing.T) {
	route := domain.Route{Mode: "loop", Points: []domain.RoutePoint{{X: 0, Y: 0, WaitS: 1}, {X: 100, Y: 0, WaitS: 2}, {X: 100, Y: 100}}}
	for _, elapsed := range []time.Duration{0, 400 * time.Millisecond, 1500 * time.Millisecond, 2500 * time.Millisecond, 4200 * time.Millisecond, 7300 * time.Millisecond, 25 * time.Second} {
		for _, rates := range [][2]float64{{100, 50}, {100, 200}, {37, 81}} {
			x0, y0 := RoutePosition(route, rates[0], elapsed)
			rescaled := RescaleElapsed(route, rates[0], rates[1], elapsed)
			x1, y1 := RoutePosition(route, rates[1], rescaled)
			if math.Hypot(x1-x0, y1-y0) > 1e-3 {
				t.Errorf("elapsed %v rates %v: position moved from (%.3f,%.3f) to (%.3f,%.3f)", elapsed, rates, x0, y0, x1, y1)
			}
		}
	}
	once := domain.Route{Mode: "once", Points: []domain.RoutePoint{{X: 0, Y: 0}, {X: 100, Y: 0}}}
	if got := RescaleElapsed(once, 100, 50, time.Hour); got != 2*time.Second {
		t.Fatalf("a finished once route rescales to its end (2s), got %v", got)
	}
	if got := RescaleElapsed(once, 0, 50, time.Second); got != 0 {
		t.Fatalf("from a stopped rate the token was at P0, got %v", got)
	}
	if got := RescaleElapsed(once, 100, 0, time.Second); got != time.Second {
		t.Fatalf("to a zero rate the elapsed is kept, got %v", got)
	}
}
