/* Composes the avatar layers into pixels, adds the outline and the class aura
   (openspec/specs/character-appearance.md). */
import { alphaOf, hexToRgb, mix, ramp } from './color';
import { H, Painter, W, makeFrame, type Rect } from './painter';
import { castHairShadow, drawBody, drawFace, drawHead, drawPlainEar } from './sprites/body';
import type { DrawCtx } from './sprites/context';
import { drawFeatures } from './sprites/features';
import { drawHairBack, drawHairFront } from './sprites/hair';
import { drawOutfitBack, drawOutfitBody } from './sprites/outfits';
import type { Appearance, Part, RaceVisual } from './types';

export { W as AVATAR_W, H as AVATAR_H };

const ELEMENT_HAIR: Part[] = ['flame-hair', 'water-hair', 'stone-hair', 'air-hair', 'mushroom-cap'];

function paint(a: Appearance, v: RaceVisual): Painter {
  const p = new Painter();
  const f = makeFrame(v.size, a.body);
  const parts = new Set<Part>([...v.base, ...(v.options[a.feature]?.parts ?? v.options[0]?.parts ?? [])]);
  const c: DrawCtx = {
    p, f, a, v, parts,
    skin: ramp(a.skin), hair: ramp(a.hairColor), eyes: ramp(a.eyes),
    cloth: [ramp(a.outfitColors[0]), ramp(a.outfitColors[1])],
  };
  const hasHair = v.hair && !ELEMENT_HAIR.some((e) => parts.has(e));

  drawFeatures(c, 'back');
  drawOutfitBack(c);
  if (hasHair) drawHairBack(c);
  drawBody(c);
  drawOutfitBody(c);
  drawHead(c);
  drawFeatures(c, 'skin');
  drawPlainEar(c);
  drawFace(c);
  drawFeatures(c, 'face');
  if (hasHair) drawHairFront(c);
  castHairShadow(c);
  drawFeatures(c, 'head');
  return p;
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8: [number, number][] = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const OUTLINE_INK = '#160f1a';

/** RGBA pixels (W×H) with a dark outline and, when given, a two-pixel aura of that colour. */
export function renderPixels(a: Appearance, v: RaceVisual, aura?: string | null): Uint8ClampedArray<ArrayBuffer> {
  const { px } = paint(a, v);
  const out = new Uint8ClampedArray(W * H * 4);
  const filled = new Uint8Array(W * H);
  const put = (i: number, hex: string, alpha = alphaOf(hex)) => {
    const [r, g, b] = hexToRgb(hex);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = alpha;
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  px.forEach((c, i) => { if (c) { put(i, c); filled[i] = 1; } });

  // Outline: empty pixels touching the sprite take a very dark tint of their neighbour.
  const outline: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (filled[i]) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        const n = inside(nx, ny) ? px[ny * W + nx] : null;
        if (n && alphaOf(n) > 150) {
          put(i, mix(n.slice(0, 7), OUTLINE_INK, 0.8));
          outline.push(i);
          break;
        }
      }
    }
  }
  for (const i of outline) filled[i] = 2;

  if (aura) {
    const ring = (from: number, alpha: number) => {
      const next: number[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (filled[i]) continue;
          if (N8.some(([dx, dy]) => inside(x + dx, y + dy) && filled[(y + dy) * W + x + dx] === from)) {
            next.push(i);
          }
        }
      }
      for (const i of next) { put(i, aura, alpha); filled[i] = from + 1; }
    };
    ring(2, 170);
    ring(3, 70);
  }
  return out;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Cached 48×56 canvas of the full avatar. */
export function avatarCanvas(a: Appearance, v: RaceVisual, aura?: string | null): HTMLCanvasElement {
  const key = `${v.key}|${v.size}|${aura ?? ''}|${JSON.stringify(a)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(new ImageData(renderPixels(a, v, aura), W, H), 0, 0);
  if (cache.size > 400) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

/** Full sprite, or the 24×24 head crop used by portraits and tokens. */
export function cropRect(v: RaceVisual, a: Appearance, crop: 'full' | 'bust'): Rect {
  return crop === 'bust' ? makeFrame(v.size, a.body).bust : { x: 0, y: 0, w: W, h: H };
}

/** Draws the avatar into another canvas without smoothing (VTT tokens). */
export function drawAvatarInto(
  ctx: CanvasRenderingContext2D, a: Appearance, v: RaceVisual, aura: string | null,
  crop: 'full' | 'bust', dx: number, dy: number, dw: number, dh: number,
) {
  const src = avatarCanvas(a, v, aura);
  const r = cropRect(v, a, crop);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, r.x, r.y, r.w, r.h, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = smoothing;
}
