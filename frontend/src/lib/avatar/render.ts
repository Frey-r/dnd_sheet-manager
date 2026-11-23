/* Composes the avatar layers into pixels and tags, adds the complete outline and the class aura
   (openspec/specs/character-appearance.md § Art direction). */
import { ramp } from './color';
import { H, Painter, W, makeFrame, type Rect } from './painter';
import type { Box, Tag } from './metrics';
import { castHairShadow, drawFace, drawHands, drawHead, drawNeck, drawPlainEar } from './sprites/body';
import { INK, type DrawCtx } from './sprites/context';
import { drawFeatures } from './sprites/features';
import { drawHairBack, drawHairFront } from './sprites/hair';
import { drawOutfitBack, drawOutfitBody, drawOutfitFront } from './sprites/outfits';
import { BACK_PROPS, drawProp, propForClass, type Prop } from './sprites/props';
import type { Appearance, Part, RaceVisual } from './types';

export { W as AVATAR_W, H as AVATAR_H };
export { propForClass };

const ELEMENT_HAIR: Part[] = ['flame-hair', 'water-hair', 'stone-hair', 'air-hair', 'mushroom-cap'];

/** One painter reused by every render: renders are synchronous, so it is never shared (RG-1.6). */
const scratch = new Painter();

function paint(a: Appearance, v: RaceVisual, aura: string | null, prop: Prop | null): DrawCtx {
  const p = scratch;
  p.reset();
  const f = makeFrame(v.size, a.body);
  const parts = new Set<Part>([...v.base, ...(v.options[a.feature]?.parts ?? v.options[0]?.parts ?? [])]);
  const c: DrawCtx = {
    p, f, a, v, parts, aura,
    skin: ramp(a.skin), hair: ramp(a.hairColor), eyes: ramp(a.eyes),
    cloth: [ramp(a.outfitColors[0]), ramp(a.outfitColors[1])],
  };
  const hasHair = v.hair && !ELEMENT_HAIR.some((e) => parts.has(e));

  // Body layers are drawn in canonical (medium) coordinates and land on the real size through the
  // frame's seams; the head and the hair are drawn in absolute coordinates.
  p.frame = f;
  drawFeatures(c, 'body-back', p);
  drawOutfitBack(c, p);
  if (prop && BACK_PROPS.has(prop)) drawProp(p, prop, aura);
  p.frame = null;
  drawFeatures(c, 'back');
  if (hasHair) drawHairBack(c);
  p.frame = f;
  drawNeck(c, p);
  drawOutfitBody(c, p);
  if (prop && !BACK_PROPS.has(prop)) drawProp(p, prop, aura);
  drawOutfitFront(c, p);
  drawHands(c, p);
  p.frame = null;
  drawHead(c);
  drawFeatures(c, 'skin');
  drawPlainEar(c);
  drawFace(c);
  drawFeatures(c, 'face');
  if (hasHair) drawHairFront(c);
  castHairShadow(c);
  drawFeatures(c, 'head');
  return c;
}

/** Painter tags → public tags (metrics.ts, Tag). Race parts ('part-head'…) are 'part'. */
const TAG_OF: Readonly<Record<string, Tag>> = {
  face: 'face', ear: 'face', scalp: 'face', skin: 'skin', eye: 'eye',
  hair: 'hair', 'hair-back': 'hair-back', cloth: 'cloth', boot: 'cloth', trim: 'trim', flow: 'flow',
  prop: 'prop', shade: 'shade', outline: 'outline', aura: 'aura',
};
const publicTag = (t: string | null): Tag => (t && TAG_OF[t]) || 'part';

/** Packed RGBA of a "#rrggbb" or "#rrggbbaa" colour, cached (bounded). */
const rgbaCache = new Map<string, number>();
function rgba(hex: string): number {
  let n = rgbaCache.get(hex);
  if (n === undefined) {
    const h = hex.slice(1);
    n = (parseInt(h.slice(0, 6), 16) * 256 + (h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255)) >>> 0;
    if (rgbaCache.size > 4096) rgbaCache.clear();
    rgbaCache.set(hex, n);
  }
  return n;
}

