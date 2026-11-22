/* Sensores compartidos de los tests del sprite HD-2D (contratos/T-1…T-4). Miden píxeles y etiquetas;
   no contienen lógica de producción. Bloqueado junto con los tests de T-1. */
import {
  CLOTH, HAIR, SKIN, defaultAppearance, propForClass, resolveRaceVisual,
  type Appearance, type Box, type RaceVisual, type Size, type Tag,
} from '..';
import { AVATAR_H, AVATAR_W } from '../render';
import type { Prop } from '../sprites/props';

export const W = AVATAR_W;
export const H = AVATAR_H;

export const PROPS: Prop[] = ['staff', 'sword', 'axe', 'bow', 'dagger', 'mace', 'lute', 'hammer'];
export const PROPS_AND_NONE: (Prop | null)[] = [null, ...PROPS];
export const SIZES: Size[] = ['S', 'D', 'M', 'L'];
export const BODIES: (0 | 1)[] = [0, 1];

/** Píxeles y etiquetas de un render (SpriteLayers sin depender de su tipo exacto). */
export interface Layers { px: ArrayLike<number>; tags: readonly (Tag | null)[] }

export const humanVisual = (): RaceVisual => resolveRaceVisual('Human');
/** Base de los contratos: `{ ...defaultAppearance(Human), hair: 1 }` más el parche. */
export const baseAppearance = (patch: Partial<Appearance> = {}): Appearance =>
  ({ ...defaultAppearance(humanVisual()), hair: 1, ...patch });
/** La misma familia con otra talla. */
export const sized = (v: RaceVisual, size: Size): RaceVisual => ({ ...v, size });

// ── Color ──────────────────────────────────────────────────────────────────────────────────────

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
/** Luminancia relativa sRGB (0–1). */
export const luminance = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
/** Luminancia del píxel `i` (índice de píxel, no de byte). */
export const lumAt = (px: ArrayLike<number>, i: number) => luminance(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
/** Opaco = alfa > 0 (todo lo visible); transparente = alfa 0. */
export const isOpaque = (px: ArrayLike<number>, i: number) => px[i * 4 + 3] > 0;
/** Clave RGBA numérica del píxel `i`. */
export const colorKey = (px: ArrayLike<number>, i: number) =>
  ((px[i * 4] * 256 + px[i * 4 + 1]) * 256 + px[i * 4 + 2]) * 256 + px[i * 4 + 3];
/** Clave RGB de un color "#rrggbb". */
export const rgbKeyOfHex = (hex: string) => parseInt(hex.slice(1, 7), 16);
/** Clave RGB del píxel `i`. */
export const rgbKeyAt = (px: ArrayLike<number>, i: number) => (px[i * 4] * 256 + px[i * 4 + 1]) * 256 + px[i * 4 + 2];

export function opaqueCount(px: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < W * H; i++) if (isOpaque(px, i)) n++;
  return n;
}

/** Colores opacos distintos (RGBA), opcionalmente solo en los píxeles que cumplen `only`. */
export function distinctColors(px: ArrayLike<number>, only?: (i: number) => boolean): number {
  const seen = new Set<number>();
  for (let i = 0; i < W * H; i++) if (isOpaque(px, i) && (!only || only(i))) seen.add(colorKey(px, i));
  return seen.size;
}

/** Píxeles cuyo RGBA difiere entre dos renders. */
export function diffCount(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2] || a[o + 3] !== b[o + 3]) n++;
  }
  return n;
}

/** Bytes distintos entre dos buffers (y diferencia de longitud). */
export function byteDiff(a: ArrayLike<number>, b: ArrayLike<number>): string | null {
  if (a.length !== b.length) return `longitudes ${a.length} ≠ ${b.length}`;
  let n = 0;
  let first = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { n++; if (first < 0) first = i; }
  return n ? `${n} bytes distintos (el primero en el píxel ${Math.floor(first / 4)})` : null;
}

// ── Cajas y máscaras ───────────────────────────────────────────────────────────────────────────

