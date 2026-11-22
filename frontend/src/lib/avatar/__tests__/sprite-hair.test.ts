// @vitest-environment node
/* T-2 · Peinados HD-2D (contratos/T-2-pelo-hd2d.md, criterios H1–H7).
   Base: v = Human (talla M), complexión 0 y 1, a = { ...defaultAppearance(v), hair: s }.
   skull = spriteMetrics con hair 0: su head. Filas de la cabeza: y ≤ barbilla (face.y + face.h − 1 del calvo). */
import { describe, expect, it } from 'vitest';
import { HAIR, HAIR_STYLES, defaultAppearance, renderLayers, spriteMetrics, type Appearance, type SpriteMetrics, type Tag } from '..';
import { renderPixels } from '../render';
import {
  BODIES, PROPS_AND_NONE, SIZES, W,
  byteDiff, c4Violations, colorKey, contourViolations, distinctColors, eyeBoxes, fmt, halves, humanVisual,
  lumAt, maskDiff, opaqueCount, report, sameBox, sized, tagBox, countTag, type Layers,
} from './sprite-helpers';

const v = humanVisual();
const STYLES = HAIR_STYLES.map((_, s) => s);
const WITH_HAIR = STYLES.filter((s) => s > 0);
/** 3 Coleta, 5 Largo, 6 Trenza, 8 Melena, 10 Dos coletas, 11 Ondas. */
const LONG = new Set([3, 5, 6, 8, 10, 11]);
const HAIR_TAGS: Tag[] = ['hair', 'hair-back'];

const styled = (s: number, body: 0 | 1, patch: Partial<Appearance> = {}): Appearance =>
  ({ ...defaultAppearance(v), hair: s, body, ...patch });

const memo = new Map<string, { L: Layers; m: SpriteMetrics }>();
function sprite(s: number, body: 0 | 1) {
  const key = `${s}/${body}`;
  let hit = memo.get(key);
  if (!hit) {
    const a = styled(s, body);
    hit = { L: renderLayers(a, v), m: spriteMetrics(a, v) };
    memo.set(key, hit);
  }
  return hit;
}

