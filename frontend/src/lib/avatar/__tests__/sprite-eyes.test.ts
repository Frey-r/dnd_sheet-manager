// @vitest-environment node
/* T-10 · Ojos iguales (contratos/T-10-ojos-iguales.md, criterios E1–E4; D-0033).
   Humanos: v = Human en tallas S, D, M, L y complexiones 0/1, a = { ...defaultAppearance(v), hair: 1 }.
   Familias: cada key de ALL_FAMILY_KEYS × opción `feature` con dos ojos visibles (sin `cyclops` ni `visor`,
   que sustituyen o tapan el par, como en R3 de T-4). Los ojos se miden desde los tags `eye`, izquierda → derecha. */
import { describe, expect, it } from 'vitest';
import {
  ALL_FAMILY_KEYS, EYES, HAIR_STYLES, defaultAppearance, renderLayers, spriteMetrics, visualByKey,
  type Appearance, type Box, type HeadType, type Part, type RaceVisual,
} from '..';
import { ramp } from '../color';
import { INK } from '../sprites/context';
import {
  BODIES, SIZES, W,
  baseAppearance, c4Violations, eyeBoxes, fmt, humanVisual, isOpaque, report, rgbKeyAt, rgbKeyOfHex, sized,
} from './sprite-helpers';

/** Partes que sustituyen o tapan el par de ojos (fuera del alcance de "dos ojos visibles"). */
const NOT_TWO_EYES = new Set<Part>(['cyclops', 'visor']);
/** Cabezas cuyo ojo derecho anterior es el diseño 2 × 3 de E3 (pestaña, iris en diagonal, brillo). */
const STANDARD_EYE_HEADS = new Set<HeadType>(['human', 'beast', 'beak', 'elephant', 'ooze']);

interface Case { id: string; v: RaceVisual; a: Appearance; glow: boolean }

const HUMANS: Case[] = SIZES.flatMap((size) => BODIES.map((body) => ({
  id: `Human talla ${size} complexión ${body}`,
  v: sized(humanVisual(), size),
  a: baseAppearance({ body }),
  glow: false,
})));

const FAMILIES: Case[] = ALL_FAMILY_KEYS.flatMap((key) => {
  const v = visualByKey(key);
  if (!v) return [];
  return Array.from({ length: Math.max(1, v.options.length) }, (_, f) => {
    const parts = [...v.base, ...(v.options[f]?.parts ?? [])];
    return { parts, c: { id: `${key}#${f} ${v.options[f]?.label ?? ''}`.trim(), v, a: { ...defaultAppearance(v), feature: f }, glow: parts.includes('glow-eyes') } };
  }).filter(({ parts }) => !parts.some((p) => NOT_TWO_EYES.has(p))).map(({ c }) => c);
});

const ALL: Case[] = [...HUMANS, ...FAMILIES];
const STANDARD: Case[] = ALL.filter((c) => STANDARD_EYE_HEADS.has(c.v.head));

const hexOf = (key: number) => `#${key.toString(16).padStart(6, '0')}`;

/** Colores RGB de la caja, fila a fila, relativos a su esquina (−1 = transparente). */
function pattern(px: ArrayLike<number>, b: Box): number[][] {
  const rows: number[][] = [];
  for (let y = b.y; y < b.y + b.h; y++) {
    const row: number[] = [];
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * W + x;
      row.push(isOpaque(px, i) ? rgbKeyAt(px, i) : -1);
    }
    rows.push(row);
  }
  return rows;
}

const fmtPattern = (p: number[][]) => p.map((r) => r.map((k) => (k < 0 ? '·' : hexOf(k))).join(' ')).join(' / ');

/**
 * Diseño del ojo derecho anterior (E3): 2 × 3, la fila superior de tinta, el iris en diagonal y el brillo abajo a
 * la derecha. Sin `glow-eyes`: tinta / tinta iris / iris brillo (iris = base de la rampa, brillo = light).
 * Con `glow-eyes` la misma plantilla sobre la rampa luminosa: tinta / base light / light hi.
 */
