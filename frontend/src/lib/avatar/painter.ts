/* Pixel buffer + body frames for the chibi avatar (48×56, facing the viewer, feet on row 52).
   openspec/specs/character-appearance.md, "Art direction". */
import type { HeadType, Size } from './types';

export const W = 48;
export const H = 56;
/** Feet rest on this row for every body size. */
export const FOOT_Y = 52;

export interface Rect { x: number; y: number; w: number; h: number }

/** Mirror of column x around the vertical axis (between columns 23 and 24). */
export const mx = (x: number) => W - 1 - x;

export class Painter {
  readonly px: (string | null)[] = new Array(W * H).fill(null);
  /** What each pixel belongs to ("skin", "hair", "cloth"…), for cast shadows and contours. */
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

  /** Same pixels on both sides of the vertical axis. */
  sym(points: [number, number][], c: string) {
    for (const [x, y] of points) { this.set(x, y, c); this.set(mx(x), y, c); }
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
}

export interface Frame {
  size: Size;
  body: 0 | 1;
  /** Skull top row; the skull is 20 px wide and 19 rows tall for every size. */
  hy: number;
  /** Head bounding box (skull only, without hair). */
  head: Rect;
  /** Top row (lash) of the eyes; eyes are 4×4 at columns 17–20 and 27–30. */
  eyeY: number;
  mouthY: number;
  chinY: number;
  torsoTop: number;
  /** Last row of the torso (hips). */
  torsoBottom: number;
  waistY: number;
  /** Viewer's left arm (the right one is its mirror). Includes the hand rows at the bottom. */
  arm: Rect;
  handH: number;
  /** Viewer's left leg down to the ankle (feet are drawn on rows FOOT_Y-1…FOOT_Y). */
  leg: Rect;
  /** Horizontal extent of the torso on row y. */
  span: (y: number) => [number, number];
  /** Head crop for portraits and tokens (square, 24×24). */
  bust: Rect;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/**
 * Half widths of the skull, top to chin (19 rows). The cranium (mostly under the hair) is round; the
 * face is not: straight sides at the eyes, a jawline tapering one pixel per row and a 4-px chin.
 */
export const HEAD_PROFILE: readonly number[] = [5, 7, 8, 9, 9, 10, 10, 10, 10, 9, 9, 8, 8, 8, 7, 6, 5, 4, 2];

/** Non-human heads keep their own silhouettes (character-appearance.md, "Face"). */
export const HEAD_PROFILES: Record<HeadType, readonly number[]> = {
  human: HEAD_PROFILE,
  insect: HEAD_PROFILE,
  skull: HEAD_PROFILE,
  ooze: HEAD_PROFILE,
  // Broad cheeks (with fur tufts added on top) and a blunt jaw for the muzzle.
  beast: [5, 7, 8, 9, 9, 10, 10, 10, 10, 10, 10, 10, 9, 9, 8, 8, 7, 6, 4],
  elephant: [5, 7, 8, 9, 9, 10, 10, 10, 10, 10, 10, 10, 9, 9, 8, 8, 7, 6, 4],
  beak: [5, 7, 8, 9, 9, 10, 10, 10, 10, 10, 9, 9, 9, 8, 8, 7, 6, 5, 3],
  // The reptile snout and the fish jaw are drawn wider than the skull on purpose: boxy, not round.
  reptile: [5, 7, 8, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 8, 6, 4],
  fish: [5, 7, 8, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9, 9, 8, 7],
  frog: HEAD_PROFILE,
};

/** Columns [x1, x2] of the skull on row y (or null above/below it). */
export function headSpan(f: Frame, y: number, profile: readonly number[] = HEAD_PROFILE): [number, number] | null {
  const hw = profile[y - f.hy];
  return hw === undefined ? null : [24 - hw, 23 + hw];
}

interface SizeDef {
  hy: number; torsoTop: number; torsoBottom: number;
  shoulder: number; waist: number; hip: number;
  armW: number; armLen: number; legW: number;
}

const SIZES: Record<Size, SizeDef> = {
  M: { hy: 11, torsoTop: 31, torsoBottom: 41, shoulder: 6, waist: 5, hip: 5, armW: 3, armLen: 9, legW: 4 },
  S: { hy: 16, torsoTop: 36, torsoBottom: 43, shoulder: 5, waist: 5, hip: 5, armW: 3, armLen: 7, legW: 4 },
  D: { hy: 14, torsoTop: 34, torsoBottom: 43, shoulder: 8, waist: 7, hip: 7, armW: 4, armLen: 8, legW: 5 },
  L: { hy: 7, torsoTop: 27, torsoBottom: 39, shoulder: 8, waist: 6, hip: 7, armW: 4, armLen: 11, legW: 5 },
};

export function makeFrame(size: Size, body: 0 | 1): Frame {
  const s = SIZES[size];
  const slim = body === 1 ? 1 : 0;
  const shoulder = s.shoulder - slim;
  const waist = s.waist - slim;
  const hip = s.hip;
  const waistY = s.torsoTop + Math.round((s.torsoBottom - s.torsoTop) * 0.55);
  const span = (y: number): [number, number] => {
    let hw: number;
    if (y <= s.torsoTop) hw = shoulder - 1;
    else if (y <= waistY) hw = Math.round(shoulder + (waist - shoulder) * ((y - s.torsoTop) / Math.max(1, waistY - s.torsoTop)));
    else hw = Math.round(waist + (hip - waist) * ((y - waistY) / Math.max(1, s.torsoBottom - waistY)));
    return [24 - hw, 23 + hw];
  };
  const handH = 2;
  const armX = 24 - shoulder - s.armW;
  const legTop = s.torsoBottom + 1;
  const legX = 24 - 1 - s.legW;
  return {
    size, body,
    hy: s.hy,
    head: r(14, s.hy, 20, HEAD_PROFILE.length),
    eyeY: s.hy + 10,
    mouthY: s.hy + 16,
    chinY: s.hy + HEAD_PROFILE.length - 1,
    torsoTop: s.torsoTop,
    torsoBottom: s.torsoBottom,
    waistY,
    arm: r(armX, s.torsoTop, s.armW, s.armLen + handH),
    handH,
    leg: r(legX, legTop, s.legW, FOOT_Y - 1 - legTop),
    span,
    bust: r(12, Math.max(0, s.hy - 5), 24, 24),
  };
}
