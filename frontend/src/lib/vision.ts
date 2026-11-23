/* Vision engine for the native VTT — openspec/specs/vtt.md §4.
 * Pure geometry (line of sight) + an offscreen-canvas renderer that turns the
 * 5e vision rules into a fog mask for one user. */
import type { SceneLight, VTTScene, VTTToken, Wall } from '../services/vttApi';

export interface Pt { x: number; y: number }
type Seg = [number, number, number, number];

const EPS = 1e-4;

function raySegment(px: number, py: number, dx: number, dy: number, s: Seg): number | null {
  const [x1, y1, x2, y2] = s;
  const sx = x2 - x1, sy = y2 - y1;
  const den = dx * sy - dy * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((x1 - px) * sy - (y1 - py) * sx) / den;
  const u = ((x1 - px) * dy - (y1 - py) * dx) / den;
  if (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9) return t;
  return null;
}

/** Segments that block sight: closed walls/doors plus the scene border. */
export function blockingSegments(scene: Pick<VTTScene, 'walls' | 'width_px' | 'height_px'>): Seg[] {
  const w = scene.width_px, h = scene.height_px;
  const segs: Seg[] = [[0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]];
  for (const wall of scene.walls as Wall[]) if (!(wall.door && wall.open)) segs.push([wall.x1, wall.y1, wall.x2, wall.y2]);
  return segs;
}

/** Visibility polygon from `p` (classic angular sweep over segment endpoints). */
export function visibilityPolygon(p: Pt, segs: Seg[]): Pt[] {
  const angles: number[] = [];
  for (const [x1, y1, x2, y2] of segs) {
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      const a = Math.atan2(y - p.y, x - p.x);
      angles.push(a - EPS, a, a + EPS);
    }
  }
  const pts: { a: number; x: number; y: number }[] = [];
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = Infinity;
    for (const s of segs) {
      const t = raySegment(p.x, p.y, dx, dy, s);
      if (t !== null && t < best) best = t;
    }
    if (best < Infinity) pts.push({ a, x: p.x + dx * best, y: p.y + dy * best });
  }
  pts.sort((m, n) => m.a - n.a);
  return pts;
}

/** True when the segment p→q crosses no blocking wall (used for hit tests). */
export function hasLineOfSight(p: Pt, q: Pt, segs: Seg[]): boolean {
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return true;
  for (const s of segs) {
    const t = raySegment(p.x, p.y, dx / len, dy / len, s);
    if (t !== null && t < len - 1e-6) return false;
  }
  return true;
}

/** 5e grid distance in feet: every diagonal step counts as one cell (Chebyshev). */
export function gridDistanceFt(a: Pt, b: Pt, cellPx: number, feetPerCell: number): number {
  const cx = Math.round(Math.abs(b.x - a.x) / cellPx), cy = Math.round(Math.abs(b.y - a.y) / cellPx);
  return Math.max(cx, cy) * feetPerCell;
}

interface Light { x: number; y: number; bright: number; dim: number } // radii in px

