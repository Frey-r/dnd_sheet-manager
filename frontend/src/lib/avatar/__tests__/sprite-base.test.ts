// @vitest-environment node
/* T-1 · Sprite base HD-2D (contratos/T-1-sprite-base-hd2d.md, criterios C1–C13).
   Base: v = Human, a = { ...defaultAppearance(v), hair: 1 } salvo que se diga otra cosa. */
import { describe, expect, it } from 'vitest';
import { cropRect, renderLayers, spriteMetrics, type Appearance, type RaceVisual, type Tag } from '..';
import { renderPixels } from '../render';
import type { Prop } from '../sprites/props';
import {
  BODIES, H, PROPS, PROPS_AND_NONE, SIZES, W,
  baseAppearance, byteDiff, c4Violations, contains, contourViolations, countTag, diffCount, distinctColors,
  edgesLacking, eyeBoxes, fitsWithMargin, fmt, galleryCells, halves, humanVisual, lumAt, opaqueBox,
  opaqueCount, report, sameBox, sized, tagBox,
} from './sprite-helpers';

const v = humanVisual();
const a = baseAppearance();
const HEAD_TAGS = new Set<Tag | null>(['face', 'eye', 'hair', 'hair-back']);
const VOCAB = new Set<Tag>(['hair', 'hair-back', 'face', 'skin', 'eye', 'cloth', 'trim', 'flow', 'prop', 'part', 'shade', 'outline', 'aura']);

