/* Pixel buffer, compiled templates and body frames of the HD-2D avatar: 48×56, front three-quarter view
   turned to the viewer's left, feet on row 53 (openspec/specs/character-appearance.md § Art direction). */
import type { Size } from './types';

export const W = 48;
export const H = 56;
/** Last row of the boots for every body size. */
export const FOOT_Y = 53;

export interface Rect { x: number; y: number; w: number; h: number }

/** A text template compiled once: the cells of each key as x, y pairs (RG-1.4). */
export interface Template {
  readonly w: number;
  readonly h: number;
  readonly keys: readonly string[];
  readonly cells: readonly Uint8Array[];
}

const compiled = new WeakMap<readonly string[], Template>();

/** Compilations done by `tpl` since the module loaded (one increment per cache miss). */
let compiles = 0;

/**
 * Templates compiled so far by `tpl` (tests and tools, RG-1.4): after a first render of every look, a
 * second pass must not raise it, because every template is a module-level array compiled once.
 */
export function templateCompileCount(): number {
  return compiles;
}

/**
 * Compiles a hand-drawn template: each character is a key looked up in the colour map when stamped;
 * '.' and spaces are empty. Module-level row arrays are compiled once and cached.
 */
export function tpl(rows: readonly string[]): Template {
  const hit = compiled.get(rows);
  if (hit) return hit;
  const byKey = new Map<string, number[]>();
  let w = 0;
  rows.forEach((row, y) => {
    if (row.length > w) w = row.length;
    for (let x = 0; x < row.length; x++) {
      const k = row[x];
      if (k === '.' || k === ' ') continue;
      let list = byKey.get(k);
      if (!list) byKey.set(k, (list = []));
      list.push(x, y);
    }
  });
  const t: Template = { w, h: rows.length, keys: [...byKey.keys()], cells: [...byKey.values()].map((l) => Uint8Array.from(l)) };
  compiled.set(rows, t);
  compiles++;
  return t;
}

export type ColorMap = Readonly<Record<string, string | null | undefined>>;

export class Painter {
  readonly px: (string | null)[] = new Array<string | null>(W * H).fill(null);
  /** What each pixel belongs to ('face', 'hair', 'cloth'…): metrics, outlines and cast shadows read it. */
  readonly tags: (string | null)[] = new Array<string | null>(W * H).fill(null);
  /** Tag given to the pixels painted from now on. */
  tag: string | null = null;
  /** While set, coordinates are canonical body coordinates, written through the frame's seams. */
  frame: Frame | null = null;

  /** Empties the buffer so one painter can be reused render after render. */
  reset() {
    this.px.fill(null);
    this.tags.fill(null);
    this.tag = null;
    this.frame = null;
  }

  set(x: number, y: number, c: string | null | undefined) {
    if (!c || x < 0 || y < 0 || x >= W || y >= H) return;
    const f = this.frame;
    if (!f) {
      const i = y * W + x;
      this.px[i] = c;
      this.tags[i] = this.tag;
      return;
    }
    const ys = f.rowsOf[y];
    const xs = f.colsOf[x];
    for (let j = 0; j < ys.length; j++) {
      for (let k = 0; k < xs.length; k++) {
        const i = ys[j] * W + xs[k];
        this.px[i] = c;
        this.tags[i] = this.tag;
      }
    }
  }

  /** Colour at an absolute position (null when empty or outside). */
  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return this.px[y * W + x];
  }

  /** Tag at an absolute position (null when empty or outside). */
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
  dots(points: readonly (readonly [number, number])[], c: string) {
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
   * Stamps a template at (x0, y0). Keys missing from `map` (or mapped to null) are left untouched;
   * `flip` mirrors it horizontally; `tagOf` gives some keys their own tag (trims, ears, boots…).
   */
  stamp(x0: number, y0: number, rows: readonly string[] | Template, map: ColorMap, flip = false, tagOf?: Readonly<Record<string, string>>) {
    const t = 'cells' in rows ? rows : tpl(rows);
    const base = this.tag;
    for (let k = 0; k < t.keys.length; k++) {
      const key = t.keys[k];
      const c = map[key];
      if (!c) continue;
      this.tag = tagOf?.[key] ?? base;
      const cells = t.cells[k];
      for (let n = 0; n < cells.length; n += 2) this.set(flip ? x0 + t.w - 1 - cells[n] : x0 + cells[n], y0 + cells[n + 1], c);
    }
    this.tag = base;
  }
}

/*
 * Canonical body: medium size, body A (broad). Outfits, props and body-attached race parts are drawn in
 * these coordinates and land on the real size through whole rows and columns repeated or removed at
 * fixed seams (character-appearance.md, "Figure and proportions"). The head is never resized.
 */
