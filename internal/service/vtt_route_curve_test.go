package service

import (
	"encoding/json"
	"math"
	"os"
	"strings"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"
)

// T-28 · contratos/T-28-ruta-curvas-go.md

type curveCase struct {
	Name        string              `json:"name"`
	Mode        string              `json:"mode"`
	Rate        float64             `json:"rate"`
	ElapsedFrac float64             `json:"elapsed_frac"`
	Points      []domain.RoutePoint `json:"points"`
	Want        struct{ X, Y float64 }
}

// C1/C2: constant speed along the curve; the same table runs in TypeScript.
func TestRouteCurvesSharedTable(t *testing.T) {
	raw, err := os.ReadFile("testdata/route_curve_cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var table struct{ Cases []curveCase }
	if err := json.Unmarshal(raw, &table); err != nil {
		t.Fatal(err)
	}
	if len(table.Cases) < 10 {
		t.Fatalf("expected the full curve table, got %d", len(table.Cases))
	}
	for _, c := range table.Cases {
		route := domain.Route{Mode: c.Mode, Points: c.Points}
		cycle := RouteCycleSeconds(route, c.Rate)
		if cycle <= 0 {
			t.Fatalf("%s: cycle = %v", c.Name, cycle)
		}
		x, y := RoutePosition(route, c.Rate, time.Duration(c.ElapsedFrac*cycle*float64(time.Second)))
		if math.Abs(x-c.Want.X) > 1e-6 || math.Abs(y-c.Want.Y) > 1e-6 {
			t.Errorf("%s: got (%.6f, %.6f), want (%v, %v)", c.Name, x, y, c.Want.X, c.Want.Y)
		}
	}
}

// The arch is longer than its chord, so it takes longer to walk.
func TestRouteCurveIsLongerThanChord(t *testing.T) {
	arch := domain.Route{Mode: "once", Points: []domain.RoutePoint{{X: 0, Y: 0, Out: &domain.Point{X: 0, Y: 100}}, {X: 100, Y: 0, In: &domain.Point{X: 100, Y: 100}}}}
	chord := domain.Route{Mode: "once", Points: []domain.RoutePoint{{X: 0, Y: 0}, {X: 100, Y: 0}}}
	if a, c := RouteCycleSeconds(arch, 10), RouteCycleSeconds(chord, 10); !(a > c*1.3) || math.Abs(c-10) > 1e-9 {
		t.Fatalf("arch %v s vs chord %v s", a, c)
	}
	// Handles survive JSON as "in"/"out".
	b, _ := json.Marshal(arch)
	plain, _ := json.Marshal(chord)
	if !strings.Contains(string(b), `"out":{"x":0,"y":100}`) || !strings.Contains(string(b), `"in":{"x":100,"y":100}`) || strings.Contains(string(plain), `"in"`) {
		t.Fatalf("route JSON = %s / %s (corner points carry no handles)", b, plain)
	}
}

// C3
func TestValidateRouteCurves(t *testing.T) {
	scene := &domain.VTTScene{WidthPx: 1000, HeightPx: 800, Walls: domain.Walls{{X1: 500, Y1: 0, X2: 500, Y2: 200}}}
	pt := func(x, y float64) *domain.Point { return &domain.Point{X: x, Y: y} }
	cases := []struct {
		name    string
		points  []domain.RoutePoint
		wantErr string
	}{
		{"straight chord passes under the wall", []domain.RoutePoint{{X: 300, Y: 300}, {X: 700, Y: 300}}, ""},
		{"the curve bulges into the wall", []domain.RoutePoint{{X: 300, Y: 300, Out: pt(300, 0)}, {X: 700, Y: 300, In: pt(700, 0)}}, "segment 1 crosses a wall"},
		{"handles outside, curve inside", []domain.RoutePoint{{X: 100, Y: 100, Out: pt(100, -20)}, {X: 300, Y: 100, In: pt(300, -20)}}, ""},
		{"the curve leaves the scene", []domain.RoutePoint{{X: 100, Y: 100, Out: pt(100, -300)}, {X: 300, Y: 100, In: pt(300, -300)}}, "segment 1 leaves the scene"},
	}
	for _, c := range cases {
		err := ValidateRoute(scene, domain.Route{Mode: "once", Points: c.points})
		switch {
		case c.wantErr == "" && err != nil:
			t.Errorf("%s: unexpected %v", c.name, err)
		case c.wantErr != "" && (err == nil || !strings.Contains(err.Error(), c.wantErr)):
			t.Errorf("%s: want %q, got %v", c.name, c.wantErr, err)
		}
	}
}

// C4
func TestRescaleElapsedOnCurves(t *testing.T) {
	route := domain.Route{Mode: "pingpong", Points: []domain.RoutePoint{
		{X: 0, Y: 0, Out: &domain.Point{X: 0, Y: 100}, WaitS: 1},
		{X: 100, Y: 0, In: &domain.Point{X: 100, Y: 100}, Out: &domain.Point{X: 150, Y: -60}},
		{X: 200, Y: 50, In: &domain.Point{X: 220, Y: 0}},
	}}
	for _, elapsed := range []time.Duration{300 * time.Millisecond, 2 * time.Second, 5500 * time.Millisecond, 17 * time.Second} {
		x0, y0 := RoutePosition(route, 60, elapsed)
		x1, y1 := RoutePosition(route, 25, RescaleElapsed(route, 60, 25, elapsed))
		if math.Hypot(x1-x0, y1-y0) > 1e-3 {
			t.Errorf("elapsed %v: (%.3f,%.3f) → (%.3f,%.3f)", elapsed, x0, y0, x1, y1)
		}
	}
}
