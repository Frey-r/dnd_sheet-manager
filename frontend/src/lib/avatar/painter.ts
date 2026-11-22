/* Pixel buffer + body frames for the three-quarter avatar (48×56, face turned to the viewer's right,
   feet on row 53). openspec/specs/character-appearance.md, "Art direction". */
import type { Size } from './types';

export const W = 48;
export const H = 56;
/** Last row of the feet for every body size. */
export const FOOT_Y = 53;

export interface Rect { x: number; y: number; w: number; h: number }

export class Painter {
  readonly px: (string | null)[] = new Array(W * H).fill(null);
  /** What each pixel belongs to ("skin", "hair", "cloth"…), for cast shadows and outlines. */
  readonly tags: (string | null)[] = new Array(W * H).fill(null);
  /** Tag given to the pixels painted from now on. */
  tag: string | null = null;

  set(x: number, y: number, c: string | null | undefined) {
    if (!c || x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    this.px[i] = c;
    this.tags[i] = this.tag;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return this.px[y * W + x];
  }

  tagAt(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return this.tags[y * W + x];
  }

  clear(x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.px[y * W + x] = null;
    this.tags[y * W + x] = null;
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  hline(x1: number, x2: number, y: number, c: string) {
    for (let i = Math.min(x1, x2); i <= Math.max(x1, x2); i++) this.set(i, y, c);
  }

  vline(x: number, y1: number, y2: number, c: string) {
    for (let j = Math.min(y1, y2); j <= Math.max(y1, y2); j++) this.set(x, j, c);
  }

  /** Pixel list helper: [[x, y], …]. */
  dots(points: [number, number][], c: string) {
    for (const [x, y] of points) this.set(x, y, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5);
        const dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  /**
   * Hand-drawn pixel template. Each character of `rows` is looked up in `map`; characters
   * missing from the map (or mapped to null) are left untouched. `flip` mirrors it horizontally.
   */
  stamp(x0: number, y0: number, rows: readonly string[], map: Record<string, string | null | undefined>, flip = false) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = map[row[i]];
        if (c) this.set(flip ? x0 + row.length - 1 - i : x0 + i, y0 + j, c);
      }
    });
  }

  /** Copies another painter on top of this one through row/column maps (target → source or -1). */
  blit(src: Painter, rows: number[], cols: number[]) {
    for (let y = 0; y < H; y++) {
      const sy = rows[y];
      if (sy < 0) continue;
      for (let x = 0; x < W; x++) {
        const sx = cols[x];
        if (sx < 0) continue;
        const c = src.px[sy * W + sx];
        if (!c) continue;
        this.px[y * W + x] = c;
        this.tags[y * W + x] = src.tags[sy * W + sx];
      }
    }
  }
}

/*
 * Canonical body: medium size, body A. Every outfit, prop and body-attached race part is drawn in
 * these coordinates, then resized for the real size by repeating or removing whole rows and columns
 * at fixed seams (character-appearance.md, "Proportions"). The head is never resized.
 */
export const CANON = {
  /** Head template box (20 × 19): skull top row and left column. */
  hx: 12, hy: 9,
  /** Neck and shoulders. */
  neckX: 23, torsoTop: 29, waistY: 37, hipY: 41, legTop: 44,
  /** Near (viewer's left) hand centre and far (raised) hand centre. */
  nearHand: { x: 11, y: 41 },
  farHand: { x: 37, y: 32 },
  /** Lower back, where tails start, and the upper back, where wings start. */
  tail: { x: 18, y: 40 },
  back: { x: 23, y: 31 },
} as const;

/** Seam rows (removed for short bodies, repeated for tall ones) and the seam column of the torso. */
const ROW_SEAMS = [39, 48, 36, 46, 41, 50];
const COL_SEAM = 24;

interface SizeDef { rows: number; cols: number }
/** Rows (negative: removed) and columns added to the canonical body. */
const SIZES: Record<Size, SizeDef> = {
  M: { rows: 0, cols: 0 },
  S: { rows: -5, cols: 0 },
  D: { rows: -3, cols: 2 },
  L: { rows: 3, cols: 2 },
};

export interface Frame {
  size: Size;
  body: 0 | 1;
  /** Target → canonical row / column of the body layer (-1 = empty). */
  rows: number[];
  cols: number[];
  /** Canonical → target. */
  y: (cy: number) => number;
  x: (cx: number) => number;
  /** Head template box (skull top-left), eye row, mouth and chin rows. */
  hx: number;
  hy: number;
  eyeY: number;
  mouthY: number;
  chinY: number;
  /** Head crop for portraits and tokens (square, 24×24). */
  bust: Rect;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

function seamMap(len: number, delta: number, seams: readonly number[], anchorEnd: boolean): number[] {
  // Canonical indices, with seams removed or repeated, aligned to the end (rows: feet stay put).
  let list = Array.from({ length: len }, (_, i) => i);
  if (delta < 0) {
    const drop = new Set(seams.slice(0, -delta));
    list = list.filter((i) => !drop.has(i));
  } else if (delta > 0) {
    const dup = seams.slice(0, delta);
    list = list.flatMap((i) => (dup.includes(i) ? [i, i] : [i]));
  }
  const out = new Array(len).fill(-1);
  if (anchorEnd) {
    const shift = len - list.length;
    list.forEach((src, i) => { const t = i + shift; if (t >= 0 && t < len) out[t] = src; });
  } else {
    list.forEach((src, i) => { if (i < len) out[i] = src; });
  }
  return out;
}

/** Inverse lookup: target position of a canonical index (first match, or nearest). */
function inverse(map: number[]) {
  return (c: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let t = 0; t < map.length; t++) {
      if (map[t] < 0) continue;
      const d = Math.abs(map[t] - c);
      if (d < bestD) { bestD = d; best = t; }
      if (d === 0) return t;
    }
    return best;
  };
}

const frames = new Map<string, Frame>();

export function makeFrame(size: Size, body: 0 | 1): Frame {
  const key = `${size}${body}`;
  const hit = frames.get(key);
  if (hit) return hit;
  const s = SIZES[size];
  const rows = seamMap(H, s.rows, ROW_SEAMS, true);
  // Columns: body B removes the seam column; stocky and large bodies repeat it. The seam is in the
  // middle of the torso, so content left of it stays and content right of it moves.
  const colDelta = s.cols - body;
  let cols: number[];
  if (colDelta === 0) cols = Array.from({ length: W }, (_, i) => i);
  else if (colDelta < 0) cols = Array.from({ length: W }, (_, i) => (i < COL_SEAM ? i : i + 1 < W ? i + 1 : -1));
  else cols = Array.from({ length: W }, (_, i) => (i <= COL_SEAM ? i : i - colDelta <= COL_SEAM ? COL_SEAM : i - colDelta));
  const y = inverse(rows);
  const x = inverse(cols);
  // The head sits on the neck: it follows the shift of the torso top.
  const dy = y(CANON.torsoTop) - CANON.torsoTop;
  const dx = x(CANON.neckX) - CANON.neckX;
  const hx = CANON.hx + dx;
  const hy = CANON.hy + dy;
  const f: Frame = {
    size, body, rows, cols, y, x,
    hx, hy,
    eyeY: hy + 9,
    mouthY: hy + 16,
    chinY: hy + 18,
    bust: r(hx + 1, Math.max(0, hy - 4), 24, 24),
  };
  frames.set(key, f);
  return f;
}
