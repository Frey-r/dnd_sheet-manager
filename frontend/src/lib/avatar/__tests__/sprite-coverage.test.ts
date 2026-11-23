// @vitest-environment node
/* T-7 · Sprite: plantillas compiladas una vez, proporción torso/piernas, "nada flota", orientación,
   R5 fuerte, familias sin pelo y golden del arte aprobado (contratos/T-7-sprite-cobertura-rg1.md, K1–K5, K7, K8;
   K6 no lleva test). Spec: openspec/specs/character-appearance.md § Art direction y § Race families.

   Las partes se quitan siempre por LISTA (base y opciones sin la parte) conservando la clave de familia
   (E-0006): así el hocico, el pico o la cabeza elegidos por clave no cambian entre los dos renders.

   Golden (K7, D-0026): `__tests__/golden/sprites.json` guarda el sha256 de `renderPixels` de un conjunto fijo.
   Para regenerarlo, solo DESPUÉS de la aprobación visual del revisor (y registrándolo en la tarjeta):
     UPDATE_GOLDEN=1 npm --prefix frontend test -- src/lib/avatar/__tests__/sprite-coverage.test.ts
   (en PowerShell: $env:UPDATE_GOLDEN=1; npm --prefix frontend test -- …). Sin la variable, el test solo compara. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_FAMILY_KEYS, HAIR_STYLES, OUTFITS, auraForClass, defaultAppearance, renderLayers, spriteMetrics, visualByKey,
  type Appearance, type Part, type RaceVisual, type Size, type Tag,
} from '..';
import { templateCompileCount } from '../metrics';
import { cropRect, drawAvatarInto, renderPixels } from '../render';
import type { Prop } from '../sprites/props';
import {
  H, PROPS, SIZES, W, baseAppearance, fmt, galleryCells, humanVisual, isOpaque, report, sized, type Layers,
} from './sprite-helpers';

// ── Casos: cada familia × opción (y talla) ────────────────────────────────────────────────────────

interface Case { id: string; key: string; f: number; v: RaceVisual; a: Appearance; parts: Part[] }

const KEYS = ALL_FAMILY_KEYS.filter((k) => visualByKey(k));

/** Cada familia × opción con su talla propia (o la talla pedida), apariencia por defecto y esa opción. */
function cases(size?: Size): Case[] {
  return KEYS.flatMap((key) => {
    const base = visualByKey(key) as RaceVisual;
    const v = size ? sized(base, size) : base;
    return Array.from({ length: Math.max(1, v.options.length) }, (_, f) => ({
      id: `${key}#${f}${size ? ` ${size}` : ''}`,
      key, f, v,
      a: { ...defaultAppearance(v), feature: f },
      parts: [...new Set([...v.base, ...(v.options[f]?.parts ?? [])])],
    }));
  });
}

const FAMILY_CASES = cases();
const K3_SIZES: Size[] = ['S', 'M', 'L'];
const SIZED_CASES = K3_SIZES.flatMap((s) => cases(s));

/** La misma familia (misma clave) sin la parte en la base ni en ninguna opción (E-0006). */
function withoutPart(v: RaceVisual, part: Part): RaceVisual {
  return {
    ...v,
    base: v.base.filter((p) => p !== part),
    options: v.options.map((o) => ({ ...o, parts: o.parts.filter((p) => p !== part) })),
  };
}

const memo = new Map<string, Layers>();
const layers = (c: Case): Layers => {
  let hit = memo.get(c.id);
  if (!hit) memo.set(c.id, (hit = renderLayers(c.a, c.v)));
  return hit;
};

/** Índices de píxel cuyo RGBA difiere entre dos renders. */
function changed(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2] || a[o + 3] !== b[o + 3]) out.push(i);
  }
  return out;
}