export function bboxWhere(pred: (i: number) => boolean): Box | null {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!pred(y * W + x)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const opaqueBox = (px: ArrayLike<number>) => bboxWhere((i) => isOpaque(px, i));

export function tagBox(tags: readonly (Tag | null)[], set: readonly Tag[]): Box | null {
  return bboxWhere((i) => tags[i] !== null && set.includes(tags[i] as Tag));
}

export function countTag(tags: readonly (Tag | null)[], set: readonly Tag[]): number {
  let n = 0;
  for (const t of tags) if (t !== null && set.includes(t)) n++;
  return n;
}

/** Diferencia simétrica de dos máscaras de etiquetas. */
export function maskDiff(a: readonly (Tag | null)[], b: readonly (Tag | null)[], set: readonly Tag[]): number {
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    const ia = a[i] !== null && set.includes(a[i] as Tag);
    const ib = b[i] !== null && set.includes(b[i] as Tag);
    if (ia !== ib) n++;
  }
  return n;
}

/** Componentes 8-conexas de los píxeles con la etiqueta, ordenadas de izquierda a derecha. */
export function components(tags: readonly (Tag | null)[], tag: Tag): Box[] {
  const seen = new Uint8Array(W * H);
  const out: Box[] = [];
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || tags[start] !== tag) continue;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % W, y = (i - x) / W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!seen[j] && tags[j] === tag) { seen[j] = 1; stack.push(j); }
        }
      }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

/** Ojos medidos desde las etiquetas `eye` (un box por grupo de píxeles). */
export const eyeBoxes = (tags: readonly (Tag | null)[]) => components(tags, 'eye');

export const sameBox = (a: Box | null | undefined, b: Box | null | undefined) =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const contains = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/** La caja (no vacía) cabe en el lienzo dejando `m` píxeles libres por lado. */
export const fitsWithMargin = (b: Box, m = 1) =>
  b.w > 0 && b.h > 0 && b.x >= m && b.y >= m && b.x + b.w <= W - m && b.y + b.h <= H - m;

/** Bordes de una caja ajustada que no tocan ningún píxel que cumpla `pred` (vacío = caja ajustada). */
export function edgesLacking(b: Box, pred: (i: number) => boolean): string[] {
  if (b.w <= 0 || b.h <= 0) return ['caja vacía'];
  const row = (y: number) => { for (let x = b.x; x < b.x + b.w; x++) if (pred(y * W + x)) return true; return false; };
  const col = (x: number) => { for (let y = b.y; y < b.y + b.h; y++) if (pred(y * W + x)) return true; return false; };
  const out: string[] = [];
  if (!row(b.y)) out.push('arriba');
  if (!row(b.y + b.h - 1)) out.push('abajo');
  if (!col(b.x)) out.push('izquierda');
  if (!col(b.x + b.w - 1)) out.push('derecha');
  return out;
}

/** Columnas [desde, hasta) de cada mitad de una caja; con ancho impar se excluye la columna central. */
export function halves(b: Box): { left: [number, number]; right: [number, number] } {
  const half = Math.floor(b.w / 2);
  return { left: [b.x, b.x + half], right: [b.x + b.w - half, b.x + b.w] };
}

export const fmt = (b: Box | null | undefined) => (b ? `{x:${b.x},y:${b.y},w:${b.w},h:${b.h}}` : String(b));

/** Lista de fallos acotada para el mensaje de la aserción. */
export const report = (bad: string[], max = 25) =>
  bad.length > max ? [...bad.slice(0, max), `… y ${bad.length - max} más`] : bad;

// ── Criterios reutilizados ─────────────────────────────────────────────────────────────────────

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * C7: píxeles opacos con un vecino-4 transparente o fuera del lienzo cuya luminancia supera 0.25.
 * Recorre todo el borde de la silueta, sin excepciones.
 */
export function contourViolations(px: ArrayLike<number>, tags?: readonly (Tag | null)[]): string[] {
  const out: string[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isOpaque(px, i)) continue;
      const edge = N4.some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx < 0 || ny < 0 || nx >= W || ny >= H || !isOpaque(px, ny * W + nx);
      });
      if (!edge) continue;
      const l = lumAt(px, i);
      if (l > 0.25) out.push(`(${x},${y}) L=${l.toFixed(2)}${tags ? ` tag=${tags[i]}` : ''}`);
    }
  }
  return out;
}

