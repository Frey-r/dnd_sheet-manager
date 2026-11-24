package service

import (
	"fmt"
	"math"
	"time"

	"dnd-campaign-manager/internal/domain"
)

// Route limits (vtt-npc-routines.md §3).
const (
	routeMinPoints = 2
	routeMaxPoints = 32
	routeMaxWaitS  = 600
)

// routeLeg is one move of a route cycle followed by the wait at its destination.
type routeLeg struct {
	from, to domain.RoutePoint
	curve    legCurve // straight or Bézier geometry (D-0069)
	move     float64  // seconds walking
	wait     float64  // seconds waiting at `to`
}

// routeLegs expands a route into the legs of one cycle (for "once", the whole trip).
// pingpong waits at every point it reaches, so the far end and P0 wait once per arrival.
func routeLegs(route domain.Route, rate float64) []routeLeg {
	pts := route.Points
	order := make([]int, 0, 2*len(pts))
	for i := 1; i < len(pts); i++ {
		order = append(order, i)
	}
	switch route.Mode {
	case "loop":
		order = append(order, 0)
	case "pingpong":
		for i := len(pts) - 2; i >= 0; i-- {
			order = append(order, i)
		}
	}
	legs := make([]routeLeg, 0, len(order))
	prev := 0
	for _, i := range order {
		a, b := pts[prev], pts[i]
		curve := newLegCurve(a, b, route.Mode != "pingpong" || i > prev)
		legs = append(legs, routeLeg{from: a, to: b, curve: curve, move: curve.length / rate, wait: b.WaitS})
		prev = i
	}
	return legs
}

// RoutePosition is the deterministic position of a token that has walked `route` for `elapsed`
// at `rate` px/s. The frontend mirrors it in lib/vtt/routePosition.ts; both run the same table.
func RoutePosition(route domain.Route, rate float64, elapsed time.Duration) (float64, float64) {
	if len(route.Points) == 0 {
		return 0, 0
	}
	start := route.Points[0]
	t := elapsed.Seconds()
	if rate <= 0 || t <= 0 || len(route.Points) < 2 {
		return start.X, start.Y
	}
	legs := routeLegs(route, rate)
	total := 0.0
	for _, l := range legs {
		total += l.move + l.wait
	}
	if total <= 0 {
		return start.X, start.Y
	}
	if route.Mode == "once" {
		if t >= total {
			end := route.Points[len(route.Points)-1]
			return end.X, end.Y
		}
	} else {
		t = math.Mod(t, total)
	}
	for _, l := range legs {
		if t < l.move {
			return l.curve.at(t / l.move)
		}
		t -= l.move
		if t < l.wait {
			return l.to.X, l.to.Y
		}
		t -= l.wait
	}
	return start.X, start.Y // t == total after rounding: back at the start of the cycle
}

// ValidateRoute checks a route against the scene: size, mode, bounds, waits and solid walls.
// Doors never block a route: the NPC uses them whether they are open or closed.
func ValidateRoute(scene *domain.VTTScene, route domain.Route) error {
	if n := len(route.Points); n < routeMinPoints || n > routeMaxPoints {
		return fmt.Errorf("a route needs between %d and %d points", routeMinPoints, routeMaxPoints)
	}
	if route.Mode != "once" && route.Mode != "pingpong" && route.Mode != "loop" {
		return fmt.Errorf("unknown route mode %q", route.Mode)
	}
	for i, p := range route.Points {
		if p.X < 0 || p.Y < 0 || p.X > float64(scene.WidthPx) || p.Y > float64(scene.HeightPx) {
			return fmt.Errorf("point %d is outside the scene", i+1)
		}
		if p.WaitS < 0 || p.WaitS > routeMaxWaitS {
			return fmt.Errorf("point %d: wait must be between 0 and %d seconds", i+1, routeMaxWaitS)
		}
	}
	solid := make([]domain.Wall, 0, len(scene.Walls))
	for _, w := range scene.Walls {
		if !w.Door {
			solid = append(solid, w)
		}
	}
	n := len(route.Points)
	segments := n - 1
	if route.Mode == "loop" {
		segments = n
	}
	w, h := float64(scene.WidthPx), float64(scene.HeightPx)
	for s := 0; s < segments; s++ {
		pieces := newLegCurve(route.Points[s], route.Points[(s+1)%n], true).pieces()
		for k := 1; k < len(pieces); k++ {
			a, b := pieces[k-1], pieces[k]
			if b.X < 0 || b.Y < 0 || b.X > w || b.Y > h {
				return fmt.Errorf("segment %d leaves the scene", s+1)
			}
			if MovementBlocked(solid, a.X, a.Y, b.X, b.Y) {
				return fmt.Errorf("segment %d crosses a wall", s+1)
			}
		}
	}
	return nil
}
