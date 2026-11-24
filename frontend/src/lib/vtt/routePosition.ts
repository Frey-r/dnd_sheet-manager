/* NPC routes on the board — openspec/specs/vtt-npc-routines.md §3, §5.
 * Mirror of internal/service/vtt_route_rules.go: both run internal/service/testdata/route_cases.json,
 * so the board animates exactly where the server keeps the token. */

export type RouteMode = 'once' | 'pingpong' | 'loop';
/** A route anchor; `in`/`out` are its Bézier handles (vtt-npc-routines.md §3, D-0069). */
export interface RoutePoint { x: number; y: number; wait_s?: number; in?: { x: number; y: number }; out?: { x: number; y: number } }
export interface Route { mode: RouteMode; points: RoutePoint[] }
/** Route progress from the server; `received_at` (performance.now()) is stamped by the client on arrival. */
export interface RouteClock { elapsed_ms: number; running: boolean; received_at?: number }

type P = { x: number; y: number };
/** Pieces per Bézier leg; the server uses the same number, so both measure the same arc length. */
const CURVE_STEPS = 24;

/** One leg's geometry: straight, or a cubic Bézier sampled into a polyline with cumulative lengths. */
interface Curve { p0: P; p3: P; curved: boolean; pts: P[]; cum: number[]; length: number; c1: P; c2: P }
interface Leg { from: RoutePoint; to: RoutePoint; curve: Curve; move: number; wait: number }

const bezier = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
};

/** Leg a→b: forward uses a.out and b.in; backward (pingpong return) walks the same curve the other way. */
export function legCurve(a: RoutePoint, b: RoutePoint, forward = true): Curve {
  const h1 = forward ? a.out : a.in, h2 = forward ? b.in : b.out;
  const p0 = { x: a.x, y: a.y }, p3 = { x: b.x, y: b.y };
  const c1 = h1 ?? p0, c2 = h2 ?? p3;
  if (!h1 && !h2) return { p0, p3, c1, c2, curved: false, pts: [], cum: [], length: Math.hypot(p3.x - p0.x, p3.y - p0.y) };
  const pts: P[] = [], cum: number[] = [];
  for (let k = 0; k <= CURVE_STEPS; k++) {
    pts.push(bezier(p0, c1, c2, p3, k / CURVE_STEPS));
    cum.push(k ? cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y) : 0);
  }
  return { p0, p3, c1, c2, curved: true, pts, cum, length: cum[CURVE_STEPS] };
}

/** Point at fraction f (0..1) of the leg's length: constant speed along curves. */
function curveAt(c: Curve, f: number): P {
  if (!c.curved) return { x: c.p0.x + (c.p3.x - c.p0.x) * f, y: c.p0.y + (c.p3.y - c.p0.y) * f };
  const s = f * c.length;
  for (let k = 1; k <= CURVE_STEPS; k++) {
    if (s <= c.cum[k] || k === CURVE_STEPS) {
      const seg = c.cum[k] - c.cum[k - 1];
      const g = seg > 0 ? (s - c.cum[k - 1]) / seg : 0;
      const a = c.pts[k - 1], b = c.pts[k];
      return { x: a.x + (b.x - a.x) * g, y: a.y + (b.y - a.y) * g };
    }
  }
  return { ...c.p3 };
}

/** Legs of one cycle (for "once", the whole trip); pingpong waits at every point it reaches. */
function legs(route: Route, rate: number): Leg[] {
  const pts = route.points;
  const order: number[] = [];
  for (let i = 1; i < pts.length; i++) order.push(i);
  if (route.mode === 'loop') order.push(0);
  else if (route.mode === 'pingpong') for (let i = pts.length - 2; i >= 0; i--) order.push(i);
  const out: Leg[] = [];
  let prev = 0;
  for (const i of order) {
    const a = pts[prev], b = pts[i];
    const curve = legCurve(a, b, route.mode !== 'pingpong' || i > prev);
    out.push({ from: a, to: b, curve, move: curve.length / rate, wait: b.wait_s ?? 0 });
    prev = i;
  }
  return out;
}

/** Position of a token that has walked `route` for `elapsedMs` at `rate` px/s. */
export function routePosition(route: Route, rate: number, elapsedMs: number): { x: number; y: number } {
  const start = route.points[0];
  if (!start) return { x: 0, y: 0 };
  let t = elapsedMs / 1000;
  if (rate <= 0 || t <= 0 || route.points.length < 2) return { x: start.x, y: start.y };
  const ls = legs(route, rate);
  const total = ls.reduce((s, l) => s + l.move + l.wait, 0);
  if (total <= 0) return { x: start.x, y: start.y };
  if (route.mode === 'once') {
    if (t >= total) { const end = route.points[route.points.length - 1]; return { x: end.x, y: end.y }; }
  } else {
    t %= total;
  }
  for (const l of ls) {
    if (t < l.move) return curveAt(l.curve, t / l.move);
    t -= l.move;
    if (t < l.wait) return { x: l.to.x, y: l.to.y };
    t -= l.wait;
  }
  return { x: start.x, y: start.y };
}

/** Walking rate of a route token (same as the server's RouteRate): speed 0 stands still. */
export function routeRate(speedFt: number, gridPx: number, feetPerCell: number, pace: number): number {
  if (speedFt <= 0) return 0;
  return (Math.max(5, speedFt) * (gridPx / Math.max(1, feetPerCell))) / 6 * (pace > 0 ? pace : 2);
}

/** Elapsed route time now: the clock received at `receivedAt` plus the local time since, if it runs. */
export function liveElapsed(clock: RouteClock, receivedAt: number, now: number): number {
  return clock.running ? clock.elapsed_ms + Math.max(0, now - receivedAt) : clock.elapsed_ms;
}

interface RouteScene { grid_size_px: number; feet_per_cell: number; exploration_pace: number }
interface RouteToken { x: number; y: number; speed_ft: number; route?: Route | null; route_clock?: RouteClock | null }

/** Where to draw a token at `now`: on its route by its clock, else at x, y. */
export function liveTokenPosition(t: RouteToken, scene: RouteScene, now: number): { x: number; y: number } {
  if (!t.route || !t.route_clock) return { x: t.x, y: t.y };
  const rate = routeRate(t.speed_ft, scene.grid_size_px, scene.feet_per_cell, scene.exploration_pace);
  return routePosition(t.route, rate, liveElapsed(t.route_clock, t.route_clock.received_at ?? now, now));
}

/** Marks when a clock arrived, so the board can keep it running locally. */
export function stampClock<T extends { route_clock?: RouteClock | null }>(t: T, now: number): T {
  return t.route_clock ? { ...t, route_clock: { ...t.route_clock, received_at: now } } : t;
}


/** Duration of one cycle (for "once", the whole trip) in seconds at rate px/s. */
export function routeCycleSeconds(route: Route, rate: number): number {
  if (rate <= 0 || route.points.length < 2) return 0;
  return legs(route, rate).reduce((s, l) => s + l.move + l.wait, 0);
}
