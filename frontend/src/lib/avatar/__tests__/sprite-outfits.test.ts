// @vitest-environment node
/* T-3 · Atuendos HD-2D (contratos/T-3-atuendos-hd2d.md, criterios O1–O7).
   Base: v = Human, a = { ...defaultAppearance(v), hair: 1, outfit: o, outfitColors: [P, S] }, complexión 0 salvo O1/O7. */
import { describe, expect, it } from 'vitest';
import { HAIR_STYLES, OUTFITS, defaultAppearance, renderLayers, spriteMetrics, type Appearance } from '..';
import { ramp } from '../color';
import { renderPixels } from '../render';
import {
  BODIES, PROPS_AND_NONE, SIZES, W,
  byteDiff, contourViolations, countTag, diffCount, distinctColors, fitsWithMargin, fmt, halves, humanVisual,
  lumAt, opaqueBox, opaqueCount, report, rgbKeyAt, rgbKeyOfHex, sameBox, sized,
} from './sprite-helpers';

const v = humanVisual();
const P = '#2e4a7a';
const S = '#d9b26f';
const IDS = OUTFITS.map((_, o) => o);

const dressed = (o: number, patch: Partial<Appearance> = {}): Appearance =>
  ({ ...defaultAppearance(v), hair: 1, outfit: o, outfitColors: [P, S], ...patch });
const name = (o: number) => `${o} ${OUTFITS[o]}`;
/** Colores RGB de la rampa completa (hi, light, base, shadow, deep, cool, ink). */
const rampKeys = (hex: string) => new Set(Object.values(ramp(hex)).map(rgbKeyOfHex));