/** Componentes 8-conexas de un conjunto de índices de píxel. */
function groups(cells: readonly number[]): number[][] {
  const inSet = new Uint8Array(W * H);
  for (const i of cells) inSet[i] = 1;
  const out: number[][] = [];
  for (const start of cells) {
    if (inSet[start] !== 1) continue;
    inSet[start] = 2;
    const group: number[] = [];
    const stack = [start];
    while (stack.length) {
      const i = stack.pop() as number;
      group.push(i);
      const x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (inSet[j] === 1) { inSet[j] = 2; stack.push(j); }
        }
      }
    }
    out.push(group);
  }
  return out;
}

/** El píxel `i` es opaco en `px` o tiene un vecino-8 opaco. */
function touches(px: ArrayLike<number>, i: number): boolean {
  const x = i % W, y = (i - x) / W;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && isOpaque(px, ny * W + nx)) return true;
    }
  }
  return false;
}

const boxOf = (cells: readonly number[]) => {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const i of cells) {
    const x = i % W, y = (i - x) / W;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

const centroidX = (cells: readonly number[]) => cells.reduce((s, i) => s + (i % W), 0) / cells.length;

const TAILS_AND_WINGS = new Set<Part>([
  'tail-devil', 'tail-reptile', 'tail-cat', 'tail-fox', 'tail-horse', 'tail-rat', 'tail-stub',
  'wings-fairy', 'wings-feather', 'wings-bat',
]);
const SNOUT_HEADS = new Set<RaceVisual['head']>(['beast', 'beak', 'reptile', 'elephant']);
/** Partes de cara (R5 de T-4 más las que se pintan sobre la cara o la cabeza desnuda). */
const FACE_PARTS = new Set<Part>([
  'freckles', 'scar', 'mark', 'tattoo', 'glow-eyes', 'shadow', 'cyclops',
  'whiskers', 'fangs', 'tusks', 'spots', 'stripes', 'gills', 'visor', 'gem', 'third-eye', 'stitches',
]);
const LOOK_TAGS = new Set<Tag | null>(['face', 'eye', 'part']);
/** Pelo elemental y sombrero de hongo (render.ts: sustituyen al peinado; D-0024). */
const ELEMENT_HAIR = new Set<Part>(['flame-hair', 'water-hair', 'stone-hair', 'air-hair', 'mushroom-cap']);

// ── Medidas de K2 (definiciones del test) ─────────────────────────────────────────────────────────

const BODY_TAGS = new Set<Tag | null>(['cloth', 'trim', 'skin']);
const isBody = (L: Layers, x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && BODY_TAGS.has(L.tags[y * W + x]);

interface Rows { shoulder: number; belt: number; hip: number; sole: number }

/**
 * Filas del cuerpo, medidas desde spriteMetrics y los tags cloth/trim/skin:
 * - suela: `spriteMetrics.feetRow` (última fila de bota).
 * - entrepierna: columnas estrictamente entre las dos botas en la fila de la suela; cadera = primera fila de
 *   las piernas = la fila siguiente al último píxel de cuerpo que hay sobre esas columnas subiendo desde la suela
 *   (la que sube más alto).
 * - columnas del torso: el tramo de cuerpo, en la fila sobre la cadera, que contiene la entrepierna.
 * - cinturón: subiendo desde la cadera, la primera banda de filas con algún `trim` en las columnas del torso;
 *   el cinturón es la fila superior de esa banda.
 * - hombro: bajando desde la barbilla (`spriteMetrics.face`), la primera fila cuyo cuerpo abarca ≥ 10 columnas
 *   (el cuello y el cuello de la camisa abarcan ≤ 7; los hombros, ≥ 12).
 * Recuentos: cadera→suela = suela − cadera + 1; cinturón→suela = suela − cinturón + 1; hombro→cinturón =
 * cinturón − hombro (filas de torso por encima del cinturón).
 */
function bodyRows(a: Appearance, v: RaceVisual): Rows | string {
  const L = renderLayers(a, v);
  const m = spriteMetrics(a, v);
  const sole = m.feetRow;
  if (sole < 0) return 'sin fila de suela (feetRow)';
  const runs: [number, number][] = [];
  for (let x = 0; x < W; x++) {
    if (!isBody(L, x, sole)) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === x - 1) last[1] = x;
    else runs.push([x, x]);
  }
  if (runs.length < 2) return `la fila de la suela ${sole} no tiene dos botas (${runs.length} tramos)`;
  let hip = H;
  let crotch = -1;
  for (let x = runs[0][1] + 1; x < runs[1][0]; x++) {
    let y = sole;
    while (y >= 0 && !isBody(L, x, y)) y--;
    if (y + 1 < hip) { hip = y + 1; crotch = x; }
  }
  if (crotch < 0) return 'sin entrepierna entre las botas';
  let x0 = crotch, x1 = crotch;
  while (x0 - 1 >= 0 && isBody(L, x0 - 1, hip - 1)) x0--;
  while (x1 + 1 < W && isBody(L, x1 + 1, hip - 1)) x1++;
  const trimRow = (y: number) => {
    for (let x = x0; x <= x1; x++) if (L.tags[y * W + x] === 'trim') return true;
    return false;
  };
  let y = hip - 1;
  while (y >= 0 && !trimRow(y)) y--;
  if (y < 0) return 'sin cinturón (trim) sobre la cadera';
  while (y - 1 >= 0 && trimRow(y - 1)) y--;
  const belt = y;
  const chin = m.face.y + m.face.h - 1;
  let shoulder = -1;
  for (let r = chin + 1; r < belt && shoulder < 0; r++) {
    let lo = W, hi = -1;
    for (let x = 0; x < W; x++) if (isBody(L, x, r)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    if (hi - lo + 1 >= 10) shoulder = r;
  }
  if (shoulder < 0) return `sin fila de hombros entre la barbilla ${chin} y el cinturón ${belt}`;
  return { shoulder, belt, hip, sole };
}

// ── Golden (K7) ──────────────────────────────────────────────────────────────────────────────────

interface NodeFs {
  existsSync(path: URL): boolean;
  readFileSync(path: URL, encoding: 'utf8'): string;
  writeFileSync(path: URL, data: string): void;
  mkdirSync(path: URL, options: { recursive: true }): void;
}
interface NodeCrypto { createHash(algorithm: 'sha256'): { update(data: ArrayBufferView): { digest(encoding: 'hex'): string } } }
// Especificadores en variables: src se compila sin @types/node (tsconfig.app.json), así que se tipa lo usado.
const NODE_FS = 'node:fs';
const NODE_CRYPTO = 'node:crypto';
const fs = (await import(/* @vite-ignore */ NODE_FS)) as NodeFs;
const { createHash } = (await import(/* @vite-ignore */ NODE_CRYPTO)) as NodeCrypto;
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const GOLDEN_DIR = new URL('./golden/', import.meta.url);
const GOLDEN = new URL('./golden/sprites.json', import.meta.url);
const AURA = auraForClass('Wizard') as string;

interface GoldenRender { id: string; a: Appearance; v: RaceVisual; prop: Prop | null }

/** Conjunto fijo: 12 peinados × 2, 10 atuendos × 2, 4 tallas, cada prop, cada familia × opción y la galería. */
function goldenRenders(): GoldenRender[] {
  const human = humanVisual();
  const pad = (n: number) => String(n).padStart(2, '0');
  const out: GoldenRender[] = [];
  for (let h = 0; h < HAIR_STYLES.length; h++) {
    for (const body of [0, 1] as const) out.push({ id: `hair/${pad(h)}/b${body}`, a: baseAppearance({ hair: h, body }), v: human, prop: null });
  }
  for (let o = 0; o < OUTFITS.length; o++) {
    for (const body of [0, 1] as const) out.push({ id: `outfit/${pad(o)}/b${body}`, a: baseAppearance({ outfit: o, body }), v: human, prop: null });
  }
  for (const s of SIZES) out.push({ id: `size/${s}`, a: baseAppearance(), v: sized(human, s), prop: null });
  for (const prop of PROPS) out.push({ id: `prop/${prop}`, a: baseAppearance(), v: human, prop });
  for (const c of FAMILY_CASES) out.push({ id: `family/${c.key}/${c.f}`, a: c.a, v: c.v, prop: null });
  for (const cell of galleryCells()) out.push({ id: `gallery/${cell.label}`, a: cell.a, v: cell.v, prop: cell.prop });
  return out;
}

function goldenHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of goldenRenders()) {
    for (const [suffix, aura] of [['plain', null], ['aura', AURA]] as const) {
      out[`${r.id}|${suffix}`] = createHash('sha256').update(renderPixels(r.a, r.v, aura, r.prop)).digest('hex');
    }
  }
  return out;
}

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────