/** Entries in the colour cache (tests and tools; bounded at 4097). */
export function rgbaCacheSize(): number {
  return rgbaCache.size;
}

function put(out: Uint8ClampedArray, i: number, c: number, alpha = c & 255) {
  const o = i * 4;
  out[o] = c >>> 24;
  out[o + 1] = (c >>> 16) & 255;
  out[o + 2] = (c >>> 8) & 255;
  out[o + 3] = alpha;
}

/** Box of the visible face plane and the boot pixels, read from the painter tags (spriteMetrics). */
export interface PaintMeta { face: Box; feetRow: number }

export interface Composed {
  px: Uint8ClampedArray<ArrayBuffer>;
  tags: (Tag | null)[];
}

const N4: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
/** Aura ring level of each pixel (0 = none), reused between renders. */
const ring = new Uint8Array(W * H);

/** Every transparent pixel touching the sprite (4-neighbourhood) becomes the 1-px near-black outline. */
function outline(src: readonly (string | null)[], out: Uint8ClampedArray, tags: (Tag | null)[]) {
  const ink = rgba(INK);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (src[i]) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        // Columns must not wrap into the next row; rows outside the canvas read as empty (undefined).
        if (nx < 0 || nx >= W || !src[(y + dy) * W + nx]) continue;
        put(out, i, ink);
        tags[i] = 'outline';
        break;
      }
    }
  }
}

/** Two fading rings of the class colour (8-neighbourhood) around the outlined sprite. */
function aura(out: Uint8ClampedArray, tags: (Tag | null)[], hex: string) {
  const col = rgba(hex);
  ring.fill(0);
  for (const [level, alpha] of [[1, 150], [2, 60]] as const) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (tags[i]) continue;
        search: for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            // Ring 1 hugs the sprite; ring 2 hugs ring 1 (still untagged while this pass runs).
            if (level === 1 ? tags[j] !== null : ring[j] === 1) { ring[i] = level; break search; }
          }
        }
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (ring[i] !== level || tags[i]) continue;
      put(out, i, col, alpha);
      tags[i] = 'aura';
    }
  }
}

/**
 * Paints once and returns the RGBA pixels and one public tag per pixel, with the complete outline and,
 * when given, the aura. When `meta` is given it receives the face-plane box and the last boot row.
 */
export function compose(a: Appearance, v: RaceVisual, auraColor: string | null, prop: Prop | null, meta?: PaintMeta): Composed {
  const { px: src, tags: srcTags } = paint(a, v, auraColor, prop).p;
  const out = new Uint8ClampedArray(W * H * 4);
  const tags = new Array<Tag | null>(W * H).fill(null);
  let fx0 = W, fy0 = H, fx1 = -1, fy1 = -1, feet = -1;
  for (let i = 0; i < W * H; i++) {
    const hex = src[i];
    if (!hex) continue;
    put(out, i, rgba(hex));
    const t = srcTags[i];
    tags[i] = publicTag(t);
    if (!meta) continue;
    const x = i % W;
    const y = (i - x) / W;
    if (t === 'face') {
      if (x < fx0) fx0 = x;
      if (x > fx1) fx1 = x;
      if (y < fy0) fy0 = y;
      if (y > fy1) fy1 = y;
    } else if (t === 'boot' && y > feet) feet = y;
  }
  if (meta) {
    meta.face = fx1 < 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: fx0, y: fy0, w: fx1 - fx0 + 1, h: fy1 - fy0 + 1 };
    meta.feetRow = feet;
  }
  outline(src, out, tags);
  if (auraColor) aura(out, tags, auraColor);
  return { px: out, tags };
}

/** RGBA pixels (W×H) of the avatar: the sprite, its complete outline and, when given, the aura. */
export function renderPixels(a: Appearance, v: RaceVisual, aura?: string | null, prop: Prop | null = null): Uint8ClampedArray<ArrayBuffer> {
  return compose(a, v, aura ?? null, prop ?? null).px;
}

/** Canvases kept: the creator shows ~277 races × 2 bodies as thumbnails; ~10,7 KB each, ≤ ~8,6 MB. */
const CACHE_MAX = 800;
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
  if (cache.size >= CACHE_MAX) cache.clear();
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