describe('T-1 · sprite base HD-2D', () => {
  it('C1 figura: talla M, complexión 0/1, atuendos 0–9 → w 24–34, h 44–50 y = bbox opaco sin prop ni aura', () => {
    const bad: string[] = [];
    for (const body of BODIES) {
      for (let outfit = 0; outfit <= 9; outfit++) {
        const ap: Appearance = { ...a, body, outfit };
        const { figure } = spriteMetrics(ap, v);
        const real = opaqueBox(renderPixels(ap, v, null, null));
        const id = `complexión ${body} atuendo ${outfit}`;
        if (!sameBox(figure, real)) bad.push(`${id}: figure ${fmt(figure)} ≠ bbox opaco del render ${fmt(real)}`);
        if (figure.h < 44 || figure.h > 50) bad.push(`${id}: figure.h=${figure.h} fuera de [44,50]`);
        if (figure.w < 24 || figure.w > 34) bad.push(`${id}: figure.w=${figure.w} fuera de [24,34]`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('C2 cabeza: pelo 0 y 1 → head.h 16–19, head.h/figure.h 0.33–0.42, head.w 14–18; head y hair salen de los tags', () => {
    const bad: string[] = [];
    for (const hair of [0, 1]) {
      const ap: Appearance = { ...a, hair };
      const { head, figure, hair: hairBox } = spriteMetrics(ap, v);
      const { tags } = renderLayers(ap, v);
      const id = `pelo ${hair}`;
      if (head.h < 16 || head.h > 19) bad.push(`${id}: head.h=${head.h} fuera de [16,19]`);
      const ratio = figure.h > 0 ? head.h / figure.h : NaN;
      if (!(ratio >= 0.33 && ratio <= 0.42)) bad.push(`${id}: head.h/figure.h=${ratio.toFixed(3)} fuera de [0.33,0.42]`);
      if (head.w < 14 || head.w > 18) bad.push(`${id}: head.w=${head.w} fuera de [14,18]`);
      // head es el bbox de la piel de la cabeza, los ojos y el pelo sobre la barbilla.
      const skinAndEyes = tagBox(tags, ['face', 'eye']);
      if (!skinAndEyes) bad.push(`${id}: no hay píxeles 'face' ni 'eye'`);
      else if (!contains(head, skinAndEyes)) bad.push(`${id}: head ${fmt(head)} no contiene face+eye ${fmt(skinAndEyes)}`);
      const lacking = edgesLacking(head, (i) => HEAD_TAGS.has(tags[i]));
      if (lacking.length) bad.push(`${id}: bordes de head ${fmt(head)} sin píxeles de cabeza: ${lacking.join(', ')}`);
      const hairTags = tagBox(tags, ['hair', 'hair-back']);
      if (hair === 0 && (hairBox !== null || hairTags)) bad.push(`${id}: calvo con hair=${fmt(hairBox)} / tags ${fmt(hairTags)}`);
      if (hair === 1 && (!hairTags || !sameBox(hairBox, hairTags))) bad.push(`${id}: hair ${fmt(hairBox)} ≠ bbox de 'hair'+'hair-back' ${fmt(hairTags)}`);
    }
    expect(report(bad)).toEqual([]);
  });

  it('C3 cara: face.w 8–11; face es un bbox ajustado de píxeles face dentro de head', () => {
    const { face, head } = spriteMetrics(a, v);
    const { tags } = renderLayers(a, v);
    expect(face.w, `face.w=${face.w}`).toBeGreaterThanOrEqual(8);
    expect(face.w, `face.w=${face.w}`).toBeLessThanOrEqual(11);
    expect(contains(head, face), `face ${fmt(face)} fuera de head ${fmt(head)}`).toBe(true);
    expect(edgesLacking(face, (i) => tags[i] === 'face'), `face ${fmt(face)}: bordes sin píxel 'face'`).toEqual([]);
  });

  it('C4 ojos: 2 ojos de 1–2 × 2–3 px medidos desde los tags eye, separados 2–4 px, en la mitad inferior de head', () => {
    const { eyes, head } = spriteMetrics(a, v);
    const fromTags = eyeBoxes(renderLayers(a, v).tags);
    expect(c4Violations(fromTags, head)).toEqual([]);
    expect(eyes, 'spriteMetrics.eyes debe coincidir con los grupos de píxeles eye').toEqual(fromTags);
  });

  it('C5 pies: feetRow === 53 en las 8 combinaciones talla × complexión', () => {
    const bad: string[] = [];
    for (const size of SIZES) {
      for (const body of BODIES) {
        const vs = sized(v, size);
        const ap: Appearance = { ...a, body };
        const { feetRow } = spriteMetrics(ap, vs);
        const { px, tags } = renderLayers(ap, vs);
        const id = `${size}/${body}`;
        if (feetRow !== 53) bad.push(`${id}: feetRow=${feetRow}`);
        let onRow = 0;
        let below = 0;
        for (let x = 0; x < W; x++) {
          for (let y = 53; y < H; y++) {
            const i = y * W + x;
            if (px[i * 4 + 3] === 0 || tags[i] === 'outline') continue;
            if (y === 53) onRow++;
            else if (tags[i] !== 'shade') below++;
          }
        }
        if (!onRow) bad.push(`${id}: la fila 53 no tiene píxeles de bota (sin contorno)`);
        if (below) bad.push(`${id}: ${below} píxeles que no son contorno por debajo de la fila 53`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('C6 tallas: S, D, M, L × complexión caben con ≥ 1 px de margen; h(S) < h(D) ≤ h(M) < h(L); w(D) ≥ w(M); head.h fijo', () => {
    const bad: string[] = [];
    for (const body of BODIES) {
      const ap: Appearance = { ...a, body };
      const m = Object.fromEntries(SIZES.map((s) => [s, spriteMetrics(ap, sized(v, s))]));
      for (const s of SIZES) {
        const real = opaqueBox(renderPixels(ap, sized(v, s), null, null));
        if (!sameBox(m[s].figure, real)) bad.push(`${s}/${body}: figure ${fmt(m[s].figure)} ≠ bbox opaco ${fmt(real)}`);
        if (!fitsWithMargin(m[s].figure)) bad.push(`${s}/${body}: figure ${fmt(m[s].figure)} sin 1 px de margen en el lienzo ${W}×${H}`);
      }
      const h = (s: string) => m[s].figure.h;
      if (!(h('S') < h('D') && h('D') <= h('M') && h('M') < h('L'))) {
        bad.push(`complexión ${body}: alturas S=${h('S')} D=${h('D')} M=${h('M')} L=${h('L')} no cumplen S < D ≤ M < L`);
      }
      if (!(m.D.figure.w >= m.M.figure.w)) bad.push(`complexión ${body}: w(D)=${m.D.figure.w} < w(M)=${m.M.figure.w}`);
      const heads = SIZES.map((s) => m[s].head.h);
      if (new Set(heads).size !== 1 || heads[0] <= 0) bad.push(`complexión ${body}: head.h por talla ${heads.join(', ')}`);
    }
    expect(report(bad)).toEqual([]);
  });

  it('C7 contorno completo: con cada prop y sin prop, sin aura, todo píxel del borde de la silueta tiene luminancia ≤ 0.25', () => {
    const bad: string[] = [];
    for (const prop of PROPS_AND_NONE) {
      const px = renderPixels(a, v, null, prop);
      const { tags } = renderLayers(a, v, null, prop);
      if (opaqueCount(px) === 0) { bad.push(`${prop ?? 'sin prop'}: sprite vacío`); continue; }
      for (const e of contourViolations(px, tags)) bad.push(`${prop ?? 'sin prop'} ${e}`);
    }
    expect(report(bad)).toEqual([]);
  });

  it('C8 paleta: ≤ 40 colores opacos distintos por sprite (con prop, sin aura) en las 12 combinaciones de la galería', () => {
    const bad: string[] = [];
    const cells = galleryCells();
    expect(cells).toHaveLength(12);
    for (const c of cells) {
      const px = renderPixels(c.a, c.v, null, c.prop);
      const n = distinctColors(px);
      if (opaqueCount(px) === 0) bad.push(`${c.label}: sprite vacío`);
      if (n > 40) bad.push(`${c.label}: ${n} colores`);
    }
    expect(bad).toEqual([]);
  });

  it('C9 recorte de cabeza: bust 24×24 dentro del lienzo, contiene face y los dos ojos, face centrada a ±3 px', () => {
    const r = cropRect(v, a, 'bust');
    const { face } = spriteMetrics(a, v);
    const eyes = eyeBoxes(renderLayers(a, v).tags);
    expect([r.w, r.h]).toEqual([24, 24]);
    expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H, `bust ${fmt(r)} fuera del lienzo`).toBe(true);
    expect(face.w > 0 && face.h > 0, `face vacía ${fmt(face)}`).toBe(true);
    expect(contains(r, face), `bust ${fmt(r)} no contiene face ${fmt(face)}`).toBe(true);
    expect(eyes, 'se esperan 2 ojos (tags eye)').toHaveLength(2);
    for (const e of eyes) expect(contains(r, e), `bust ${fmt(r)} no contiene el ojo ${fmt(e)}`).toBe(true);
    const offset = Math.abs(face.x + face.w / 2 - (r.x + r.w / 2));
    expect(offset, `centro de face a ${offset} px del centro del recorte`).toBeLessThanOrEqual(3);
  });

  it('C10 prop: cada prop cambia el sprite y ≥ 80 % de sus píxeles prop están en x ≥ 24', () => {
    const bad: string[] = [];
    const bare = renderPixels(a, v, null, null);
    for (const prop of PROPS) {
      if (diffCount(renderPixels(a, v, null, prop), bare) === 0) bad.push(`${prop}: el sprite no cambia`);
      const { tags } = renderLayers(a, v, null, prop);
      let total = 0;
      let near = 0;
      tags.forEach((t, i) => { if (t === 'prop') { total++; if (i % W >= 24) near++; } });
      if (!total) bad.push(`${prop}: sin píxeles 'prop'`);
      else if (near / total < 0.8) bad.push(`${prop}: ${near}/${total} píxeles prop en x ≥ 24 (${Math.round((near / total) * 100)} %)`);
    }
    expect(bad).toEqual([]);
  });

  it('C11 luz: la luminancia media de los píxeles face en la mitad izquierda de face ≥ la de la mitad derecha', () => {
    const { face } = spriteMetrics(a, v);
    const { px, tags } = renderLayers(a, v);
    const { left, right } = halves(face);
    const mean = ([x0, x1]: [number, number]) => {
      let sum = 0;
      let n = 0;
      for (let y = face.y; y < face.y + face.h; y++) {
        for (let x = x0; x < x1; x++) if (tags[y * W + x] === 'face') { sum += lumAt(px, y * W + x); n++; }
      }
      return { n, mean: n ? sum / n : NaN };
    };
    const l = mean(left);
    const rr = mean(right);
    expect(l.n, `píxeles face en la mitad izquierda de ${fmt(face)}`).toBeGreaterThan(0);
    expect(rr.n, `píxeles face en la mitad derecha de ${fmt(face)}`).toBeGreaterThan(0);
    expect(l.mean, 'luminancia media izquierda ≥ derecha').toBeGreaterThanOrEqual(rr.mean);
  });

  const VARIANTS: { id: string; v: RaceVisual; a: Appearance; aura: string | null; prop: Prop | null }[] = [
    { id: 'base', v, a, aura: null, prop: null },
    { id: 'staff + aura', v, a, aura: '#8a3aa8', prop: 'staff' },
    { id: 'L/1 pelo 5 atuendo 9 bow', v: sized(v, 'L'), a: { ...a, body: 1, hair: 5, outfit: 9 }, aura: null, prop: 'bow' },
    { id: 'S/0 calvo atuendo 4 + aura', v: sized(v, 'S'), a: { ...a, hair: 0, outfit: 4 }, aura: '#c0392b', prop: null },
    { id: 'D/1 pelo 10 hammer + aura', v: sized(v, 'D'), a: { ...a, body: 1, hair: 10, outfit: 8 }, aura: '#3a8a4a', prop: 'hammer' },
  ];

  it('C12 determinismo: dos renders iguales devuelven bytes y etiquetas idénticos', () => {
    for (const c of VARIANTS) {
      expect(byteDiff(renderPixels(c.a, c.v, c.aura, c.prop), renderPixels(c.a, c.v, c.aura, c.prop)), `renderPixels ${c.id}`).toBeNull();
      const l1 = renderLayers(c.a, c.v, c.aura, c.prop);
      const l2 = renderLayers(c.a, c.v, c.aura, c.prop);
      expect(opaqueCount(l1.px), `renderLayers ${c.id} vacío`).toBeGreaterThan(0);
      expect(byteDiff(l1.px, l2.px), `renderLayers.px ${c.id}`).toBeNull();
      expect(l1.tags, `renderLayers.tags ${c.id}`).toEqual(l2.tags);
    }
  });

  it('C12 renderLayers(...).px es igual byte a byte a renderPixels(...)', () => {
    for (const c of VARIANTS) {
      const px = renderPixels(c.a, c.v, c.aura, c.prop);
      expect(px.length).toBe(W * H * 4);
      expect(opaqueCount(px), `renderPixels ${c.id} vacío`).toBeGreaterThan(0);
      expect(byteDiff(renderLayers(c.a, c.v, c.aura, c.prop).px, px), c.id).toBeNull();
    }
  });

  it('C12 capas: una etiqueta del vocabulario por píxel opaco, null solo en los transparentes; aura solo con aura', () => {
    for (const c of VARIANTS) {
      const { px, tags } = renderLayers(c.a, c.v, c.aura, c.prop);
      expect(tags, c.id).toHaveLength(W * H);
      const bad: string[] = [];
      tags.forEach((t, i) => {
        const opaque = px[i * 4 + 3] > 0;
        if (opaque !== (t !== null)) bad.push(`(${i % W},${Math.floor(i / W)}) alfa=${px[i * 4 + 3]} tag=${t}`);
        else if (t !== null && !VOCAB.has(t)) bad.push(`(${i % W},${Math.floor(i / W)}) tag fuera del vocabulario: ${t}`);
      });
      expect(report(bad), c.id).toEqual([]);
      expect(opaqueCount(px), `${c.id} vacío`).toBeGreaterThan(0);
      const auras = countTag(tags, ['aura']);
      if (c.aura) expect(auras, `${c.id}: píxeles aura`).toBeGreaterThan(0);
      else expect(auras, `${c.id}: píxeles aura sin aura`).toBe(0);
    }
  });

  it('C13 rendimiento: 500 renders variados (tallas, complexiones, props) en ≤ 750 ms', () => {
    const jobs = Array.from({ length: 500 }, (_, i) => ({
      v: sized(v, SIZES[i % 4]),
      a: { ...a, body: BODIES[(i >> 2) % 2], hair: i % 12, outfit: i % 10 } as Appearance,
      prop: PROPS_AND_NONE[i % PROPS_AND_NONE.length],
    }));
    // Lo medido es el pipeline nuevo: renderPixels debe ser renderLayers(...).px.
    for (let i = 0; i < jobs.length; i += 50) {
      const j = jobs[i];
      const px = renderPixels(j.a, j.v, null, j.prop);
      expect(opaqueCount(px)).toBeGreaterThan(0);
      expect(byteDiff(renderLayers(j.a, j.v, null, j.prop).px, px), `render ${i}`).toBeNull();
    }
    for (let i = 0; i < 10; i++) renderPixels(jobs[i].a, jobs[i].v, null, jobs[i].prop); // calentamiento
    let sink = 0;
    const t0 = performance.now();
    for (const j of jobs) sink += renderPixels(j.a, j.v, null, j.prop)[W * H * 2 + 3];
    const ms = performance.now() - t0;
    expect(sink).toBeGreaterThanOrEqual(0);
    expect(ms, `500 renders en ${ms.toFixed(0)} ms (${(ms / 500).toFixed(2)} ms de media)`).toBeLessThanOrEqual(750);
  }, 30_000);
});