describe('T-7 · cobertura del sprite (plantillas, proporción, nada flota, golden)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('K1 plantillas una vez (RG-1.4): tras renderizar cada familia × opción, un segundo pase no compila plantillas nuevas', () => {
    for (const c of FAMILY_CASES) renderPixels(c.a, c.v);
    const warm = templateCompileCount();
    expect(warm, 'el contador observa las compilaciones de tpl() (el primer pase compila plantillas)').toBeGreaterThan(0);
    for (const c of FAMILY_CASES) renderPixels(c.a, c.v);
    expect(templateCompileCount() - warm, `plantillas compiladas en el segundo pase de ${FAMILY_CASES.length} renders`).toBe(0);
  });

  it('K2 proporción (E-0005): humano M, complexiones 0 y 1, atuendos 2 y 6: cadera→suela 11–12, cinturón→suela ≤ 15, hombro→cinturón 9–11', () => {
    const bad: string[] = [];
    const human = humanVisual();
    for (const outfit of [2, 6]) {
      for (const body of [0, 1] as const) {
        const id = `atuendo ${outfit} complexión ${body}`;
        const r = bodyRows(baseAppearance({ outfit, body }), human);
        if (typeof r === 'string') { bad.push(`${id}: ${r}`); continue; }
        const legs = r.sole - r.hip + 1;
        const beltToSole = r.sole - r.belt + 1;
        const torso = r.belt - r.shoulder;
        const rows = `hombro ${r.shoulder}, cinturón ${r.belt}, cadera ${r.hip}, suela ${r.sole}`;
        if (legs < 11 || legs > 12) bad.push(`${id}: cadera→suela ${legs} filas fuera de [11,12] (${rows})`);
        if (beltToSole > 15) bad.push(`${id}: cinturón→suela ${beltToSole} filas > 15 (${rows})`);
        if (torso < 9 || torso > 11) bad.push(`${id}: hombro→cinturón ${torso} filas fuera de [9,11] (${rows})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('K3 nada flota (E-0002..E-0004): por familia × opción × talla S/M/L, lo que cambia al quitar una parte es 8-conexo con la silueta sin ella', () => {
    const bad: string[] = [];
    let renders = 0;
    const t0 = performance.now();
    for (const c of SIZED_CASES) {
      const L = layers(c);
      renders++;
      for (const part of c.parts) {
        const other = renderLayers(c.a, withoutPart(c.v, part));
        renders++;
        for (const g of groups(changed(L.px, other.px))) {
          if (g.some((i) => touches(other.px, i))) continue;
          bad.push(`${c.id} '${part}': ${g.length} px en ${fmt(boxOf(g))} separados de la silueta sin la parte`);
        }
      }
    }
    const ms = performance.now() - t0;
    expect(report(bad)).toEqual([]);
    expect(ms, `${renders} renders y comparaciones en ${ms.toFixed(0)} ms`).toBeLessThanOrEqual(5000);
  }, 30_000);

  it('K4 orientación (L-0001): hocico, pico y trompa a la izquierda del centro de la cara; colas y alas a la derecha de x = 23', () => {
    const bad: string[] = [];
    // Hocico, pico o trompa: píxeles `face` bajo los ojos hasta la barbilla (spriteMetrics.face). Centro de la
    // cara: centroide de los píxeles `face` por encima de los ojos (el cráneo, sin la parte baja de la cara).
    const snouts = SIZED_CASES.filter((c) => SNOUT_HEADS.has(c.v.head) && c.f === 0);
    expect(snouts.length, 'familias con hocico, pico o trompa').toBeGreaterThan(0);
    for (const c of snouts) {
      const L = layers(c);
      const m = spriteMetrics(c.a, c.v);
      if (!m.eyes.length) { bad.push(`${c.id}: sin ojos para separar cráneo y hocico`); continue; }
      const eyeTop = Math.min(...m.eyes.map((e) => e.y));
      const eyeBottom = Math.max(...m.eyes.map((e) => e.y + e.h - 1));
      const chin = m.face.y + m.face.h - 1;
      const low: number[] = [];
      const top: number[] = [];
      for (let i = 0; i < W * H; i++) {
        if (L.tags[i] !== 'face') continue;
        const y = Math.floor(i / W);
        if (y > eyeBottom && y <= chin) low.push(i);
        else if (y < eyeTop) top.push(i);
      }
      if (!low.length || !top.length) { bad.push(`${c.id}: sin píxeles de hocico (${low.length}) o de cráneo (${top.length})`); continue; }
      const snout = centroidX(low);
      const centre = centroidX(top);
      if (snout >= centre) bad.push(`${c.id} (${c.v.head}): centroide del hocico x=${snout.toFixed(1)} no queda a la izquierda del centro de la cara x=${centre.toFixed(1)}`);
    }
    // Colas y alas: píxeles `part` que cambian al quitar la parte por lista. Una parte sin píxeles visibles
    // (hoy tail-stub en talla S, tapada por el cuerpo) no tiene orientación que medir: su visibilidad no es
    // criterio de K4 y queda fuera del recuento.
    let measured = 0;
    for (const c of SIZED_CASES) {
      const L = layers(c);
      for (const part of c.parts.filter((p) => TAILS_AND_WINGS.has(p))) {
        const other = renderLayers(c.a, withoutPart(c.v, part));
        const px = changed(L.px, other.px).filter((i) => L.tags[i] === 'part');
        if (!px.length) continue;
        measured++;
        const cx = centroidX(px);
        if (cx <= 23) bad.push(`${c.id} '${part}': centroide x=${cx.toFixed(1)} no queda a la derecha de x = 23`);
      }
    }
    expect(measured, 'colas y alas medidas').toBeGreaterThan(0);
    expect(report(bad)).toEqual([]);
  });

  it('K5 R5 fuerte (E-0006): en bestias, quitar una parte de cara por lista (misma clave) cambia píxeles face/eye/part', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const c of FAMILY_CASES.filter((k) => k.v.head === 'beast')) {
      const L = layers(c);
      for (const part of c.parts.filter((p) => FACE_PARTS.has(p))) {
        checked++;
        const other = renderLayers(c.a, withoutPart(c.v, part));
        const hits = changed(L.px, other.px).filter((i) => LOOK_TAGS.has(L.tags[i]) || LOOK_TAGS.has(other.tags[i]));
        if (!hits.length) bad.push(`${c.id} '${part}': quitarla no cambia píxeles face/eye/part`);
      }
    }
    expect(checked, 'partes de cara en bestias').toBeGreaterThan(0);
    expect(report(bad)).toEqual([]);
  });

  it('K8 familias sin pelo o con pelo elemental: appearance.hair 1–11 no agrega píxeles de hair.ts', () => {
    const bad: string[] = [];
    const targets = FAMILY_CASES.filter((c) => !c.v.hair || c.parts.some((p) => ELEMENT_HAIR.has(p)));
    expect(targets.length, 'familias sin pelo o con pelo elemental').toBeGreaterThan(0);
    const HAIR_TAGS = new Set<Tag | null>(['hair', 'hair-back']);
    for (const c of targets) {
      const elemental = c.parts.some((p) => ELEMENT_HAIR.has(p));
      const ref = renderLayers({ ...c.a, hair: 0 }, c.v);
      if (!elemental && ref.tags.some((t) => HAIR_TAGS.has(t))) bad.push(`${c.id}: píxeles hair/hair-back con hair = 0`);
      for (let h = 1; h < HAIR_STYLES.length; h++) {
        const L = renderLayers({ ...c.a, hair: h }, c.v);
        const id = `${c.id} hair=${h}`;
        if (!elemental && L.tags.some((t) => HAIR_TAGS.has(t))) { bad.push(`${id}: píxeles hair/hair-back en una familia sin pelo`); continue; }
        // hair.ts es el único que lee appearance.hair cuando la familia no tiene pelo: el render no debe cambiar.
        // Con pelo de familia (v.hair) y pelo elemental, se comparan solo los píxeles hair/hair-back.
        const diff = changed(L.px, ref.px).filter((i) => !c.v.hair || HAIR_TAGS.has(L.tags[i]) || HAIR_TAGS.has(ref.tags[i]));
        if (diff.length) bad.push(`${id}: ${diff.length} px distintos de hair = 0 (p. ej. ${fmt(boxOf(diff))})`);
      }
    }
    expect(report(bad)).toEqual([]);
  });

  it('K7 golden del arte aprobado (D-0026): sha256 de renderPixels del conjunto fijo = golden/sprites.json', () => {
    const now = goldenHashes();
    if (env.UPDATE_GOLDEN === '1') {
      const sorted = Object.fromEntries(Object.keys(now).sort().map((k) => [k, now[k]]));
      fs.mkdirSync(GOLDEN_DIR, { recursive: true });
      fs.writeFileSync(GOLDEN, `${JSON.stringify(sorted, null, 2)}\n`);
    }
    expect(fs.existsSync(GOLDEN), 'falta golden/sprites.json: se genera con UPDATE_GOLDEN=1 tras la aprobación visual').toBe(true);
    const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) as Record<string, string>;
    const bad: string[] = [];
    for (const [id, hash] of Object.entries(now)) {
      if (!(id in golden)) bad.push(`${id}: no está en el golden`);
      else if (golden[id] !== hash) bad.push(`${id}: el arte cambió`);
    }
    for (const id of Object.keys(golden)) if (!(id in now)) bad.push(`${id}: está en el golden y ya no se renderiza`);
    expect(Object.keys(now).length, 'renders del conjunto fijo').toBeGreaterThan(500);
    expect(report(bad)).toEqual([]);
  });

  it('K7 drawAvatarInto (render.ts, fuera del golden): copia el recorte sin suavizado y restaura el contexto', () => {
    // Sin DOM (entorno node): un document y un ImageData mínimos para la caché de avatarCanvas.
    const sprite = { width: 0, height: 0, getContext: () => ({ putImageData: () => {} }) };
    vi.stubGlobal('document', { createElement: () => sprite });
    vi.stubGlobal('ImageData', class {
      data: Uint8ClampedArray; width: number; height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; }
    });
    const calls: { smoothing: boolean; args: unknown[] }[] = [];
    const ctx = {
      imageSmoothingEnabled: true,
      drawImage(...args: unknown[]) { calls.push({ smoothing: this.imageSmoothingEnabled, args }); },
    };
    const v = humanVisual();
    const a = baseAppearance({ hair: 7, outfit: 3, body: 1 });
    drawAvatarInto(ctx as unknown as CanvasRenderingContext2D, a, v, AURA, 'bust', 4, 6, 96, 96);
    const r = cropRect(v, a, 'bust');
    expect(calls).toHaveLength(1);
    expect(calls[0].smoothing, 'imageSmoothingEnabled durante el dibujo').toBe(false);
    expect(calls[0].args).toEqual([sprite, r.x, r.y, r.w, r.h, 4, 6, 96, 96]);
    expect(ctx.imageSmoothingEnabled, 'el suavizado anterior se restaura').toBe(true);
  });
});