describe('T-3 · atuendos HD-2D', () => {
  it('O1 encaje: cada atuendo × complexión × talla S/D/M/L cabe con ≥ 1 px de margen y feetRow === 53', () => {
    const bad: string[] = [];
    for (const o of IDS) {
      for (const body of BODIES) {
        for (const size of SIZES) {
          const a = dressed(o, { body });
          const vs = sized(v, size);
          const m = spriteMetrics(a, vs);
          const real = opaqueBox(renderLayers(a, vs).px);
          const id = `${name(o)} ${size}/${body}`;
          if (!sameBox(m.figure, real)) bad.push(`${id}: figure ${fmt(m.figure)} ≠ bbox opaco ${fmt(real)}`);
          else if (!fitsWithMargin(m.figure)) bad.push(`${id}: figure ${fmt(m.figure)} sin 1 px de margen`);
          if (m.feetRow !== 53) bad.push(`${id}: feetRow=${m.feetRow}`);
        }
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('O2 distintos: cada par de atuendos difiere en ≥ 30 píxeles (mismos colores y pelo)', () => {
    const bad: string[] = [];
    const px = IDS.map((o) => renderLayers(dressed(o), v).px);
    if (px.some((p) => !opaqueCount(p))) bad.push('hay sprites vacíos');
    for (let i = 0; i < IDS.length; i++) {
      for (let j = i + 1; j < IDS.length; j++) {
        const d = diffCount(px[i], px[j]);
        if (d < 30) bad.push(`${name(i)} vs ${name(j)}: ${d} px`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('O3 dos colores: ≥ 40 píxeles de ramp(P) y ≥ 10 de ramp(S) en cada atuendo', () => {
    const bad: string[] = [];
    const kp = rampKeys(P);
    const ks = rampKeys(S);
    for (const o of IDS) {
      const { px } = renderLayers(dressed(o), v);
      let np = 0, ns = 0;
      for (let i = 0; i < px.length / 4; i++) {
        if (px[i * 4 + 3] === 0) continue;
        const k = rgbKeyAt(px, i);
        if (kp.has(k)) np++;
        if (ks.has(k)) ns++;
      }
      if (np < 40) bad.push(`${name(o)}: ${np} píxeles de ramp(P)`);
      if (ns < 10) bad.push(`${name(o)}: ${ns} píxeles de ramp(S)`);
    }
    expect(bad).toEqual([]);
  });

  it('O4 detalle: cada atuendo tiene ≥ 6 píxeles trim', () => {
    const bad = IDS
      .map((o) => ({ o, n: countTag(renderLayers(dressed(o), v).tags, ['trim']) }))
      .filter(({ n }) => n < 6)
      .map(({ o, n }) => `${name(o)}: ${n} píxeles trim`);
    expect(bad).toEqual([]);
  });

  it('O5 luz: en las filas del torso la tela de la mitad izquierda de la figura es más luminosa que la de la derecha', () => {
    const bad: string[] = [];
    for (const o of IDS) {
      const a = dressed(o);
      const { head, figure } = spriteMetrics(a, v);
      const { px, tags } = renderLayers(a, v);
      const y0 = head.y + head.h;
      const y1 = figure.y + Math.round(figure.h * 0.62);
      const { left, right } = halves(figure);
      const acc = { l: 0, nl: 0, r: 0, nr: 0 };
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (tags[i] !== 'cloth') continue;
          if (x >= left[0] && x < left[1]) { acc.l += lumAt(px, i); acc.nl++; }
          else if (x >= right[0] && x < right[1]) { acc.r += lumAt(px, i); acc.nr++; }
        }
      }
      const id = `${name(o)} filas ${y0}–${y1}`;
      if (!acc.nl || !acc.nr) { bad.push(`${id}: píxeles cloth izquierda=${acc.nl} derecha=${acc.nr}`); continue; }
      const ml = acc.l / acc.nl, mr = acc.r / acc.nr;
      if (!(ml > mr)) bad.push(`${id}: luminancia media izquierda ${ml.toFixed(3)} ≤ derecha ${mr.toFixed(3)}`);
    }
    expect(bad).toEqual([]);
  });

  it('O6 invariantes de T-1: C7 (contorno completo) y C8 (≤ 40 colores) con cada atuendo y cada prop', () => {
    const bad: string[] = [];
    for (const o of IDS) {
      for (const prop of PROPS_AND_NONE) {
        const { px, tags } = renderLayers(dressed(o), v, null, prop);
        const id = `${name(o)} ${prop ?? 'sin prop'}`;
        if (!opaqueCount(px)) { bad.push(`${id}: sprite vacío`); continue; }
        const edge = contourViolations(px, tags);
        if (edge.length) bad.push(`${id} C7: ${edge.length} píxeles de borde con L > 0.25, p. ej. ${edge[0]}`);
        const n = distinctColors(px);
        if (n > 40) bad.push(`${id} C8: ${n} colores`);
      }
    }
    expect(report(bad)).toEqual([]);
  }, 30_000);

  it('O7 cobertura total: las 960 combinaciones pelo × atuendo × complexión × talla se renderizan sin excepción en ≤ 2,5 s', () => {
    const jobs = HAIR_STYLES.flatMap((_, hair) => IDS.flatMap((o) => BODIES.flatMap((body) =>
      SIZES.map((size) => ({ id: `pelo ${hair} ${name(o)} ${size}/${body}`, a: dressed(o, { hair, body }), v: sized(v, size) })))));
    expect(jobs).toHaveLength(960);
    // Lo medido es el pipeline nuevo: renderPixels debe ser renderLayers(...).px.
    for (let i = 0; i < jobs.length; i += 97) {
      const px = renderPixels(jobs[i].a, jobs[i].v);
      expect(opaqueCount(px), jobs[i].id).toBeGreaterThan(0);
      expect(byteDiff(renderLayers(jobs[i].a, jobs[i].v).px, px), jobs[i].id).toBeNull();
    }
    const errors: string[] = [];
    let sink = 0;
    const t0 = performance.now();
    for (const j of jobs) {
      try { sink += renderPixels(j.a, j.v)[3]; } catch (e) { errors.push(`${j.id}: ${(e as Error).message}`); }
    }
    const ms = performance.now() - t0;
    expect(report(errors)).toEqual([]);
    expect(sink).toBeGreaterThanOrEqual(0);
    expect(ms, `960 renders en ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(2500);
  }, 30_000);
});
