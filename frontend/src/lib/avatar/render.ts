/* Composes the avatar layers into pixels, adds the outline and the class aura. */
import { alphaOf, hexToRgb, mix, shade } from './color';
import { H, Painter, W, makeFrame, type Rect } from './painter';
import { drawBackLimbs, drawFace, drawFrontArm, drawHead, drawPlainEar, drawTorsoAndFrontLeg } from './sprites/body';
import type { DrawCtx } from './sprites/context';
import { drawFeatures } from './sprites/features';
import { drawHairBack, drawHairFront } from './sprites/hair';
import { drawOutfitBack, drawOutfitBackLimbs, drawOutfitBody, drawOutfitFrontArm } from './sprites/outfits';
import type { Appearance, Part, RaceVisual } from './types';

export { W as AVATAR_W, H as AVATAR_H };

const ELEMENT_HAIR: Part[] = ['flame-hair', 'water-hair', 'stone-hair', 'air-hair', 'mushroom-cap'];

function paint(a: Appearance, v: RaceVisual): Painter {
  const p = new Painter();
  const f = makeFrame(v.size, a.body);
  const parts = new Set<Part>([...v.base, ...(v.options[a.feature]?.parts ?? v.options[0]?.parts ?? [])]);
  const c: DrawCtx = { p, f, a, v, parts, skin: a.skin, skinDark: shade(a.skin, 0.78), hair: a.hairColor };
  const hasHair = v.hair && a.hair > 0 && !ELEMENT_HAIR.some((e) => parts.has(e));

  drawFeatures(c, 'back');
  drawOutfitBack(c);
  if (hasHair) drawHairBack(c);
  drawBackLimbs(c);
  drawOutfitBackLimbs(c);
  drawTorsoAndFrontLeg(c);
  drawOutfitBody(c);
  drawFeatures(c, 'mid');
  drawHead(c);
  drawFeatures(c, 'skin');
  drawPlainEar(c);
  if (hasHair) drawHairFront(c);
  drawFeatures(c, 'head');
  drawFace(c);
  drawFeatures(c, 'face');
  drawFrontArm(c);
  drawOutfitFrontArm(c);
  // A darker back edge separates the front arm from the torso behind it.
  const arm = f.frontArm;
  for (let y = arm.y + 1; y < arm.y + arm.h; y++) {
    const col = p.get(arm.x, y);
    if (col) p.set(arm.x, y, shade(col.slice(0, 7), 0.8));
  }
  return p;
}

const OUTLINE_INK = '#120c0c';
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8: [number, number][] = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

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

  // Outline: empty pixels touching the sprite take a darkened version of their neighbour.
  const outline: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (filled[i]) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        const n = inside(nx, ny) ? px[ny * W + nx] : null;
        if (n && alphaOf(n) > 150) {
          put(i, mix(n.slice(0, 7), OUTLINE_INK, 0.68));
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

/** Cached 32×48 canvas of the full avatar. */
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
