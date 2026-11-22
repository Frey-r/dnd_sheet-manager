/* Composes the avatar layers into pixels, adds the selective outline and the class aura
   (openspec/specs/character-appearance.md). */
import { alphaOf, hexToHsl, hexToRgb, hslToHex } from './color';
import { H, Painter, W, makeFrame, type Rect } from './painter';
import { castHairShadow, drawFace, drawHands, drawHead, drawNeck, drawPlainEar } from './sprites/body';
import type { DrawCtx } from './sprites/context';
import { drawFeatures } from './sprites/features';
import { drawHairBack, drawHairFront } from './sprites/hair';
import { drawOutfitBack, drawOutfitBody } from './sprites/outfits';
import { drawProp, propForClass, type Prop } from './sprites/props';
import { ramp } from './color';
import type { Appearance, Part, RaceVisual } from './types';

export { W as AVATAR_W, H as AVATAR_H };
export { propForClass };

const ELEMENT_HAIR: Part[] = ['flame-hair', 'water-hair', 'stone-hair', 'air-hair', 'mushroom-cap'];

function paint(a: Appearance, v: RaceVisual, aura: string | null, prop: Prop | null): Painter {
  const p = new Painter();
  const f = makeFrame(v.size, a.body);
  const parts = new Set<Part>([...v.base, ...(v.options[a.feature]?.parts ?? v.options[0]?.parts ?? [])]);
  const c: DrawCtx = {
    p, f, a, v, parts, aura,
    skin: ramp(a.skin), hair: ramp(a.hairColor), eyes: ramp(a.eyes),
    cloth: [ramp(a.outfitColors[0]), ramp(a.outfitColors[1])],
  };
  const hasHair = v.hair && !ELEMENT_HAIR.some((e) => parts.has(e));

  // Body layers are drawn in canonical (medium) coordinates, then resized for the real body.
  const back = new Painter();
  const front = new Painter();
  drawFeatures(c, 'body-back', back);
  drawOutfitBack(c, back);
  drawNeck(c, front);
  drawOutfitBody(c, front);
  if (prop) drawProp(front, prop, aura);
  drawHands(c, front);

  p.blit(back, f.rows, f.cols);
  drawFeatures(c, 'back');
  if (hasHair) drawHairBack(c);
  p.blit(front, f.rows, f.cols);
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

/** Materials whose edges are already drawn in their own dark tones (no extra outline), as in the reference. */
const NO_OUTLINE = new Set(['hair', 'hair-back', 'flow']);

/**
 * Outline tone next to a pixel: brown for skin, near black for cloth and props, nothing for hair and
 * flowing cloth or when the edge pixel is already dark.
 */
function outlineOf(hex: string, tag: string | null): string | null {
  if (tag && NO_OUTLINE.has(tag)) return null;
  const [h, s, l] = hexToHsl(hex.slice(0, 7));
  if (l < 0.2) return null;
  if (tag === 'skin' || tag === 'shade') return hslToHex(h, s * 0.55, l * 0.46);
  // Bright saturated props (gold) get a brown outline, like the reference staff.
  if (tag === 'prop' && l > 0.45) return hslToHex(Math.max(0, h - 12), s * 0.55, l * 0.62);
  return hslToHex(h, Math.min(1, s * 0.8), Math.min(0.15, l * 0.3));
}

/**
 * RGBA pixels (W×H): the sprite, a selective outline (only around the outer silhouette, in a dark
 * tint of the neighbouring material, skipped where the edge is already dark) and, when given, a
 * two-pixel aura of that colour.
 */
export function renderPixels(a: Appearance, v: RaceVisual, aura?: string | null, prop: Prop | null = null): Uint8ClampedArray<ArrayBuffer> {
  const { px, tags } = paint(a, v, aura ?? null, prop);
  const out = new Uint8ClampedArray(W * H * 4);
  const filled = new Uint8Array(W * H);
  const put = (i: number, hex: string, alpha = alphaOf(hex)) => {
    const [r, g, b] = hexToRgb(hex);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = alpha;
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  px.forEach((c, i) => { if (c) { put(i, c); filled[i] = 1; } });

  const outline: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (filled[i]) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        const n = inside(nx, ny) ? px[ny * W + nx] : null;
        if (n && alphaOf(n) > 150) {
          const o = outlineOf(n, tags[ny * W + nx]);
          if (o) { put(i, o); outline.push(i); break; }
        }
      }
    }
  }
  for (const i of outline) filled[i] = 1;

  if (aura) {
    const ring = (from: number, alpha: number) => {
      const next: number[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (filled[i]) continue;
          if (N8.some(([dx, dy]) => inside(x + dx, y + dy) && filled[(y + dy) * W + x + dx] === from)) next.push(i);
        }
      }
      for (const i of next) { put(i, aura, alpha); filled[i] = from + 1; }
    };
    ring(1, 150);
    ring(2, 60);
  }
  return out;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Cached 48×56 canvas of the full avatar; `klass` adds the class prop (full sprite only). */
export function avatarCanvas(a: Appearance, v: RaceVisual, aura?: string | null, klass?: string | null): HTMLCanvasElement {
  const prop = propForClass(klass);
  const key = `${v.key}|${v.size}|${aura ?? ''}|${prop ?? ''}|${JSON.stringify(a)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(new ImageData(renderPixels(a, v, aura, prop), W, H), 0, 0);
  if (cache.size > 400) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

/** Full sprite, or the 24×24 head crop used by portraits and tokens. */
export function cropRect(v: RaceVisual, a: Appearance, crop: 'full' | 'bust'): Rect {
  return crop === 'bust' ? makeFrame(v.size, a.body).bust : { x: 0, y: 0, w: W, h: H };
}

/** Draws the avatar head crop or full sprite into another canvas without smoothing (VTT tokens). */
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