/** C4: dos ojos de 1–2 × 2–3 px, separados 2–4 px, en la mitad inferior de la cabeza. */
export function c4Violations(eyes: Box[], head: Box): string[] {
  if (eyes.length !== 2) return [`${eyes.length} ojos (se esperan 2): ${eyes.map(fmt).join(' ')}`];
  const out: string[] = [];
  eyes.forEach((e, k) => {
    if (e.w < 1 || e.w > 2) out.push(`ojo ${k} w=${e.w} fuera de [1,2]`);
    if (e.h < 2 || e.h > 3) out.push(`ojo ${k} h=${e.h} fuera de [2,3]`);
    if (e.y < head.y + head.h / 2) out.push(`ojo ${k} y=${e.y} < head.y + head.h/2 = ${head.y + head.h / 2}`);
  });
  const gap = eyes[1].x - (eyes[0].x + eyes[0].w);
  if (gap < 2 || gap > 4) out.push(`separación entre ojos ${gap} fuera de [2,4]`);
  return out;
}

// ── Galería (réplica de `scripts/avatar-sheet.mjs --set gallery`, C8) ──────────────────────────

const LOOKS: { race: string; klass: string; a: Partial<Appearance> }[] = [
  { race: 'Human', klass: 'Fighter', a: { hair: 1, hairColor: HAIR[2], outfit: 8, outfitColors: [CLOTH[6], CLOTH[15]], skin: SKIN.human[2] } },
  { race: 'Elf', klass: 'Wizard', a: { body: 1, hair: 5, hairColor: HAIR[5], outfit: 9, outfitColors: [CLOTH[8], CLOTH[2]], skin: SKIN.elf[1] } },
  { race: 'Dwarf', klass: 'Cleric', a: { hair: 7, hairColor: HAIR[8], outfit: 1, outfitColors: [CLOTH[0], CLOTH[2]] } },
  { race: 'Halfling', klass: 'Rogue', a: { body: 1, hair: 9, hairColor: HAIR[3], outfit: 7, outfitColors: [CLOTH[4], CLOTH[10]] } },
  { race: 'Tiefling', klass: 'Warlock', a: { body: 1, hair: 11, hairColor: HAIR[0], outfit: 5, outfitColors: [CLOTH[12], CLOTH[9]] } },
  { race: 'Dragonborn', klass: 'Paladin', a: { outfit: 8, outfitColors: [CLOTH[14], CLOTH[15]] } },
  { race: 'Half-Orc', klass: 'Barbarian', a: { hair: 4, hairColor: HAIR[0], outfit: 6, outfitColors: [CLOTH[11], CLOTH[1]] } },
  { race: 'Gnome', klass: 'Artificer', a: { hair: 2, hairColor: HAIR[7], outfit: 2, outfitColors: [CLOTH[13], CLOTH[1]] } },
  { race: 'Human', klass: 'Bard', a: { body: 1, hair: 10, hairColor: HAIR[4], outfit: 4, outfitColors: [CLOTH[7], CLOTH[3]], skin: SKIN.human[5] } },
  { race: 'Aasimar', klass: 'Sorcerer', a: { body: 1, hair: 3, hairColor: HAIR[6], outfit: 3, outfitColors: [CLOTH[3], CLOTH[15]] } },
  { race: 'Human', klass: 'Ranger', a: { hair: 8, hairColor: HAIR[1], outfit: 0, outfitColors: [CLOTH[5], CLOTH[11]], skin: SKIN.human[4] } },
  { race: 'Goliath', klass: 'Monk', a: { hair: 0, outfit: 6, outfitColors: [CLOTH[1], CLOTH[2]] } },
];

export interface Cell { label: string; v: RaceVisual; a: Appearance; prop: Prop | null }

/** Las 12 combinaciones de la galería, con el prop de su clase. */
export function galleryCells(): Cell[] {
  return LOOKS.map((l) => {
    const v = resolveRaceVisual(l.race);
    return { label: `${l.race}/${l.klass}`, v, a: { ...defaultAppearance(v), ...l.a }, prop: propForClass(l.klass) };
  });
}