function rightEyeDesign(eyes: string, glow: boolean): number[][] {
  const r = ramp(eyes);
  const map = glow
    ? { k: INK, d: r.base, i: r.light, l: r.hi }
    : { k: INK, d: INK, i: r.base, l: r.light };
  return ['kk', 'di', 'il'].map((row) => [...row].map((ch) => rgbKeyOfHex(map[ch as keyof typeof map])));
}

describe('T-10 · ojos iguales (diseño del ojo derecho)', () => {
  it('E1 mismo tamaño: humanos (tallas S/D/M/L × complexión 0/1) y toda familia con dos ojos → eyes[0].w/h === eyes[1].w/h', () => {
    expect(FAMILIES.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const c of ALL) {
      const { eyes } = spriteMetrics(c.a, c.v);
      if (eyes.length !== 2) { bad.push(`${c.id}: ${eyes.length} ojos (se esperan 2): ${eyes.map(fmt).join(' ')}`); continue; }
      const [l, r] = eyes;
      if (l.w !== r.w || l.h !== r.h) bad.push(`${c.id}: ojo izquierdo ${l.w}×${l.h} ${fmt(l)} ≠ derecho ${r.w}×${r.h} ${fmt(r)}`);
    }
    expect(report(bad)).toEqual([]);
  });

  it('E2 mismo diseño: con cada color de EYES el patrón de colores de los dos ojos es idéntico píxel a píxel (relativo a su caja)', () => {
    const bad: string[] = [];
    for (const c of ALL) {
      for (const eyes of EYES) {
        const id = `${c.id} ojos ${eyes}`;
        const { px, tags } = renderLayers({ ...c.a, eyes }, c.v);
        const boxes = eyeBoxes(tags);
        if (boxes.length !== 2) { bad.push(`${id}: ${boxes.length} ojos (se esperan 2)`); continue; }
        const [l, r] = boxes.map((b) => pattern(px, b));
        if (JSON.stringify(l) !== JSON.stringify(r)) bad.push(`${id}: izquierdo [${fmtPattern(l)}] ≠ derecho [${fmtPattern(r)}]`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('E3 diseño del ojo derecho: en cabezas de ojo estándar los dos ojos son 2 × 3 = tinta tinta / tinta iris / iris brillo (rampa del color)', () => {
    expect(STANDARD.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const c of STANDARD) {
      for (const eyes of EYES) {
        const id = `${c.id} ojos ${eyes}${c.glow ? ' (glow-eyes)' : ''}`;
        const want = rightEyeDesign(eyes, c.glow);
        const { px, tags } = renderLayers({ ...c.a, eyes }, c.v);
        const boxes = eyeBoxes(tags);
        if (boxes.length !== 2) { bad.push(`${id}: ${boxes.length} ojos (se esperan 2)`); continue; }
        boxes.forEach((b, k) => {
          const side = k === 0 ? 'izquierdo' : 'derecho';
          if (b.w !== 2 || b.h !== 3) { bad.push(`${id}: ojo ${side} ${fmt(b)} no es 2 × 3`); return; }
          const got = pattern(px, b);
          if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${id}: ojo ${side} [${fmtPattern(got)}] ≠ diseño [${fmtPattern(want)}]`);
        });
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('E4 invariantes: C4 de T-1 en humanos (talla M × complexión 0/1) y H4 de T-2 (todo peinado deja 2 ojos y face.w ≥ 7)', () => {
    const bad: string[] = [];
    for (const c of HUMANS.filter((h) => h.v.size === 'M')) {
      const m = spriteMetrics(c.a, c.v);
      for (const e of c4Violations(m.eyes, m.head)) bad.push(`${c.id} C4: ${e}`);
    }
    const v = humanVisual();
    for (const body of BODIES) {
      for (let s = 0; s < HAIR_STYLES.length; s++) {
        const a: Appearance = { ...defaultAppearance(v), hair: s, body };
        const m = spriteMetrics(a, v);
        const id = `${HAIR_STYLES[s]} / complexión ${body} H4`;
        if (m.eyes.length !== 2) bad.push(`${id}: ${m.eyes.length} ojos visibles`);
        if (m.face.w < 7) bad.push(`${id}: face.w=${m.face.w}`);
      }
    }
    expect(report(bad)).toEqual([]);
  });
});
