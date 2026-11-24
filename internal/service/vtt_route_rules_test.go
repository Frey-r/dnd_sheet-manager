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

type routeCase struct {
	Name      string              `json:"name"`
	Mode      string              `json:"mode"`
	Rate      float64             `json:"rate"`
	ElapsedMs int64               `json:"elapsed_ms"`
	Points    []domain.RoutePoint `json:"points"`
	Want      struct{ X, Y float64 }
}

// R1–R5: the shared table also runs in the frontend (routePosition.test.ts).
func TestRoutePositionSharedTable(t *testing.T) {
	raw, err := os.ReadFile("testdata/route_cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var table struct{ Cases []routeCase }
	if err := json.Unmarshal(raw, &table); err != nil {
		t.Fatal(err)
	}
	if len(table.Cases) < 20 {
		t.Fatalf("expected the full case table, got %d cases", len(table.Cases))
	}
	for _, c := range table.Cases {
		route := domain.Route{Mode: c.Mode, Points: c.Points}
		x, y := RoutePosition(route, c.Rate, time.Duration(c.ElapsedMs)*time.Millisecond)
		if math.Abs(x-c.Want.X) > 1e-6 || math.Abs(y-c.Want.Y) > 1e-6 {
			t.Errorf("%s: got (%.4f, %.4f), want (%.4f, %.4f)", c.Name, x, y, c.Want.X, c.Want.Y)
		}
	}
}

func TestRoutePositionEmptyRoute(t *testing.T) {
	if x, y := RoutePosition(domain.Route{Mode: "loop"}, 100, time.Second); x != 0 || y != 0 {
		t.Fatalf("empty route should stay at origin, got (%v, %v)", x, y)
	}
}

// R6: validation names the problem.
func TestValidateRoute(t *testing.T) {
	scene := &domain.VTTScene{WidthPx: 1000, HeightPx: 800, Walls: domain.Walls{
		{X1: 500, Y1: 0, X2: 500, Y2: 400},                          // solid wall
		{X1: 500, Y1: 400, X2: 500, Y2: 500, Door: true},            // closed door
		{X1: 0, Y1: 600, X2: 1000, Y2: 600, Door: true, Open: true}, // open door
	}}
	pts := func(xy ...float64) []domain.RoutePoint {
		out := []domain.RoutePoint{}
		for i := 0; i+1 < len(xy); i += 2 {
			out = append(out, domain.RoutePoint{X: xy[i], Y: xy[i+1]})
		}
		return out
	}
	many := make([]domain.RoutePoint, 33)
	for i := range many {
		many[i] = domain.RoutePoint{X: float64(i), Y: 10}
	}
	cases := []struct {
		name    string
		route   domain.Route
		wantErr string
	}{
		{"valid line", domain.Route{Mode: "once", Points: pts(100, 100, 400, 100)}, ""},
		{"through closed door", domain.Route{Mode: "pingpong", Points: pts(400, 450, 600, 450)}, ""},
		{"through open door", domain.Route{Mode: "once", Points: pts(100, 550, 100, 700)}, ""},
		{"edge of scene", domain.Route{Mode: "once", Points: pts(0, 800, 1000, 800)}, ""},
		{"one point", domain.Route{Mode: "once", Points: pts(1, 1)}, "points"},
		{"too many points", domain.Route{Mode: "once", Points: many}, "points"},
		{"unknown mode", domain.Route{Mode: "zigzag", Points: pts(1, 1, 2, 2)}, "mode"},
		{"outside scene", domain.Route{Mode: "once", Points: pts(1, 1, 1200, 2)}, "outside"},
		{"below scene", domain.Route{Mode: "once", Points: pts(1, 1, 2, 801)}, "outside"},
		{"negative coordinate", domain.Route{Mode: "once", Points: pts(-1, 1, 2, 2)}, "outside"},
		{"negative y", domain.Route{Mode: "once", Points: pts(1, -1, 2, 2)}, "outside"},
		{"wait too long", domain.Route{Mode: "once", Points: []domain.RoutePoint{{X: 1, Y: 1, WaitS: 601}, {X: 2, Y: 2}}}, "wait"},
		{"max wait", domain.Route{Mode: "once", Points: []domain.RoutePoint{{X: 1, Y: 1, WaitS: 600}, {X: 2, Y: 2}}}, ""},
		{"negative wait", domain.Route{Mode: "once", Points: []domain.RoutePoint{{X: 1, Y: 1, WaitS: -1}, {X: 2, Y: 2}}}, "wait"},
		{"crosses wall", domain.Route{Mode: "once", Points: pts(400, 100, 600, 100)}, "segment 1"},
		{"loop closing leg crosses wall", domain.Route{Mode: "loop", Points: pts(400, 100, 400, 450, 600, 450, 600, 100)}, "segment 4"},
		{"pingpong has no closing leg", domain.Route{Mode: "pingpong", Points: pts(400, 100, 400, 450, 600, 450, 600, 450)}, ""},
	}
	for _, c := range cases {
		err := ValidateRoute(scene, c.route)
		switch {
		case c.wantErr == "" && err != nil:
			t.Errorf("%s: unexpected error %v", c.name, err)
		case c.wantErr != "" && (err == nil || !strings.Contains(err.Error(), c.wantErr)):
			t.Errorf("%s: want error containing %q, got %v", c.name, c.wantErr, err)
		}
	}
}