describe('T-2 · peinados HD-2D', () => {
  it('H1 tamaño: el pelo cabe en el cráneo ±3 px y hasta 4 px por encima; solo los largos bajan de la barbilla y nunca de la cadera', () => {
    const bad: string[] = [];
    for (const body of BODIES) {
      const bald = sprite(0, body).m;
      const skull = bald.head;
      const chin = bald.face.y + bald.face.h - 1;
      if (skull.w <= 0 || skull.h <= 0 || bald.face.h <= 0) { bad.push(`complexión ${body}: skull ${fmt(skull)} / face ${fmt(bald.face)} vacíos`); continue; }
      const xMin = skull.x - 3;
      const xMax = skull.x + skull.w + 2;
      const yMin = skull.y - 4;
      for (const s of WITH_HAIR) {
        const { L, m } = sprite(s, body);
        const hip = m.figure.y + Math.round(m.figure.h * 0.62);
        let n = 0, wide = 0, high = 0, belowChin = 0, belowHip = 0;
        L.tags.forEach((t, i) => {
          if (t !== 'hair' && t !== 'hair-back') return;
          n++;
          const x = i % W, y = Math.floor(i / W);
          if (y <= chin) {
            if (x < xMin || x > xMax) wide++;
            if (y < yMin) high++;
          } else if (!LONG.has(s)) belowChin++;
          else if (y > hip) belowHip++;
        });
        const id = `${s} ${HAIR_STYLES[s]} / complexión ${body}`;
        if (!n) bad.push(`${id}: sin píxeles de pelo`);
        if (wide) bad.push(`${id}: ${wide} píxeles fuera de x ∈ [${xMin}, ${xMax}] en las filas de la cabeza`);
        if (high) bad.push(`${id}: ${high} píxeles por encima de y = ${yMin}`);
        if (belowChin) bad.push(`${id}: ${belowChin} píxeles bajo la barbilla (y > ${chin}) en un estilo corto`);
        if (belowHip) bad.push(`${id}: ${belowHip} píxeles bajo la cadera (y > ${hip})`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('H2 distintos: cada par de estilos difiere en ≥ 12 píxeles de la máscara de pelo', () => {
    const bad: string[] = [];
    for (const body of BODIES) {
      for (let i = 0; i < STYLES.length; i++) {
        for (let j = i + 1; j < STYLES.length; j++) {
          const d = maskDiff(sprite(i, body).L.tags, sprite(j, body).L.tags, HAIR_TAGS);
          if (d < 12) bad.push(`complexión ${body}: ${HAIR_STYLES[i]} vs ${HAIR_STYLES[j]} difieren en ${d} px`);
        }
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('H3 tonos y luz: ≥ 4 colores en píxeles hair y el tono más claro abunda más en la mitad izquierda del bbox hair', () => {
    const bad: string[] = [];
    for (const body of BODIES) {
      for (const s of WITH_HAIR) {
        const { L, m } = sprite(s, body);
        const id = `${s} ${HAIR_STYLES[s]} / complexión ${body}`;
        const box = tagBox(L.tags, HAIR_TAGS);
        if (!box || !sameBox(m.hair, box)) { bad.push(`${id}: hair ${fmt(m.hair)} ≠ bbox de 'hair'+'hair-back' ${fmt(box)}`); continue; }
        const tones = distinctColors(L.px, (i) => L.tags[i] === 'hair');
        if (tones < 4) bad.push(`${id}: ${tones} colores en píxeles hair`);
        let best = -1, bestLum = -1;
        L.tags.forEach((t, i) => {
          if (t !== 'hair') return;
          const l = lumAt(L.px, i);
          if (l > bestLum) { bestLum = l; best = colorKey(L.px, i); }
        });
        const { left, right } = halves(box);
        let nl = 0, nr = 0;
        L.tags.forEach((t, i) => {
          if (t !== 'hair' || colorKey(L.px, i) !== best) return;
          const x = i % W;
          if (x >= left[0] && x < left[1]) nl++;
          else if (x >= right[0] && x < right[1]) nr++;
        });
        if (!(nl > nr)) bad.push(`${id}: tono más claro izquierda=${nl} derecha=${nr}`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('H4 cara visible: con todo estilo hay 2 ojos y face.w ≥ 7', () => {
    const bad: string[] = [];
    for (const body of BODIES) {
      for (const s of STYLES) {
        const { L, m } = sprite(s, body);
        const id = `${s} ${HAIR_STYLES[s]} / complexión ${body}`;
        const eyes = eyeBoxes(L.tags);
        if (eyes.length !== 2) bad.push(`${id}: ${eyes.length} ojos visibles (tags eye)`);
        if (m.eyes.length !== 2) bad.push(`${id}: spriteMetrics.eyes tiene ${m.eyes.length}`);
        if (m.face.w < 7) bad.push(`${id}: face.w=${m.face.w}`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('H5 calvo: el estilo 0 no tiene píxeles hair ni hair-back y hair === null', () => {
    for (const body of BODIES) {
      const { L, m } = sprite(0, body);
      expect(countTag(L.tags, ['face']), `complexión ${body}: la cabeza calva no tiene piel 'face'`).toBeGreaterThan(0);
      expect(countTag(L.tags, HAIR_TAGS), `complexión ${body}: píxeles de pelo en el calvo`).toBe(0);
      expect(m.hair, `complexión ${body}`).toBeNull();
    }
  });

  it('H6 invariantes de T-1: C4, C7 (contorno completo) y C8 (≤ 40 colores) con cada estilo', () => {
    const bad: string[] = [];
    for (const body of BODIES) {
      for (const s of STYLES) {
        const id = `${s} ${HAIR_STYLES[s]} / complexión ${body}`;
        const { L, m } = sprite(s, body);
        const eyes = eyeBoxes(L.tags);
        for (const e of c4Violations(eyes, m.head)) bad.push(`${id} C4: ${e}`);
        if (JSON.stringify(m.eyes) !== JSON.stringify(eyes)) bad.push(`${id} C4: spriteMetrics.eyes ≠ tags eye`);
        for (const prop of PROPS_AND_NONE) {
          const { px, tags } = renderLayers(styled(s, body), v, null, prop);
          const pid = `${id} ${prop ?? 'sin prop'}`;
          if (!opaqueCount(px)) { bad.push(`${pid}: sprite vacío`); continue; }
          const edge = contourViolations(px, tags);
          if (edge.length) bad.push(`${pid} C7: ${edge.length} píxeles de borde con L > 0.25, p. ej. ${edge[0]}`);
          const n = distinctColors(px);
          if (n > 40) bad.push(`${pid} C8: ${n} colores`);
        }
      }
    }
    expect(report(bad)).toEqual([]);
  }, 30_000);

  it('H7 colores de pelo: cada color de HAIR da ≥ 4 tonos distintos en los píxeles hair del sprite', () => {
    const bad: string[] = [];
    for (const color of HAIR) {
      for (const s of WITH_HAIR) {
        const { px, tags } = renderLayers(styled(s, 0, { hairColor: color }), v);
        const n = distinctColors(px, (i) => tags[i] === 'hair');
        if (n < 4) bad.push(`${color} estilo ${s} ${HAIR_STYLES[s]}: ${n} tonos`);
      }
    }
    expect(report(bad)).toEqual([]);
  }, 30_000);

  it('RG-1 render ≤ 1,5 ms de media con cualquier estilo', () => {
    const jobs = STYLES.flatMap((s) => BODIES.flatMap((body) => SIZES.map((size) => ({ a: styled(s, body), v: sized(v, size) }))));
    for (const s of STYLES) {
      const a = styled(s, 0);
      const px = renderPixels(a, v);
      expect(opaqueCount(px)).toBeGreaterThan(0);
      expect(byteDiff(renderLayers(a, v).px, px), `estilo ${s}: renderPixels ≠ renderLayers().px`).toBeNull();
    }
    for (let i = 0; i < 10; i++) renderPixels(jobs[i].a, jobs[i].v); // calentamiento
    const reps = 5;
    let sink = 0;
    const t0 = performance.now();
    for (let r = 0; r < reps; r++) for (const j of jobs) sink += renderPixels(j.a, j.v)[3];
    const mean = (performance.now() - t0) / (reps * jobs.length);
    expect(sink).toBeGreaterThanOrEqual(0);
    expect(mean, `media ${mean.toFixed(2)} ms por render`).toBeLessThanOrEqual(1.5);
  }, 30_000);
});
