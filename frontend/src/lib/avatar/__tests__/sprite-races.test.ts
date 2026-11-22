// @vitest-environment node
/* T-4 · Partes raciales y cabezas no humanas HD-2D (contratos/T-4-razas-hd2d.md, criterios R1–R7).
   Para cada key de ALL_FAMILY_KEYS y cada opción `feature` de su familia: visualByKey(key), defaultAppearance. */
import { describe, expect, it } from 'vitest';
import {
  ALL_FAMILY_KEYS, defaultAppearance, renderLayers, spriteMetrics, visualByKey,
  type Appearance, type Part, type RaceVisual, type SpriteMetrics, type Tag,
} from '..';
import { renderPixels } from '../render';
import {
  PROPS_AND_NONE,
  byteDiff, c4Violations, contains, contourViolations, countTag, diffCount, distinctColors, eyeBoxes,
  fitsWithMargin, fmt, opaqueBox, opaqueCount, report, sameBox, tagBox, type Layers,
} from './sprite-helpers';

/** Partes que solo cambian la cara o los ojos (R5); `cyclops` sustituye el par de ojos por uno. */
const FACE_ONLY = new Set<Part>(['freckles', 'scar', 'mark', 'tattoo', 'glow-eyes', 'shadow', 'cyclops']);
/** Partes que sustituyen o tapan el par de ojos: se mide con la regla de ojos de R4. */
const NOT_TWO_EYES = new Set<Part>(['cyclops', 'visor']);
const LOOK_TAGS = new Set<Tag | null>(['face', 'eye', 'part']);

interface Case { id: string; key: string; f: number; v: RaceVisual; a: Appearance; parts: Part[] }

const MISSING = ALL_FAMILY_KEYS.filter((k) => !visualByKey(k));
const CASES: Case[] = ALL_FAMILY_KEYS.flatMap((key) => {
  const v = visualByKey(key);
  if (!v) return [];
  return Array.from({ length: Math.max(1, v.options.length) }, (_, f) => ({
    id: `${key}#${f} ${v.options[f]?.label ?? ''}`.trim(),
    key, f, v,
    a: { ...defaultAppearance(v), feature: f },
    parts: [...v.base, ...(v.options[f]?.parts ?? [])],
  }));
});

const memo = new Map<string, { L: Layers; m: SpriteMetrics }>();
function sprite(c: Case) {
  let hit = memo.get(c.id);
  if (!hit) {
    hit = { L: renderLayers(c.a, c.v), m: spriteMetrics(c.a, c.v) };
    memo.set(c.id, hit);
  }
  return hit;
}

/** La misma familia sin una parte (con otra key, para no compartir cachés por familia). */
function without(v: RaceVisual, part: Part): RaceVisual {
  return {
    ...v,
    key: `${v.key}~sin-${part}`,
    base: v.base.filter((p) => p !== part),
    options: v.options.map((o) => ({ ...o, parts: o.parts.filter((p) => p !== part) })),
  };
}

