/* Pixel buffer + body frames for the avatar (32×48, feet on row 44, facing right). */
import type { Size } from './types';

export const W = 32;
export const H = 48;

export interface Rect { x: number; y: number; w: number; h: number }

export class Painter {
  readonly px: (string | null)[] = new Array(W * H).fill(null);

  set(x: number, y: number, c: string | null | undefined) {
    if (!c || x < 0 || y < 0 || x >= W || y >= H) return;
    this.px[y * W + x] = c;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return this.px[y * W + x];
  }

  clear(x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.px[y * W + x] = null;
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  fill(r: Rect, c: string) { this.rect(r.x, r.y, r.w, r.h, c); }

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

  /** Recolours only pixels that are already painted inside the rect. */
  tint(r: Rect, c: string) {
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) if (this.get(i, j)) this.set(i, j, c);
  }
}

export interface Frame {
  size: Size;
  head: Rect;
  neck: Rect;
  torso: Rect;
  backArm: Rect;
  backHand: Rect;
  frontArm: Rect;
  frontHand: Rect;
  backLeg: Rect;
  frontLeg: Rect;
  backFoot: Rect;
  frontFoot: Rect;
  waistY: number;
  hipY: number;
  /** Horizontal extent of the torso on row y (body B is narrower at shoulders and waist). */
  span: (y: number) => [number, number];
  /** Eye position (white column; iris at x + 1). */
  eye: { x: number; y: number };
  /** Bust crop for portraits and tokens (square). */
  bust: Rect;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

const FRAMES: Record<Size, Omit<Frame, 'span' | 'eye' | 'bust' | 'size'>> = {
  M: {
    head: r(10, 10, 12, 11), neck: r(14, 21, 3, 1), torso: r(12, 22, 8, 11),
    backArm: r(11, 23, 2, 9), backHand: r(11, 32, 2, 1), frontArm: r(15, 22, 3, 10), frontHand: r(16, 32, 2, 2),
    backLeg: r(12, 33, 3, 11), frontLeg: r(16, 33, 3, 11), backFoot: r(12, 44, 4, 1), frontFoot: r(16, 44, 4, 1),
    waistY: 27, hipY: 31,
  },
  S: {
    head: r(10, 19, 12, 10), neck: r(14, 29, 3, 1), torso: r(12, 30, 8, 7),
    backArm: r(11, 31, 2, 5), backHand: r(11, 36, 2, 1), frontArm: r(15, 30, 3, 6), frontHand: r(16, 36, 2, 2),
    backLeg: r(12, 37, 3, 7), frontLeg: r(16, 37, 3, 7), backFoot: r(12, 44, 4, 1), frontFoot: r(16, 44, 4, 1),
    waistY: 33, hipY: 35,
  },
  D: {
    head: r(10, 16, 12, 11), neck: r(14, 27, 3, 1), torso: r(10, 28, 12, 9),
    backArm: r(8, 29, 3, 7), backHand: r(8, 36, 3, 1), frontArm: r(15, 28, 4, 8), frontHand: r(16, 36, 3, 2),
    backLeg: r(11, 37, 4, 7), frontLeg: r(16, 37, 4, 7), backFoot: r(11, 44, 5, 1), frontFoot: r(16, 44, 5, 1),
    waistY: 32, hipY: 35,
  },
  L: {
    head: r(10, 6, 12, 11), neck: r(14, 17, 4, 1), torso: r(11, 18, 11, 14),
    backArm: r(9, 19, 3, 11), backHand: r(9, 30, 3, 2), frontArm: r(15, 18, 4, 12), frontHand: r(16, 30, 3, 2),
    backLeg: r(11, 32, 4, 12), frontLeg: r(17, 32, 4, 12), backFoot: r(11, 44, 5, 1), frontFoot: r(17, 44, 5, 1),
    waistY: 25, hipY: 30,
  },
};

export function makeFrame(size: Size, body: 0 | 1): Frame {
  const f = FRAMES[size];
  const x1 = f.torso.x;
  const x2 = f.torso.x + f.torso.w - 1;
  const span = (y: number): [number, number] => {
    if (body === 1) {
      const chest = f.torso.y + (f.torso.h > 9 ? 3 : 2);
      if (y <= f.torso.y + 1) return [x1 + 1, x2];
      if (y === chest || y === chest + 1) return [x1, x2 + 1];
      if (Math.abs(y - f.waistY) <= 1) return [x1 + 1, x2 - 1];
    }
    return [x1, x2];
  };
  const eye = { x: f.head.x + f.head.w - 4, y: f.head.y + Math.floor(f.head.h * 0.45) };
  const bustY = Math.max(0, f.head.y - 6);
  return { ...f, size, span, eye, bust: r(4, bustY, 24, 24) };
}