export interface FogResult {
  /** alpha mask of what the viewer sees (scene space × scale) */
  visible: HTMLCanvasElement;
  /** composed fog overlay to draw over the map */
  fog: HTMLCanvasElement;
  scale: number;
  isVisible: (x: number, y: number) => boolean;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function clipPolygon(ctx: CanvasRenderingContext2D, poly: Pt[], s: number) {
  ctx.beginPath();
  poly.forEach((pt, i) => (i ? ctx.lineTo(pt.x * s, pt.y * s) : ctx.moveTo(pt.x * s, pt.y * s)));
  ctx.closePath();
  ctx.clip();
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, s: number) {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Renders the fog for the given viewer tokens.
 * visible(t) = LOS(t) ∩ range(t) ∩ (Lit ∪ darkvision(t) ∪ blindsight(t)).
 * `explored` (same size) accumulates everything seen before and is updated in place.
 */
export function renderFog(scene: VTTScene, tokens: VTTToken[], viewers: VTTToken[], explored: HTMLCanvasElement | null): FogResult {
  const maxDim = Math.max(scene.width_px, scene.height_px);
  const s = Math.min(1, 2048 / maxDim);
  const W = scene.width_px * s, H = scene.height_px * s;
  const ftPx = scene.grid_size_px / Math.max(1, scene.feet_per_cell);
  const segs = blockingSegments(scene);

  const lights: Light[] = [
    ...(scene.lights as SceneLight[]).map((l) => ({ x: l.x, y: l.y, bright: l.bright * ftPx, dim: l.dim * ftPx })),
    ...tokens.filter((t) => t.light_bright_ft > 0 || t.light_dim_ft > 0)
      .map((t) => ({ x: t.x, y: t.y, bright: t.light_bright_ft * ftPx, dim: t.light_dim_ft * ftPx })),
  ];

  // Lit areas (any light) and bright areas, each clipped by the light's own line of sight.
  const lit = canvas(W, H), bright = canvas(W, H);
  const litCtx = lit.getContext('2d')!, brightCtx = bright.getContext('2d')!;
  litCtx.fillStyle = brightCtx.fillStyle = '#fff';
  if (scene.ambient_light !== 'dark') litCtx.fillRect(0, 0, W, H);
  if (scene.ambient_light === 'bright') brightCtx.fillRect(0, 0, W, H);
  for (const l of lights) {
    const los = visibilityPolygon(l, segs);
    for (const [ctx, r] of [[litCtx, l.bright + l.dim], [brightCtx, l.bright]] as const) {
      ctx.save(); clipPolygon(ctx, los, s); disc(ctx, l.x, l.y, r, s); ctx.restore();
    }
  }

  // What the viewer tokens see.
  const visible = canvas(W, H);
  const vctx = visible.getContext('2d')!;
  vctx.fillStyle = '#fff';
  for (const t of viewers) {
    const los = visibilityPolygon(t, segs);
    vctx.save();
    clipPolygon(vctx, los, s);
    if (t.vision_ft > 0) { vctx.beginPath(); vctx.arc(t.x * s, t.y * s, t.vision_ft * ftPx * s, 0, Math.PI * 2); vctx.clip(); }
    vctx.drawImage(lit, 0, 0);
    disc(vctx, t.x, t.y, t.darkvision_ft * ftPx, s);
    disc(vctx, t.x, t.y, t.blindsight_ft * ftPx, s);
    disc(vctx, t.x, t.y, scene.grid_size_px * 0.5, s); // a creature always perceives its own square
    vctx.restore();
  }

  if (explored) {
    const ectx = explored.getContext('2d')!;
    ectx.drawImage(visible, 0, 0, explored.width, explored.height);
  }

  // Fog overlay: opaque where never seen, translucent where explored, clear where visible,
  // and darkened where only dim light / darkvision reaches.
  const fog = canvas(W, H);
  const f = fog.getContext('2d')!;
  f.fillStyle = 'rgb(6,7,10)';
  f.fillRect(0, 0, W, H);
  f.globalCompositeOperation = 'destination-out';
  if (explored) { f.globalAlpha = 0.42; f.drawImage(explored, 0, 0, W, H); f.globalAlpha = 1; }
  f.drawImage(visible, 0, 0);
  const dim = canvas(W, H);
  const d = dim.getContext('2d')!;
  d.drawImage(visible, 0, 0);
  d.globalCompositeOperation = 'destination-out';
  d.drawImage(bright, 0, 0);
  d.globalCompositeOperation = 'source-in';
  d.fillStyle = 'rgba(6,7,10,0.38)';
  d.fillRect(0, 0, W, H);
  f.globalCompositeOperation = 'source-over';
  f.drawImage(dim, 0, 0);

  const pixels = vctx.getImageData(0, 0, visible.width, visible.height).data;
  const isVisible = (x: number, y: number) => {
    const px = Math.floor(x * s), py = Math.floor(y * s);
    if (px < 0 || py < 0 || px >= visible.width || py >= visible.height) return false;
    return pixels[(py * visible.width + px) * 4 + 3] > 0;
  };
  return { visible, fog, scale: s, isVisible };
}

export function newExploredCanvas(scene: VTTScene, saved: string | null): HTMLCanvasElement {
  const maxDim = Math.max(scene.width_px, scene.height_px);
  const s = Math.min(1, 2048 / maxDim) / 2;
  const c = canvas(scene.width_px * s, scene.height_px * s);
  if (saved) {
    const img = new Image();
    img.onload = () => c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    img.src = saved;
  }
  return c;
}

/** Default vision of a PC by race (mirrors DarkvisionForRace on the server). */
export const DARKVISION_PRESETS: [string, number][] = [['Sin visión en la oscuridad', 0], ['Visión en la oscuridad 60 pies', 60], ['Visión en la oscuridad 120 pies', 120]];
export const LIGHT_PRESETS: [string, number, number][] = [['Sin luz', 0, 0], ['Antorcha (20/20)', 20, 20], ['Linterna con capucha (30/30)', 30, 30], ['Truco Luz (20/20)', 20, 20], ['Vela (5/5)', 5, 5]];
