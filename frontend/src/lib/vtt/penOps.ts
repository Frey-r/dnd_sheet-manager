/* Path operations of the route pen, like Photoshop's pen tool (vtt-npc-routines.md §6, D-0070). Pure functions. */
import { legCurve, type RoutePoint } from './routePosition';

type P = { x: number; y: number };
const round = (p: P): P => ({ x: Math.round(p.x), y: Math.round(p.y) });
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Constrains `p` around `origin` to the nearest multiple of 45° (projected, so the length follows the cursor). */
export function constrain45(origin: P, p: P): P {
  const dx = p.x - origin.x, dy = p.y - origin.y;
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const ux = Math.round(Math.cos(a)), uy = Math.round(Math.sin(a));
  const len = (dx * ux + dy * uy) / (ux * ux + uy * uy);
  return { x: origin.x + ux * len, y: origin.y + uy * len };
}

/** Handle mirrored through its anchor. */
export const mirrorHandle = (anchor: P, h: P): P => ({ x: 2 * anchor.x - h.x, y: 2 * anchor.y - h.y });

/** Nearest point of the path to p: the leg (from index), its parameter t and the distance. */
export function nearestOnPath(pts: RoutePoint[], closed: boolean, p: P): { leg: number; t: number; dist: number } | null {
  let best: { leg: number; t: number; dist: number } | null = null;
  const legs = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < legs; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const c = legCurve(a, b, true);
    if (!c.curved) {
      const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
      const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0;
      const dist = Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y);
      if (!best || dist < best.dist) best = { leg: i, t, dist };
      continue;
    }
    c.pts.forEach((q, k) => {
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || dist < best.dist) best = { leg: i, t: k / (c.pts.length - 1), dist };
    });
  }
  return best;
}

/** Adds an anchor on leg `leg` at parameter t without changing the shape (De Casteljau), on background pixels. */
export function splitLeg(pts: RoutePoint[], leg: number, t: number): RoutePoint[] {
  const ia = leg, ib = (leg + 1) % pts.length;
  const a = pts[ia], b = pts[ib];
  if (!a.out && !b.in) {
    const m = round(lerp(a, b, t));
    const out = [...pts];
    out.splice(ia + 1, 0, m);
    return out;
  }
  const p1 = a.out ?? a, p2 = b.in ?? b;
  const q0 = lerp(a, p1, t), q1 = lerp(p1, p2, t), q2 = lerp(p2, b, t);
  const r0 = lerp(q0, q1, t), r1 = lerp(q1, q2, t), s = lerp(r0, r1, t);
  const next = pts.map((pt, i) => {
    if (i === ia) return { ...pt, out: round(q0) };
    if (i === ib) return { ...pt, in: round(q2) };
    return pt;
  });
  const mid: RoutePoint = { ...round(s), in: round(r0), out: round(r1) };
  next.splice(ia + 1, 0, mid);
  return next;
}

/** The same path walked the other way: order reversed and in/out swapped. */
export function reversePath(pts: RoutePoint[]): RoutePoint[] {
  return [...pts].reverse().map((pt) => {
    const r: RoutePoint = { x: pt.x, y: pt.y };
    if (pt.wait_s) r.wait_s = pt.wait_s;
    if (pt.out) r.in = pt.out;
    if (pt.in) r.out = pt.in;
    return r;
  });
}

/** Drops the handles of an anchor (smooth → corner). */
export function toCorner(pt: RoutePoint): RoutePoint {
  const r: RoutePoint = { x: pt.x, y: pt.y };
  if (pt.wait_s) r.wait_s = pt.wait_s;
  return r;
}
