package service

import (
	"math"

	"dnd-campaign-manager/internal/domain"
)

// curveSteps is how many straight pieces approximate a Bézier leg (vtt-npc-routines.md §3, D-0069).
// The frontend uses the same number, so both compute the same arc length.
const curveSteps = 24

// legCurve is the geometry of one leg: a straight segment, or a cubic Bézier sampled into a polyline
// with its cumulative lengths (constant walking speed along the curve).
type legCurve struct {
	p0, p1, p2, p3 domain.Point
	curved         bool
	pts            []domain.Point // curveSteps+1 samples when curved
	cum            []float64      // cumulative length at each sample
	length         float64
}

func orPoint(h *domain.Point, p domain.RoutePoint) domain.Point {
	if h != nil {
		return *h
	}
	return domain.Point{X: p.X, Y: p.Y}
}

// newLegCurve builds the leg from a to b. forward: a.Out and b.In; backward (pingpong return):
// the same curve walked the other way, so a.In and b.Out.
func newLegCurve(a, b domain.RoutePoint, forward bool) legCurve {
	c := legCurve{p0: domain.Point{X: a.X, Y: a.Y}, p3: domain.Point{X: b.X, Y: b.Y}}
	if forward {
		c.p1, c.p2 = orPoint(a.Out, a), orPoint(b.In, b)
		c.curved = a.Out != nil || b.In != nil
	} else {
		c.p1, c.p2 = orPoint(a.In, a), orPoint(b.Out, b)
		c.curved = a.In != nil || b.Out != nil
	}
	if !c.curved {
		c.length = math.Hypot(c.p3.X-c.p0.X, c.p3.Y-c.p0.Y)
		return c
	}
	c.pts = make([]domain.Point, curveSteps+1)
	c.cum = make([]float64, curveSteps+1)
	for k := 0; k <= curveSteps; k++ {
		c.pts[k] = bezier(c.p0, c.p1, c.p2, c.p3, float64(k)/curveSteps)
		if k > 0 {
			c.cum[k] = c.cum[k-1] + math.Hypot(c.pts[k].X-c.pts[k-1].X, c.pts[k].Y-c.pts[k-1].Y)
		}
	}
	c.length = c.cum[curveSteps]
	return c
}

func bezier(p0, p1, p2, p3 domain.Point, t float64) domain.Point {
	u := 1 - t
	a, b, c, d := u*u*u, 3*u*u*t, 3*u*t*t, t*t*t
	return domain.Point{X: a*p0.X + b*p1.X + c*p2.X + d*p3.X, Y: a*p0.Y + b*p1.Y + c*p2.Y + d*p3.Y}
}

// at returns the point at fraction f (0..1) of the leg's length.
func (c legCurve) at(f float64) (float64, float64) {
	if !c.curved {
		return c.p0.X + (c.p3.X-c.p0.X)*f, c.p0.Y + (c.p3.Y-c.p0.Y)*f
	}
	s := f * c.length
	for k := 1; k <= curveSteps; k++ {
		if s <= c.cum[k] || k == curveSteps {
			seg := c.cum[k] - c.cum[k-1]
			g := 0.0
			if seg > 0 {
				g = (s - c.cum[k-1]) / seg
			}
			a, b := c.pts[k-1], c.pts[k]
			return a.X + (b.X-a.X)*g, a.Y + (b.Y-a.Y)*g
		}
	}
	return c.p3.X, c.p3.Y
}

// pieces is the leg as straight pieces (one when straight) for wall and bounds checks.
func (c legCurve) pieces() []domain.Point {
	if !c.curved {
		return []domain.Point{c.p0, c.p3}
	}
	return c.pts
}

// RouteCycleSeconds is the duration of one cycle (for "once", the whole trip) at rate px/s.
func RouteCycleSeconds(route domain.Route, rate float64) float64 {
	if rate <= 0 || len(route.Points) < 2 {
		return 0
	}
	total := 0.0
	for _, l := range routeLegs(route, rate) {
		total += l.move + l.wait
	}
	return total
}
