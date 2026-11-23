/* Sprite layers and metrics (contratos/T-1-sprite-base-hd2d.md, openspec/specs/character-appearance.md
   § Art direction → Metrics). Both come from the same single paint as renderPixels; they are meant for
   tests and tools, never for per-frame UI work. */
import { H, W } from './painter';

export { templateCompileCount } from './painter';
export { rgbaCacheSize } from './render';
import { compose, type PaintMeta } from './render';
import type { Prop } from './sprites/props';
import type { Appearance, RaceVisual } from './types';

export interface Box { x: number; y: number; w: number; h: number }
export type Tag = 'hair' | 'hair-back' | 'face' | 'skin' | 'eye' | 'cloth' | 'trim' | 'flow' | 'prop' | 'part' | 'shade' | 'outline' | 'aura';
export interface SpriteLayers {
  /** RGBA 48×56, identical to renderPixels(a, v, aura, prop). */
  px: Uint8ClampedArray;
  /** One tag per pixel (null = transparent). */
  tags: (Tag | null)[];
}
export interface SpriteMetrics {
  /** Box of the opaque pixels without prop or aura (outline included). */
  figure: Box;
  /** Head: head skin ('face'), eyes and hair above the chin. */
  head: Box;
  /** Visible skin of the face plane (under the bangs, without ears or scalp). */
  face: Box;
  /** One box per visible eye, left to right. */
  eyes: Box[];
  /** Box of 'hair' + 'hair-back' (null when bald). */
  hair: Box | null;
  /** Last row with boot pixels (outline excluded). */
  feetRow: number;
}

export function renderLayers(a: Appearance, v: RaceVisual, aura?: string | null, prop?: Prop | null): SpriteLayers {
  const { px, tags } = compose(a, v, aura ?? null, prop ?? null);
  return { px, tags };
}

/** Accumulates a bounding box. */
class Bounds {
  x0 = W; y0 = H; x1 = -1; y1 = -1;
  add(x: number, y: number) {
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
  }
  box(): Box | null {
    return this.x1 < 0 ? null : { x: this.x0, y: this.y0, w: this.x1 - this.x0 + 1, h: this.y1 - this.y0 + 1 };
  }
}

const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };

/** 8-connected groups of `eye` pixels, left to right (then top to bottom). */
function eyeGroups(tags: readonly (Tag | null)[]): Box[] {
  const seen = new Uint8Array(W * H);
  const out: Box[] = [];
  const stack: number[] = [];
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || tags[start] !== 'eye') continue;
    const b = new Bounds();
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % W;
      const y = (i - x) / W;
      b.add(x, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!seen[j] && tags[j] === 'eye') { seen[j] = 1; stack.push(j); }
        }
      }
    }
    out.push(b.box() as Box);
  }
  return out.sort((p, q) => p.x - q.x || p.y - q.y);
}

/** Figure, head, face, eye and hair boxes and the feet row of the sprite without prop or aura. */
export function spriteMetrics(a: Appearance, v: RaceVisual): SpriteMetrics {
  const meta: PaintMeta = { face: EMPTY, feetRow: -1 };
  const { px, tags } = compose(a, v, null, null, meta);
  // The chin is the last row of the face plane; long hair below it does not count as head.
  const chin = meta.face.h ? meta.face.y + meta.face.h - 1 : H - 1;
  const figure = new Bounds();
  const head = new Bounds();
  const hair = new Bounds();
  for (let i = 0; i < W * H; i++) {
    if (px[i * 4 + 3] === 0) continue;
    const x = i % W;
    const y = (i - x) / W;
    figure.add(x, y);
    const t = tags[i];
    if (t === 'hair' || t === 'hair-back') {
      hair.add(x, y);
      if (y <= chin) head.add(x, y);
    } else if (t === 'face' || t === 'eye') head.add(x, y);
  }
  return {
    figure: figure.box() ?? EMPTY,
    head: head.box() ?? EMPTY,
    face: meta.face,
    eyes: eyeGroups(tags),
    hair: hair.box(),
    feetRow: meta.feetRow,
  };
}