export const CANON = {
  /** Skull box (15 × 18): left column and top row. */
  hx: 16, hy: 11,
  /** Neck column, shoulder line, belt, hips and the top of the legs. */
  neckX: 22, torsoTop: 29, waistY: 39, hipY: 43, legTop: 43,
  /** Near hand (viewer's right, holds the prop) and far hand, by the hips. */
  nearHand: { x: 35, y: 43 },
  farHand: { x: 12, y: 43 },
  /** Lower back, where tails start, and the upper back, where wings start: the back faces the viewer's
      right in the three-quarter view, so both sit right of the body centre (x 23). */
  tail: { x: 28, y: 42 },
  back: { x: 26, y: 33 },
} as const;

/**
 * Seam rows, in the order they are removed (short bodies) or repeated (tall ones): legs and chest
 * alternate so both change evenly. The seam column runs down the middle of the torso and between the
 * legs, so body B (slim) loses one column there and stocky or large bodies gain two.
 */
const ROW_SEAMS = [45, 34, 47, 42, 44, 33];
const COL_SEAM = 23;

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
  /** Canonical row / column → target rows / columns (empty when the seam removed it). */
  rowsOf: readonly (readonly number[])[];
  colsOf: readonly (readonly number[])[];
  /** Canonical → target (first match), for anchors. */
  y: (cy: number) => number;
  x: (cx: number) => number;
  /** Skull box (top-left), eye row, mouth and chin rows. */
  hx: number;
  hy: number;
  eyeY: number;
  mouthY: number;
  chinY: number;
  /** Head crop for portraits and tokens (square, 24×24). */
  bust: Rect;
}

/** Target → canonical index, seams removed or repeated, aligned to the end (rows: the feet stay put). */
function seamMap(len: number, delta: number, seams: readonly number[], anchorEnd: boolean): number[] {
  let list = Array.from({ length: len }, (_, i) => i);
  if (delta < 0) {
    const drop = new Set(seams.slice(0, -delta));
    list = list.filter((i) => !drop.has(i));
  } else if (delta > 0) {
    const dup = new Set(seams.slice(0, delta));
    list = list.flatMap((i) => (dup.has(i) ? [i, i] : [i]));
  }
  const out = new Array<number>(len).fill(-1);
  const shift = anchorEnd ? len - list.length : 0;
  list.forEach((src, i) => { const t = i + shift; if (t >= 0 && t < len) out[t] = src; });
  return out;
}

/** Canonical index → every target index showing it. */
function invert(map: readonly number[], len: number): number[][] {
  const out = Array.from({ length: len }, () => [] as number[]);
  map.forEach((src, t) => { if (src >= 0) out[src].push(t); });
  return out;
}

/** Target of a canonical index: its first copy, or the nearest kept neighbour when it was removed. */
function anchor(of: readonly (readonly number[])[]) {
  return (c: number) => {
    for (let d = 0; d < of.length; d++) {
      const lo = of[c - d];
      if (lo?.length) return lo[0];
      const hi = of[c + d];
      if (hi?.length) return hi[0];
    }
    return c;
  };
}

const frames = new Map<string, Frame>();

export function makeFrame(size: Size, body: 0 | 1): Frame {
  const key = `${size}${body}`;
  const hit = frames.get(key);
  if (hit) return hit;
  const s = SIZES[size];
  const rows = seamMap(H, s.rows, ROW_SEAMS, true);
  // Content left of the seam column stays put; content right of it moves.
  const colDelta = s.cols - body;
  const cols = colDelta === 0
    ? Array.from({ length: W }, (_, i) => i)
    : colDelta < 0
      ? Array.from({ length: W }, (_, i) => (i < COL_SEAM ? i : i - colDelta < W ? i - colDelta : -1))
      : Array.from({ length: W }, (_, i) => (i <= COL_SEAM ? i : i - colDelta <= COL_SEAM ? COL_SEAM : i - colDelta));
  const rowsOf = invert(rows, H);
  const colsOf = invert(cols, W);
  const y = anchor(rowsOf);
  const x = anchor(colsOf);
  // The head sits on the neck: it follows the shoulder line and the neck column.
  const hx = CANON.hx + x(CANON.neckX) - CANON.neckX;
  const hy = CANON.hy + y(CANON.torsoTop) - CANON.torsoTop;
  const f: Frame = {
    size, body, rowsOf, colsOf, y, x,
    hx, hy,
    eyeY: hy + 10,
    mouthY: hy + 15,
    chinY: hy + 17,
    // Head crop: the top of short hair (hy − 1) and its outline sit 2–3 px inside the top edge, the chin
    // and the collar at the bottom; the face plane centre is 2 px left of the crop centre.
    bust: { x: hx - 5, y: Math.max(0, hy - 4), w: 24, h: 24 },
  };
  frames.set(key, f);
  return f;
}