describe('T-4 · partes raciales y cabezas no humanas HD-2D', () => {
  it('R1 sin excepciones y dentro del lienzo: cada familia × opción se renderiza y la figura cabe con ≥ 1 px de margen', () => {
    expect(MISSING, 'keys sin visual').toEqual([]);
    expect(CASES.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const c of CASES) {
      try {
        const { L, m } = sprite(c);
        renderPixels(c.a, c.v);
        const real = opaqueBox(L.px);
        if (!sameBox(m.figure, real)) bad.push(`${c.id}: figure ${fmt(m.figure)} ≠ bbox opaco ${fmt(real)}`);
        else if (!fitsWithMargin(m.figure)) bad.push(`${c.id}: figure ${fmt(m.figure)} sin 1 px de margen`);
      } catch (e) {
        bad.push(`${c.id}: excepción ${(e as Error).message}`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('R2 contorno: C7 de T-1 (borde de la silueta con luminancia ≤ 0.25) con cada prop y sin prop', () => {
    const bad: string[] = [];
    for (const c of CASES) {
      for (const prop of PROPS_AND_NONE) {
        const { px, tags } = renderLayers(c.a, c.v, null, prop);
        const id = `${c.id} ${prop ?? 'sin prop'}`;
        if (!opaqueCount(px)) { bad.push(`${id}: sprite vacío`); continue; }
        const edge = contourViolations(px, tags);
        if (edge.length) bad.push(`${id}: ${edge.length} píxeles de borde con L > 0.25, p. ej. ${edge[0]}`);
      }
    }
    expect(report(bad)).toEqual([]);
  }, 60_000);

  it('R3 ojos humanoides: en cabezas human se cumple C4 (2 ojos de 1–2 × 2–3 px medidos desde los tags eye)', () => {
    const bad: string[] = [];
    const humanoid = CASES.filter((c) => c.v.head === 'human');
    expect(humanoid.length).toBeGreaterThan(0);
    for (const c of humanoid) {
      const { L, m } = sprite(c);
      const eyes = eyeBoxes(L.tags);
      if (JSON.stringify(m.eyes) !== JSON.stringify(eyes)) bad.push(`${c.id}: spriteMetrics.eyes ≠ tags eye`);
      if (c.parts.some((p) => NOT_TWO_EYES.has(p))) {
        // Cíclope y visor: el par de ojos se sustituye o se tapa; rige la regla de ojos de R4.
        if (!eyes.length) bad.push(`${c.id}: sin ojos visibles`);
        for (const e of eyes) if (e.w > 2 || e.h > 3) bad.push(`${c.id}: ojo ${fmt(e)} mayor que 2 × 3`);
        continue;
      }
      for (const e of c4Violations(eyes, m.head)) bad.push(`${c.id}: ${e}`);
    }
    expect(report(bad)).toEqual([]);
  });

  it('R4 ojos no humanos: ≥ 1 ojo, cada uno w ≤ 2 y h ≤ 3; head.h 14–22 y head contiene face y ojos', () => {
    const bad: string[] = [];
    const others = CASES.filter((c) => c.v.head !== 'human');
    expect(others.length).toBeGreaterThan(0);
    for (const c of others) {
      const { L, m } = sprite(c);
      const eyes = eyeBoxes(L.tags);
      if (!eyes.length) bad.push(`${c.id}: sin ojos (tags eye)`);
      for (const e of eyes) if (e.w > 2 || e.h > 3) bad.push(`${c.id}: ojo ${fmt(e)} mayor que 2 × 3`);
      if (JSON.stringify(m.eyes) !== JSON.stringify(eyes)) bad.push(`${c.id}: spriteMetrics.eyes ≠ tags eye`);
      if (m.head.h < 14 || m.head.h > 22) bad.push(`${c.id}: head.h=${m.head.h}`);
      const skin = tagBox(L.tags, ['face', 'eye']);
      if (!skin || !contains(m.head, skin)) bad.push(`${c.id}: head ${fmt(m.head)} no contiene face+eye ${fmt(skin)}`);
    }
    expect(report(bad)).toEqual([]);
  });

  it('R5 partes visibles: hay píxeles part si la opción tiene partes; las partes de cara cambian píxeles face/eye', () => {
    const bad: string[] = [];
    for (const c of CASES) {
      if (!c.parts.length) continue;
      const { L } = sprite(c);
      const drawn = c.parts.filter((p) => !FACE_ONLY.has(p));
      if (drawn.length && countTag(L.tags, ['part']) === 0) bad.push(`${c.id}: sin píxeles part (${drawn.join(', ')})`);
      for (const p of new Set(c.parts.filter((q) => FACE_ONLY.has(q)))) {
        const other = renderLayers(c.a, without(c.v, p));
        let changed = 0;
        for (let i = 0; i < L.tags.length; i++) {
          if (!LOOK_TAGS.has(L.tags[i]) && !LOOK_TAGS.has(other.tags[i])) continue;
          const o = i * 4;
          if (L.px[o] !== other.px[o] || L.px[o + 1] !== other.px[o + 1] || L.px[o + 2] !== other.px[o + 2] || L.px[o + 3] !== other.px[o + 3]) changed++;
        }
        if (!changed) bad.push(`${c.id}: '${p}' no cambia píxeles face/eye`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('R6 opciones distintas: en familias con ≥ 2 opciones cada par difiere en ≥ 4 píxeles', () => {
    const bad: string[] = [];
    const byKey = new Map<string, Case[]>();
    for (const c of CASES) byKey.set(c.key, [...(byKey.get(c.key) ?? []), c]);
    for (const [key, list] of byKey) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const d = diffCount(sprite(list[i]).L.px, sprite(list[j]).L.px);
          if (d < 4) bad.push(`${key}: opción ${i} vs ${j} difieren en ${d} px`);
        }
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('R7 paleta: ≤ 40 colores opacos por sprite (sin aura)', () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const { L } = sprite(c);
      if (!opaqueCount(L.px)) { bad.push(`${c.id}: sprite vacío`); continue; }
      const n = distinctColors(L.px);
      if (n > 40) bad.push(`${c.id}: ${n} colores`);
    }
    expect(report(bad)).toEqual([]);
  });

  it('RG-1 todas las familias × opciones se renderizan en ≤ 1 s', () => {
    for (let i = 0; i < CASES.length; i += 10) {
      const c = CASES[i];
      const px = renderPixels(c.a, c.v);
      expect(opaqueCount(px), c.id).toBeGreaterThan(0);
      expect(byteDiff(renderLayers(c.a, c.v).px, px), `${c.id}: renderPixels ≠ renderLayers().px`).toBeNull();
    }
    let sink = 0;
    const t0 = performance.now();
    for (const c of CASES) sink += renderPixels(c.a, c.v)[3];
    const ms = performance.now() - t0;
    expect(sink).toBeGreaterThanOrEqual(0);
    expect(ms, `${CASES.length} sprites en ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(1000);
  }, 30_000);
});
