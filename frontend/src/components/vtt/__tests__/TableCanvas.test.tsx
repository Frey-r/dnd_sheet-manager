/* TableCanvas (T-11 P6; replaces the D-0037 exception): what the VTT canvas paints, where and for whom (map, grid,
   tokens, objects, fog, walls, lights, zones, combat markers, ruler) and what each tool reports (select, drag, pan,
   zoom, pinch, wall, door, light, zone, object, erase).
   Sensor: a recording 2D context keeps, per frame (each setTransform), every fill, stroke, rectangle, text and image
   with the path and style in force. lib/vision's fog and drawAvatarInto are doubles; the canvas sits at (30, 40) on
   the page and measures 800×600, so a scene point p is at client (30 + view.x + p.x·z, 40 + view.y + p.y·z). */
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableCanvas } from '../TableCanvas';
import { auraForClass, defaultAppearance, resolveRaceVisual, type Appearance } from '../../../lib/avatar';
import { drawAvatarInto } from '../../../lib/avatar/render';
import { newExploredCanvas, renderFog, type FogResult } from '../../../lib/vision';
import type { VTTCombat, VTTObject, VTTScene, VTTToken } from '../../../services/vttApi';

vi.mock(import('../../../lib/avatar/render'), async (importOriginal) => ({
  ...(await importOriginal()),
  drawAvatarInto: vi.fn(),
}));
vi.mock(import('../../../lib/vision'), async (importOriginal) => ({
  ...(await importOriginal()),
  renderFog: vi.fn(),
  newExploredCanvas: vi.fn(),
}));

// ── Sensor: recording 2D context ────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number }
interface PathOp { op: 'moveTo' | 'lineTo' | 'arc' | 'closePath'; args: number[] }
interface Style { fillStyle: string; strokeStyle: string; lineWidth: number; globalAlpha: number; dash: number[]; font: string }
interface Paint { op: 'fill' | 'stroke' | 'clip' | 'fillRect' | 'fillText' | 'drawImage'; args: unknown[]; path: PathOp[]; style: Style }
interface Frame { size: [number, number]; transform: number[]; view: { x: number; y: number; z: number }; paints: Paint[] }

const blank = (): Style => ({ fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1, dash: [], font: '10px sans-serif' });
const copy = (s: Style): Style => ({ ...s, dash: [...s.dash] });

class RecordingContext {
  readonly frames: Frame[] = [];
  readonly canvas: HTMLCanvasElement;
  textAlign = 'start';
  textBaseline = 'alphabetic';
  private s = blank();
  private stack: Style[] = [];
  private path: PathOp[] = [];
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

  get fillStyle() { return this.s.fillStyle; }
  set fillStyle(v: string) { this.s.fillStyle = v; }
  get strokeStyle() { return this.s.strokeStyle; }
  set strokeStyle(v: string) { this.s.strokeStyle = v; }
  get lineWidth() { return this.s.lineWidth; }
  set lineWidth(v: number) { this.s.lineWidth = v; }
  get globalAlpha() { return this.s.globalAlpha; }
  set globalAlpha(v: number) { this.s.globalAlpha = v; }
  get font() { return this.s.font; }
  set font(v: string) { this.s.font = v; }

  private get frame() { return this.frames[this.frames.length - 1]; }
  private paint(op: Paint['op'], args: unknown[]) { this.frame.paints.push({ op, args, path: [...this.path], style: copy(this.s) }); }

  /** Each draw pass starts here, right after resizing the backing store (which resets the state). */
  setTransform(...m: number[]) {
    this.s = blank();
    this.stack = [];
    this.frames.push({ size: [this.canvas.width, this.canvas.height], transform: m, view: { x: 0, y: 0, z: 1 }, paints: [] });
  }
  translate(x: number, y: number) { this.frame.view.x = x; this.frame.view.y = y; }
  scale(z: number) { this.frame.view.z = z; }
  save() { this.stack.push(copy(this.s)); }
  restore() { this.s = this.stack.pop() ?? blank(); }
  beginPath() { this.path = []; }
  moveTo(x: number, y: number) { this.path.push({ op: 'moveTo', args: [x, y] }); }
  lineTo(x: number, y: number) { this.path.push({ op: 'lineTo', args: [x, y] }); }
  arc(...args: number[]) { this.path.push({ op: 'arc', args }); }
  closePath() { this.path.push({ op: 'closePath', args: [] }); }
  fill() { this.paint('fill', []); }
  stroke() { this.paint('stroke', []); }
  clip() { this.paint('clip', []); }
  setLineDash(d: number[]) { this.s.dash = [...d]; }
  fillRect(...args: number[]) { this.paint('fillRect', args); }
  fillText(...args: unknown[]) { this.paint('fillText', args); }
  drawImage(...args: unknown[]) { this.paint('drawImage', args); }
  measureText(t: string) { return { width: t.length * 7 }; }
}

let ctx: RecordingContext;
const frame = () => ctx.frames[ctx.frames.length - 1];
const near = (a: unknown, b: number, eps = 1e-6) => typeof a === 'number' && Math.abs(a - b) < eps;
const isArc = (o: PathOp, x: number, y: number, r?: number) => o.op === 'arc' && near(o.args[0], x) && near(o.args[1], y) && (r === undefined || near(o.args[2], r));
/** Fills or strokes whose path is a circle centred on (x, y) (and radius r, when given). */
const circles = (op: 'fill' | 'stroke' | 'clip', x: number, y: number, r?: number) => frame().paints.filter((p) => p.op === op && p.path.some((o) => isArc(o, x, y, r)));
/** Strokes whose path contains the segment a → b. */
const segments = (a: Pt, b: Pt) => frame().paints.filter((p) => p.op === 'stroke' && p.path.some((o, i) => (
  o.op === 'moveTo' && near(o.args[0], a.x) && near(o.args[1], a.y)
  && p.path[i + 1]?.op === 'lineTo' && near(p.path[i + 1].args[0], b.x) && near(p.path[i + 1].args[1], b.y)
)));
const texts = (s: string) => frame().paints.filter((p) => p.op === 'fillText' && p.args[0] === s);
const rects = () => frame().paints.filter((p) => p.op === 'fillRect');
const images = (src: unknown) => frame().paints.filter((p) => p.op === 'drawImage' && p.args[0] === src);
const indexOf = (p: Paint | undefined) => (p ? frame().paints.indexOf(p) : -1);

// ── Page geometry ───────────────────────────────────────────────────────────────────────────────

const RECT = { left: 30, top: 40 };
/** 800×400 scene fitted at 95 % in the 800×600 canvas: z = 0.95, centred. */
const VIEW = { z: 0.95, x: (800 - 800 * 0.95) / 2, y: (600 - 400 * 0.95) / 2 };
const client = (p: Pt, v = VIEW) => ({ clientX: RECT.left + v.x + p.x * v.z, clientY: RECT.top + v.y + p.y * v.z });
const sceneUnder = (c: { clientX: number; clientY: number }, v: { x: number; y: number; z: number }) => ({
  x: (c.clientX - RECT.left - v.x) / v.z, y: (c.clientY - RECT.top - v.y) / v.z,
});
const zoomLabel = () => screen.getByText(/^\d+%$/).textContent;
const closeTo = (p: Pt) => expect.objectContaining({ x: expect.closeTo(p.x, 6), y: expect.closeTo(p.y, 6) });

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────

const GM = 1;
const PLAYER = 3;
const CELL = 50;
/** Token radius for one cell: half the cell minus the 3 px ring. */
const R1 = CELL / 2 - 3;
const ACCENT = '#ff6a3d';

const scene = (over: Partial<VTTScene> = {}): VTTScene => ({
  id: 1, campaign_id: 7, name: 'Cripta', map_url: '', width_px: 800, height_px: 400, grid_size_px: CELL,
  grid_offset_x: 0, grid_offset_y: 0, feet_per_cell: 5, ambient_light: 'bright', fog_enabled: true,
  walls: [], lights: [], mode: 'exploration', exploration_pace: 0, zones: [], is_active: true, ...over,
});

let nextId = 100;
const token = (over: Partial<VTTToken> = {}): VTTToken => ({
  id: nextId++, scene_id: 1, name: 'Goblin', kind: 'monster', character_id: null, owner_user_id: null, image_url: '',
  color: '#2e86de', x: 100, y: 100, size_cells: 1, hp: 10, max_hp: 10, ac: 12, hidden: false, vision_ft: 60,
  darkvision_ft: 0, blindsight_ft: 0, light_bright_ft: 0, light_dim_ft: 0, speed_ft: 30, passive_perception: 10,
  stealth_bonus: 0, dex_mod: 0, sneaking: false, detects: false, ...over,
});

const object = (over: Partial<VTTObject> = {}): VTTObject => ({
  id: nextId++, scene_id: 1, name: 'Cofre', icon: 'chest', x: 300, y: 300, depleted: false, ...over,
});

const combat = (over: Partial<VTTCombat> = {}): VTTCombat => ({
  id: nextId++, scene_id: 1, round: 1, turn_index: 0, turn_seconds: 60, paused: false, remaining_ms: 60000,
  center_x: 300, center_y: 300, combatants: [], ...over,
});

const FOG_CANVAS = { overlay: 'fog' } as unknown as HTMLCanvasElement;
/** The fog double reveals the left half of the scene (x < 400). */
const FOG: FogResult = { fog: FOG_CANVAS, visible: FOG_CANVAS, scale: 1, isVisible: (x: number) => x < 400 };
const toDataURL = vi.fn(() => 'data:image/png;base64,RVhQTE9SRUQ=');
const EXPLORED = { toDataURL } as unknown as HTMLCanvasElement;

/** Image double: URLs in READY are already decoded; the rest load when the test says so. */
const READY = new Set<string>();
const created: FakeImage[] = [];
class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  private url = '';
  constructor() { super(); created.push(this); }
  get src() { return this.url; }
  set src(v: string) {
    this.url = v;
    if (READY.has(v)) { this.complete = true; this.naturalWidth = 64; }
  }
  finishLoading() { this.complete = true; this.naturalWidth = 1024; this.dispatchEvent(new Event('load')); }
}

type Props = ComponentProps<typeof TableCanvas>;
const handlers = () => ({
  onSelect: vi.fn(), onMove: vi.fn(), onWalls: vi.fn(), onLights: vi.fn(),
  onSelectObject: vi.fn(), onPlaceObject: vi.fn(), onZones: vi.fn(),
});

function renderTable(over: Partial<Props> = {}) {
  const props: Props = {
    scene: scene(), tokens: [], isGM: true, userId: GM, viewers: null, tool: 'select', selectedId: null,
    ...handlers(), ...over,
  };
  const view = render(<TableCanvas {...props} />);
  const canvas = screen.getByLabelText(`Mesa virtual: ${props.scene.name}`) as HTMLCanvasElement;
  canvas.setPointerCapture = vi.fn();
  return { ...view, canvas, props, user: userEvent.setup() };
}

let pointer = 1;
const down = (cv: HTMLElement, p: Pt, init: Record<string, number> = {}) => fireEvent.pointerDown(cv, { pointerId: pointer, button: 0, buttons: 1, ...client(p), ...init });
const move = (cv: HTMLElement, p: Pt, init: Record<string, number> = {}) => fireEvent.pointerMove(cv, { pointerId: pointer, buttons: 1, ...client(p), ...init });
const up = (cv: HTMLElement, p: Pt, init: Record<string, number> = {}) => fireEvent.pointerUp(cv, { pointerId: pointer, button: 0, buttons: 0, ...client(p), ...init });
const tap = (cv: HTMLElement, p: Pt) => { down(cv, p); up(cv, p); };

beforeEach(() => {
  pointer = 1;
  created.length = 0;
  READY.clear();
  localStorage.clear();
  toDataURL.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('Image', FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    ctx ??= new RecordingContext(this);
    return ctx;
  } as unknown as HTMLCanvasElement['getContext']);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: RECT.left, top: RECT.top, x: RECT.left, y: RECT.top, width: 800, height: 600, right: RECT.left + 800, bottom: RECT.top + 600, toJSON: () => ({}),
  } as DOMRect);
  vi.mocked(renderFog).mockReturnValue(FOG);
  vi.mocked(newExploredCanvas).mockReturnValue(EXPLORED);
});
afterEach(() => {
  ctx = undefined as unknown as RecordingContext;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── Drawing ─────────────────────────────────────────────────────────────────────────────────────

describe('TableCanvas · mapa, cuadrícula y encuadre', () => {
  it('encaja la escena al 95 % centrada en el canvas y pinta el fondo de la página', () => {
    renderTable();
    expect(zoomLabel()).toBe('95%');
    expect(frame().view).toEqual(VIEW);
    expect(frame().size).toEqual([800, 600]);
    const [bg] = rects();
    expect(bg.args).toEqual([0, 0, 800, 600]);
    expect(bg.style.fillStyle, 'color de fondo por defecto').toBe('#0c0d10');
  });

  it('en pantallas de alta densidad el canvas usa píxeles físicos', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    renderTable();
    expect(frame().size).toEqual([1600, 1200]);
    expect(frame().transform).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it('sin mapa pinta la escena en gris; cuando el mapa carga lo dibuja a tamaño de escena', () => {
    renderTable({ scene: scene({ map_url: '/uploads/cripta.png' }) });
    expect(rects().some((p) => p.style.fillStyle === '#23262c' && p.args.join() === '0,0,800,400'), 'escena gris mientras carga').toBe(true);
    const map = created.find((i) => i.src === '/uploads/cripta.png')!;
    expect(images(map)).toHaveLength(0);

    act(() => map.finishLoading());
    expect(images(map).map((p) => p.args.slice(1))).toEqual([[0, 0, 800, 400]]);
    expect(rects().some((p) => p.style.fillStyle === '#23262c'), 'ya no hay gris').toBe(false);
  });

  it('la cuadrícula sigue el tamaño de celda y el desplazamiento de la escena', () => {
    renderTable({ scene: scene({ grid_offset_x: 10, grid_offset_y: 20 }) });
    const grid = frame().paints.find((p) => p.op === 'stroke' && p.style.strokeStyle === 'rgba(0,0,0,.28)')!;
    expect(grid.style.lineWidth).toBeCloseTo(1 / VIEW.z);
    const ends = grid.path.filter((o) => o.op === 'lineTo');
    const columns = ends.filter((o) => o.args[1] === 400).map((o) => o.args[0]);
    const rows = ends.filter((o) => o.args[0] === 800).map((o) => o.args[1]);
    expect(columns).toEqual([10, 60, 110, 160, 210, 260, 310, 360, 410, 460, 510, 560, 610, 660, 710, 760]);
    expect(rows).toEqual([20, 70, 120, 170, 220, 270, 320, 370]);
  });
});

describe('TableCanvas · tokens', () => {
  it('un token sin imagen es un círculo de su color con sus iniciales', () => {
    const t = token({ name: 'goblin jefe guerrero', color: '#2e86de', x: 150, y: 250 });
    renderTable({ tokens: [t] });
    const [body] = circles('fill', 150, 250, R1);
    expect(body.style.fillStyle).toBe('#2e86de');
    expect(body.style.globalAlpha).toBe(1);
    expect(texts('GJ').map((p) => p.args.slice(1))).toEqual([[150, 251]]);
    const ring = circles('stroke', 150, 250, R1)[0];
    expect(ring.style.strokeStyle, 'aro neutro').toBe('rgba(0,0,0,.55)');
    expect(ring.style.dash).toEqual([]);
  });

  it('sin color usa el rojo por defecto; dos celdas dan un radio mayor', () => {
    renderTable({ tokens: [token({ color: '', x: 200, y: 200, size_cells: 2 })] });
    expect(circles('fill', 200, 200, CELL - 3)[0].style.fillStyle).toBe('#c0392b');
  });

  it('seleccionado lleva aro blanco; el propio, el color de acento; oculto, translúcido y discontinuo', () => {
    const selected = token({ x: 100, y: 100 });
    const mine = token({ x: 200, y: 100, owner_user_id: PLAYER, kind: 'pc' });
    const hidden = token({ x: 300, y: 100, hidden: true });
    renderTable({ tokens: [selected, mine, hidden], isGM: false, userId: PLAYER, selectedId: selected.id });
    expect(circles('stroke', 100, 100, R1)[0].style.strokeStyle).toBe('#ffffff');
    expect(circles('stroke', 200, 100, R1)[0].style.strokeStyle).toBe(ACCENT);
    const ghostly = circles('stroke', 300, 100, R1)[0];
    expect(ghostly.style.globalAlpha).toBe(0.45);
    expect(ghostly.style.dash).toEqual([6, 4]);
    expect(circles('fill', 300, 100, R1)[0].style.globalAlpha).toBe(0.45);
  });

  it('vinculado a un personaje: busto del avatar dentro del círculo, relleno y aro del aura de su clase', () => {
    const look: Appearance = { ...defaultAppearance(resolveRaceVisual('Human')), skin: '#3a9d5c' };
    const t = token({ character_id: 42, x: 200, y: 150 });
    renderTable({ tokens: [t], characters: [{ id: 42, race: 'Human', class: 'Fighter', appearance: look }] });
    const aura = auraForClass('Fighter')!;
    expect(circles('fill', 200, 150, R1)[0].style.fillStyle).toBe(`${aura}55`);
    expect(circles('stroke', 200, 150, R1)[0].style.strokeStyle).toBe(aura);
    expect(drawAvatarInto).toHaveBeenLastCalledWith(ctx, look, resolveRaceVisual('Human'), null, 'bust', 200 - R1, 150 - R1, 2 * R1, 2 * R1);
    expect(circles('clip', 200, 150, R1), 'el avatar se recorta al círculo').toHaveLength(1);
    expect(texts('G'), 'sin iniciales').toHaveLength(0);
  });

  it('un personaje que no está en la campaña se dibuja como token normal', () => {
    renderTable({ tokens: [token({ name: 'Lyra', character_id: 99 })], characters: [{ id: 42, race: 'Human', class: 'Fighter' }] });
    expect(drawAvatarInto).not.toHaveBeenCalled();
    expect(texts('L')).toHaveLength(1);
  });

  it('con imagen propia dibuja la imagen recortada al círculo y no el avatar del personaje', () => {
    READY.add('/uploads/lyra.png');
    const t = token({ image_url: '/uploads/lyra.png', character_id: 42, color: '#123456', x: 100, y: 300 });
    renderTable({ tokens: [t], characters: [{ id: 42, race: 'Human', class: 'Fighter' }] });
    const img = created.find((i) => i.src === '/uploads/lyra.png');
    expect(images(img).map((p) => p.args.slice(1))).toEqual([[100 - R1, 300 - R1, 2 * R1, 2 * R1]]);
    expect(circles('fill', 100, 300, R1)[0].style.fillStyle, 'color del token, no el aura').toBe('#123456');
    expect(drawAvatarInto).not.toHaveBeenCalled();
  });

  it('barra de vida bajo el token: ancho proporcional y color según lo que queda', () => {
    const cases = [
      { hp: 10, x: 100, color: '#45c48a', pct: 1 },
      { hp: 5, x: 200, color: '#e9a23b', pct: 0.5 },
      { hp: 2, x: 300, color: '#ef4f55', pct: 0.2 },
      { hp: 0, x: 400, color: '#ef4f55', pct: 0 },
      { hp: 15, x: 500, color: '#45c48a', pct: 1 },
    ];
    renderTable({ tokens: cases.map((c) => token({ hp: c.hp, max_hp: 10, x: c.x, y: 200 })) });
    const bw = R1 * 1.6;
    for (const c of cases) {
      const bx = c.x - bw / 2, by = 200 + R1 + 4;
      const bars = rects().filter((p) => near(p.args[0], bx) && near(p.args[1], by));
      expect(bars.map((p) => p.style.fillStyle), `hp ${c.hp}`).toEqual(['rgba(0,0,0,.65)', c.color]);
      expect(bars[0].args[2]).toBeCloseTo(bw);
      expect(bars[1].args[2], `hp ${c.hp}: ancho`).toBeCloseTo(bw * c.pct);
      expect(bars[1].args[3]).toBe(5);
    }
  });

  it('el DM ve la vida de todos; un jugador, la de los PJ y la de sus tokens, nunca la de los monstruos', () => {
    const monster = token({ kind: 'monster', x: 100, y: 100 });
    const ally = token({ kind: 'pc', owner_user_id: 8, x: 200, y: 100 });
    const pet = token({ kind: 'npc', owner_user_id: PLAYER, x: 300, y: 100 });
    const noHp = token({ kind: 'pc', max_hp: 0, hp: 0, x: 350, y: 300 });
    const tokens = [monster, ally, pet, noHp];
    const barAt = (t: VTTToken) => rects().some((p) => near(p.args[0], t.x - R1 * 0.8) && near(p.args[1], t.y + R1 + 4));

    const gm = renderTable({ tokens, isGM: true, userId: GM });
    expect([monster, ally, pet, noHp].map(barAt), 'DM').toEqual([true, true, true, false]);
    gm.unmount();
    ctx = undefined as unknown as RecordingContext;

    renderTable({ tokens, isGM: false, userId: PLAYER });
    expect([monster, ally, pet, noHp].map(barAt), 'jugador').toEqual([false, true, true, false]);
  });

  it('el token con el turno del combate lleva un segundo aro de acento', () => {
    const active = token({ x: 100, y: 100 });
    const waiting = token({ x: 200, y: 100 });
    const c = combat({ turn_index: 1, combatants: [
      { id: 1, token_id: waiting.id, initiative: 18, is_player: false, movement_used_ft: 0, dashed: false, name: 'b' },
      { id: 2, token_id: active.id, initiative: 12, is_player: false, movement_used_ft: 0, dashed: false, name: 'a' },
    ] });
    renderTable({ tokens: [active, waiting], combats: [c] });
    const ring = circles('stroke', 100, 100, R1 + 7);
    expect(ring).toHaveLength(1);
    expect(ring[0].style.strokeStyle).toBe(ACCENT);
    expect(circles('stroke', 200, 100, R1 + 7)).toHaveLength(0);
  });
});

describe('TableCanvas · niebla de guerra', () => {
  const mine = token({ owner_user_id: PLAYER, kind: 'pc', x: 100, y: 100 });
  const near1 = token({ x: 300, y: 100 });
  const far = token({ x: 600, y: 100 });
  const mineFar = token({ owner_user_id: PLAYER, kind: 'pc', x: 700, y: 300 });
  const tokens = [mine, near1, far, mineFar];

  it('con visores calcula la niebla desde la memoria explorada y la pinta sobre los tokens', () => {
    localStorage.setItem(`vtt-explored:1:${PLAYER}:${mine.id}`, 'data:saved');
    const s = scene();
    renderTable({ scene: s, tokens, viewers: [mine], isGM: false, userId: PLAYER });
    expect(newExploredCanvas).toHaveBeenCalledWith(s, 'data:saved');
    expect(renderFog).toHaveBeenCalledWith(s, tokens, [mine], EXPLORED);
    const [fog] = images(FOG_CANVAS);
    expect(fog.args.slice(1)).toEqual([0, 0, 800, 400]);
    expect(indexOf(fog), 'la niebla va encima de los tokens').toBeGreaterThan(indexOf(circles('stroke', 100, 100, R1)[0]));
  });

  it('el jugador solo ve los tokens que su niebla revela, y siempre los suyos', () => {
    renderTable({ tokens, viewers: [mine], isGM: false, userId: PLAYER });
    expect(circles('fill', 100, 100, R1), 'propio y visible').toHaveLength(1);
    expect(circles('fill', 300, 100, R1), 'ajeno y visible').toHaveLength(1);
    expect(circles('fill', 600, 100, R1), 'ajeno bajo la niebla').toHaveLength(0);
    expect(circles('fill', 700, 300, R1), 'propio bajo la niebla').toHaveLength(1);
  });

  it('el DM que previsualiza la visión de un jugador ve lo mismo que él; sin visores lo ve todo', () => {
    const preview = renderTable({ tokens, viewers: [mine], isGM: true, userId: GM });
    expect(circles('fill', 600, 100, R1)).toHaveLength(0);
    expect(circles('fill', 700, 300, R1)).toHaveLength(0);
    preview.unmount();
    ctx = undefined as unknown as RecordingContext;
    vi.mocked(renderFog).mockClear();

    renderTable({ tokens, viewers: null, isGM: true, userId: GM });
    expect(renderFog).not.toHaveBeenCalled();
    expect(images(FOG_CANVAS)).toHaveLength(0);
    for (const t of tokens) expect(circles('fill', t.x, t.y, R1), `token en ${t.x}`).toHaveLength(1);
  });

  it('con la niebla desactivada en la escena no hay niebla aunque haya visores', () => {
    renderTable({ scene: scene({ fog_enabled: false }), tokens, viewers: [mine], isGM: false, userId: PLAYER });
    expect(renderFog).not.toHaveBeenCalled();
    expect(images(FOG_CANVAS)).toHaveLength(0);
    expect(circles('fill', 600, 100, R1)).toHaveLength(1);
  });

  it('guarda lo explorado por escena, usuario y visores 1,5 s después de calcular la niebla', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderTable({ tokens, viewers: [mine, mineFar], isGM: false, userId: PLAYER });
    const key = `vtt-explored:1:${PLAYER}:${mine.id}-${mineFar.id}`;
    act(() => vi.advanceTimersByTime(1400));
    expect(localStorage.getItem(key)).toBeNull();
    act(() => vi.advanceTimersByTime(100));
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(localStorage.getItem(key)).toBe('data:image/png;base64,RVhQTE9SRUQ=');
  });

  it('sin niebla no guarda nada', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderTable({ tokens, viewers: null });
    act(() => vi.advanceTimersByTime(5000));
    expect(localStorage.length).toBe(0);
  });
});

describe('TableCanvas · objetos interactivos', () => {
  it('un objeto es un disco ámbar con su icono; agotado, translúcido; con CD de descubrimiento, aro azul discontinuo; seleccionado, blanco', () => {
    const plain = object({ x: 100, y: 300, icon: 'chest' });
    const spent = object({ x: 200, y: 300, depleted: true, icon: '' });
    const secret = object({ x: 300, y: 300, discover_dc: 15 });
    const picked = object({ x: 150, y: 50 });
    renderTable({ objects: [plain, spent, secret, picked], selectedObjectId: picked.id });
    const r = CELL * 0.32;
    expect(circles('fill', 100, 300, r)[0].style).toMatchObject({ fillStyle: 'rgba(233,180,76,.92)', globalAlpha: 1 });
    expect(circles('stroke', 100, 300, r)[0].style).toMatchObject({ strokeStyle: '#1d1405', dash: [] });
    expect(texts('chest').some((p) => p.args[1] === 100 && p.args[2] === 301)).toBe(true);
    expect(circles('fill', 200, 300, r)[0].style.globalAlpha).toBe(0.35);
    expect(texts('inventory_2').map((p) => p.args.slice(1)), 'icono por defecto').toEqual([[200, 301]]);
    expect(circles('stroke', 300, 300, r)[0].style).toMatchObject({ strokeStyle: 'rgba(90,169,230,.95)', dash: [5, 4] });
    expect(circles('stroke', 150, 50, r)[0].style.strokeStyle).toBe('#ffffff');
  });

  it('un jugador sin niebla ve los objetos; con niebla, solo los revelados; el DM, todos', () => {
    const lit = object({ x: 100, y: 300 });
    const dark = object({ x: 600, y: 300 });
    const viewer = token({ owner_user_id: PLAYER, x: 50, y: 50 });
    const r = CELL * 0.32;

    const open = renderTable({ objects: [lit, dark], isGM: false, userId: PLAYER, viewers: null });
    expect([circles('fill', 100, 300, r).length, circles('fill', 600, 300, r).length], 'sin niebla').toEqual([1, 1]);
    open.unmount();
    ctx = undefined as unknown as RecordingContext;

    const fogged = renderTable({ objects: [lit, dark], tokens: [viewer], isGM: false, userId: PLAYER, viewers: [viewer] });
    expect([circles('fill', 100, 300, r).length, circles('fill', 600, 300, r).length], 'jugador con niebla').toEqual([1, 0]);
    fogged.unmount();
    ctx = undefined as unknown as RecordingContext;

    renderTable({ objects: [lit, dark], tokens: [viewer], isGM: true, userId: GM, viewers: [viewer] });
    expect([circles('fill', 100, 300, r).length, circles('fill', 600, 300, r).length], 'DM con niebla').toEqual([1, 1]);
  });
});

describe('TableCanvas · capas del DM: muros, puertas, luces y zonas', () => {
  const wall = { x1: 100, y1: 50, x2: 100, y2: 350, door: false, open: false };
  const closed = { x1: 200, y1: 50, x2: 250, y2: 50, door: true, open: false };
  const opened = { x1: 300, y1: 50, x2: 350, y2: 50, door: true, open: true };
  const light = { x: 500, y: 200, bright: 20, dim: 20 };
  const armed = { id: 'z1', name: 'Emboscada', points: [{ x: 500, y: 300 }, { x: 600, y: 300 }, { x: 600, y: 380 }], monster_ids: [], armed: true };
  const idle = { id: 'z2', name: 'Pasillo', points: [{ x: 650, y: 300 }, { x: 750, y: 300 }], monster_ids: [], armed: false };
  const dot = { id: 'z3', name: 'Punto', points: [{ x: 700, y: 100 }], monster_ids: [], armed: true };
  const layered = scene({ walls: [wall, closed, opened], lights: [light], zones: [armed, idle, dot] });

  it('muros azules, puertas cerradas ámbar más gruesas y abiertas verdes discontinuas, encima de la niebla', () => {
    const viewer = token({ owner_user_id: 8, x: 50, y: 50 });
    renderTable({ scene: layered, tokens: [viewer], viewers: [viewer] });
    const z = VIEW.z;
    const [w] = segments({ x: 100, y: 50 }, { x: 100, y: 350 });
    expect(w.style.strokeStyle).toBe('rgba(90,169,230,.9)');
    expect(w.style.lineWidth).toBeCloseTo(4 / z);
    expect(w.style.dash).toEqual([]);
    expect(indexOf(w), 'encima de la niebla').toBeGreaterThan(indexOf(images(FOG_CANVAS)[0]));
    const [c] = segments({ x: 200, y: 50 }, { x: 250, y: 50 });
    expect(c.style.strokeStyle).toBe('rgba(233,180,76,.95)');
    expect(c.style.lineWidth).toBeCloseTo(6 / z);
    expect(c.style.dash, 'la puerta cerrada es continua').toEqual([]);
    const [o] = segments({ x: 300, y: 50 }, { x: 350, y: 50 });
    expect(o.style.strokeStyle).toBe('rgba(69,196,138,.9)');
    expect(o.style.dash.map((d) => d * z)).toEqual([expect.closeTo(8, 6), expect.closeTo(6, 6)]);
  });

  it('luces como puntos amarillos y zonas con su nombre: activa en rojo, desactivada en gris; una zona de un punto no se dibuja', () => {
    renderTable({ scene: layered });
    const z = VIEW.z;
    expect(circles('fill', 500, 200, 9 / z)[0].style.fillStyle).toBe('#ffcf7a');
    const zoneFill = (zn: typeof armed) => frame().paints.find((p) => p.op === 'fill' && p.path[0]?.op === 'moveTo' && p.path[0].args.join() === `${zn.points[0].x},${zn.points[0].y}`);
    const a = zoneFill(armed)!;
    expect(a.path.map((o) => o.op)).toEqual(['moveTo', 'lineTo', 'lineTo', 'closePath']);
    expect(a.style.fillStyle).toBe('rgba(239,79,85,.14)');
    expect(zoneFill(idle)!.style.fillStyle).toBe('rgba(141,145,154,.10)');
    const [label] = texts('Emboscada');
    expect(label.args[1]).toBeCloseTo(500 + 6 / z);
    expect(label.args[2]).toBeCloseTo(300 + 6 / z);
    expect(label.style.fillStyle).toBe('#ef4f55');
    expect(texts('Pasillo (desactivada)')[0].style.fillStyle).toBe('#8d919a');
    expect(texts('Punto')).toHaveLength(0);
  });

  it('los jugadores no ven muros, puertas, luces ni zonas', () => {
    renderTable({ scene: layered, isGM: false, userId: PLAYER });
    expect(segments({ x: 100, y: 50 }, { x: 100, y: 350 })).toHaveLength(0);
    expect(segments({ x: 200, y: 50 }, { x: 250, y: 50 })).toHaveLength(0);
    expect(circles('fill', 500, 200)).toHaveLength(0);
    expect(texts('Emboscada')).toHaveLength(0);
  });
});

describe('TableCanvas · marcadores de combate', () => {
  const fighter = token({ owner_user_id: PLAYER, kind: 'pc', x: 300, y: 300 });
  const orc = token({ x: 350, y: 300 });
  const elsewhere = token({ owner_user_id: PLAYER, kind: 'pc', x: 50, y: 50 });
  const fight = combat({ center_x: 320, center_y: 300, combatants: [
    { id: 1, token_id: orc.id, initiative: 15, is_player: false, movement_used_ft: 0, dashed: false, name: 'Orco' },
  ] });
  const markerY = 300 - CELL * 0.9;

  it('el DM ve un marcador rojo con espadas por encima del centro del combate', () => {
    renderTable({ tokens: [orc], combats: [fight] });
    const [marker] = circles('fill', 320, markerY, 18 / VIEW.z);
    expect(marker.style.fillStyle).toBe('rgba(239,79,85,.92)');
    expect(texts('swords').map((p) => p.args.slice(1))).toEqual([[320, markerY + 1]]);
  });

  it('un jugador fuera del combate lo ve; uno que participa, no (ya tiene el HUD)', () => {
    const outside = renderTable({ tokens: [orc, elsewhere], combats: [fight], isGM: false, userId: PLAYER });
    expect(texts('swords'), 'fuera del combate').toHaveLength(1);
    outside.unmount();
    ctx = undefined as unknown as RecordingContext;

    const joined = { ...fight, combatants: [...fight.combatants, { id: 2, token_id: fighter.id, initiative: 9, is_player: true, movement_used_ft: 0, dashed: false, name: 'Lyra' }] };
    renderTable({ tokens: [orc, fighter, elsewhere], combats: [joined], isGM: false, userId: PLAYER });
    expect(texts('swords'), 'participa').toHaveLength(0);
  });
});

// ── Interaction ─────────────────────────────────────────────────────────────────────────────────

describe('TableCanvas · selección, arrastre y paneo', () => {
  it('pulsar un token lo selecciona; pulsar el vacío deselecciona', () => {
    const t = token({ x: 100, y: 100 });
    const { canvas, props } = renderTable({ tokens: [t] });
    tap(canvas, { x: 100, y: 100 });
    expect(props.onSelect).toHaveBeenLastCalledWith(t.id);
    tap(canvas, { x: 100 + CELL / 2 - 1, y: 100 });
    expect(props.onSelect, 'la celda entera cuenta, no solo el círculo dibujado').toHaveBeenLastCalledWith(t.id);
    tap(canvas, { x: 100, y: 100 + CELL / 2 + 2 });
    expect(props.onSelect).toHaveBeenLastCalledWith(null);
  });

  it('con tokens superpuestos se selecciona el de arriba (el último)', () => {
    const below = token({ x: 100, y: 100 });
    const above = token({ x: 110, y: 100 });
    const { canvas, props } = renderTable({ tokens: [below, above] });
    tap(canvas, { x: 105, y: 100 });
    expect(props.onSelect).toHaveBeenLastCalledWith(above.id);
  });

  it('arrastrar un token lo dibuja donde va y al soltar informa la nueva posición', () => {
    const t = token({ x: 100, y: 100 });
    const { canvas, props } = renderTable({ tokens: [t] });
    down(canvas, { x: 100, y: 100 });
    move(canvas, { x: 260, y: 180 });
    expect(circles('fill', 260, 180, R1), 'fantasma en el destino').toHaveLength(1);
    expect(circles('fill', 100, 100, R1)).toHaveLength(0);
    expect(canvas.style.cursor).toBe('grabbing');
    up(canvas, { x: 260, y: 180 });
    expect(props.onMove).toHaveBeenCalledTimes(1);
    const [moved, x, y] = vi.mocked(props.onMove).mock.calls[0];
    expect(moved).toBe(t);
    expect({ x, y }).toEqual(closeTo({ x: 260, y: 180 }));
    expect(canvas.style.cursor).toBe('default');
  });

  it('el token conserva el punto por el que se agarró: no salta al cursor', () => {
    const t = token({ x: 100, y: 100 });
    const { canvas, props } = renderTable({ tokens: [t] });
    down(canvas, { x: 110, y: 112 });
    move(canvas, { x: 260, y: 182 });
    expect(circles('fill', 250, 170, R1), 'centro desplazado lo mismo que el puntero').toHaveLength(1);
    up(canvas, { x: 260, y: 182 });
    expect(props.onMove).toHaveBeenCalledWith(t, expect.closeTo(250, 6), expect.closeTo(170, 6));
  });

  it('un arrastre de menos de un cuarto de celda no mueve el token', () => {
    const t = token({ x: 100, y: 100 });
    const { canvas, props } = renderTable({ tokens: [t] });
    down(canvas, { x: 100, y: 100 });
    move(canvas, { x: 110, y: 100 });
    up(canvas, { x: 110, y: 100 });
    expect(props.onMove).not.toHaveBeenCalled();
    expect(circles('fill', 100, 100, R1), 'vuelve a su sitio').toHaveLength(1);
  });

  it('el DM mueve cualquier token; un jugador solo los suyos (los ajenos solo se seleccionan)', () => {
    const theirs = token({ x: 100, y: 100 });
    const mine = token({ x: 300, y: 100, owner_user_id: PLAYER, kind: 'pc' });
    const gm = renderTable({ tokens: [theirs, mine] });
    down(gm.canvas, { x: 100, y: 100 }); move(gm.canvas, { x: 200, y: 200 }); up(gm.canvas, { x: 200, y: 200 });
    expect(gm.props.onMove, 'DM').toHaveBeenCalledWith(theirs, expect.any(Number), expect.any(Number));
    gm.unmount();
    ctx = undefined as unknown as RecordingContext;

    const player = renderTable({ tokens: [theirs, mine], isGM: false, userId: PLAYER });
    down(player.canvas, { x: 100, y: 100 }); move(player.canvas, { x: 200, y: 200 }); up(player.canvas, { x: 200, y: 200 });
    expect(player.props.onSelect).toHaveBeenLastCalledWith(theirs.id);
    expect(player.props.onMove, 'ajeno').not.toHaveBeenCalled();
    down(player.canvas, { x: 300, y: 100 }); move(player.canvas, { x: 300, y: 250 }); up(player.canvas, { x: 300, y: 250 });
    expect(player.props.onMove, 'propio').toHaveBeenCalledWith(mine, expect.closeTo(300, 6), expect.closeTo(250, 6));
  });

  it('arrastrar el vacío desplaza la vista lo mismo que el puntero', () => {
    const { canvas } = renderTable();
    const start = client({ x: 400, y: 300 });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, ...start });
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: start.clientX + 50, clientY: start.clientY - 30 });
    expect(frame().view).toEqual({ x: VIEW.x + 50, y: VIEW.y - 30, z: VIEW.z });
  });

  it('el botón central desplaza la vista aunque haya un token debajo, sin seleccionarlo', () => {
    const t = token({ x: 100, y: 100 });
    const { canvas, props } = renderTable({ tokens: [t] });
    const start = client({ x: 100, y: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 1, buttons: 4, ...start });
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 4, clientX: start.clientX + 20, clientY: start.clientY + 10 });
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(frame().view).toEqual({ x: VIEW.x + 20, y: VIEW.y + 10, z: VIEW.z });
  });

  it('pulsar un objeto lo selecciona como objeto, no como token', () => {
    const chest = object({ x: 100, y: 100 });
    const t = token({ x: 100, y: 100 });
    const { canvas, props } = renderTable({ tokens: [t], objects: [chest] });
    tap(canvas, { x: 110, y: 105 });
    expect(props.onSelectObject).toHaveBeenCalledWith(chest.id);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('un jugador no puede pulsar un objeto bajo la niebla', () => {
    const hiddenChest = object({ x: 600, y: 300 });
    const viewer = token({ owner_user_id: PLAYER, x: 50, y: 50 });
    const { canvas, props } = renderTable({ objects: [hiddenChest], tokens: [viewer], viewers: [viewer], isGM: false, userId: PLAYER });
    tap(canvas, { x: 600, y: 300 });
    expect(props.onSelectObject).not.toHaveBeenCalled();
    expect(props.onSelect).toHaveBeenLastCalledWith(null);
  });

  it('el DM abre y cierra una puerta pulsándola; un jugador no', () => {
    const door = { x1: 200, y1: 100, x2: 300, y2: 100, door: true, open: false };
    const wall = { x1: 200, y1: 200, x2: 300, y2: 200, door: false, open: false };
    const s = scene({ walls: [door, wall] });
    const gm = renderTable({ scene: s });
    tap(gm.canvas, { x: 250, y: 104 });
    expect(gm.props.onWalls).toHaveBeenCalledWith([{ ...door, open: true }, wall]);
    tap(gm.canvas, { x: 250, y: 204 });
    expect(gm.props.onWalls, 'un muro no se abre').toHaveBeenCalledTimes(1);
    gm.unmount();
    ctx = undefined as unknown as RecordingContext;

    const player = renderTable({ scene: s, isGM: false, userId: PLAYER });
    tap(player.canvas, { x: 250, y: 104 });
    expect(player.props.onWalls).not.toHaveBeenCalled();
  });

  it('cursor según la herramienta', () => {
    const { canvas, rerender, props } = renderTable({ tool: 'erase' });
    expect(canvas.style.cursor).toBe('not-allowed');
    rerender(<TableCanvas {...props} tool="ruler" />);
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('el menú contextual del navegador no aparece sobre la mesa', () => {
    const { canvas } = renderTable();
    expect(fireEvent.contextMenu(canvas)).toBe(false);
  });
});

describe('TableCanvas · zoom', () => {
  it('la rueda acerca y aleja manteniendo fijo el punto bajo el cursor', () => {
    const { canvas } = renderTable();
    const cursor = client({ x: 600, y: 100 });
    fireEvent.wheel(canvas, { deltaY: -100, ...cursor });
    expect(frame().view.z).toBeCloseTo(0.95 * 1.12);
    expect(zoomLabel()).toBe('106%');
    expect(sceneUnder(cursor, frame().view)).toEqual(closeTo({ x: 600, y: 100 }));

    fireEvent.wheel(canvas, { deltaY: 100, ...cursor });
    expect(frame().view.z).toBeCloseTo(0.95 * 1.12 * 0.89);
    expect(sceneUnder(cursor, frame().view)).toEqual(closeTo({ x: 600, y: 100 }));
  });

  it('los botones acercan y alejan desde el centro, con límites del 15 % al 400 %, y "Encajar" vuelve al 95 %', async () => {
    const { user } = renderTable();
    const centre = { clientX: RECT.left + 400, clientY: RECT.top + 300 };
    const before = sceneUnder(centre, VIEW);
    await user.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(zoomLabel()).toBe('119%');
    expect(sceneUnder(centre, frame().view)).toEqual(closeTo(before));
    await user.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(zoomLabel()).toBe('95%');

    for (let i = 0; i < 12; i++) await user.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(zoomLabel()).toBe('15%');
    for (let i = 0; i < 16; i++) await user.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(zoomLabel()).toBe('400%');

    await user.click(screen.getByRole('button', { name: 'Encajar la escena' }));
    expect(zoomLabel()).toBe('95%');
    expect(frame().view).toEqual(VIEW);
  });

  it('pellizcar con dos dedos amplía según la separación y mantiene fijo el punto medio entre ellos', () => {
    const { canvas } = renderTable();
    const a = { clientX: 200, clientY: 250 };
    const b0 = { clientX: 400, clientY: 330 };
    const b1 = { clientX: 600, clientY: 410 }; // doubles the distance to a
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, ...a });
    fireEvent.pointerDown(canvas, { pointerId: 2, button: 0, buttons: 1, ...b0 });
    fireEvent.pointerMove(canvas, { pointerId: 2, buttons: 1, ...b1 });
    expect(frame().view.z).toBeCloseTo(0.95 * 2);
    expect(zoomLabel()).toBe('190%');
    const mid = { clientX: (a.clientX + b1.clientX) / 2, clientY: (a.clientY + b1.clientY) / 2 };
    expect(sceneUnder(mid, frame().view), 'el punto medio no se mueve').toEqual(closeTo(sceneUnder(mid, VIEW)));
    fireEvent.pointerUp(canvas, { pointerId: 2, ...b1 });
    fireEvent.pointerUp(canvas, { pointerId: 1, ...a });
    fireEvent.pointerMove(canvas, { pointerId: 3, buttons: 0, ...b0 });
    expect(zoomLabel(), 'al soltar deja de ampliar').toBe('190%');
  });
});

describe('TableCanvas · regla', () => {
  it('arrastrar con la regla traza la distancia en pies (5e: diagonal = una casilla) y desaparece 1,2 s después de soltar', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { canvas, props } = renderTable({ tool: 'ruler', tokens: [token({ x: 100, y: 100 })] });
    const z = VIEW.z;
    down(canvas, { x: 100, y: 100 });
    move(canvas, { x: 300, y: 200 });
    const [line] = segments({ x: 100, y: 100 }, { x: 300, y: 200 });
    expect(line.style.strokeStyle).toBe(ACCENT);
    expect(line.style.lineWidth).toBeCloseTo(3 / z);
    const [label] = texts('20 pies');
    expect(label.args[1]).toBeCloseTo(300 + 17 / z);
    expect(label.args[2]).toBeCloseTo(200 - 11 / z);
    const box = rects().find((p) => p.style.fillStyle === 'rgba(12,13,16,.9)')!;
    expect(box.args.map(Number)).toEqual([300 + 10 / z, 200 - 22 / z, 7 * 7 + 14 / z, 22 / z].map((n) => expect.closeTo(n, 6)));
    expect(props.onSelect, 'la regla no selecciona').not.toHaveBeenCalled();

    move(canvas, { x: 500, y: 200 }, { buttons: 0 });
    expect(texts('20 pies'), 'sin botón pulsado no se estira').toHaveLength(1);

    up(canvas, { x: 300, y: 200 });
    act(() => vi.advanceTimersByTime(1100));
    expect(texts('20 pies')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(100));
    expect(texts('20 pies')).toHaveLength(0);
  });
});

describe('TableCanvas · herramientas del DM', () => {
  it('muro: cada pulsación se ajusta a la esquina de la cuadrícula y encadena tramos hasta Escape', () => {
    const existing = { x1: 0, y1: 0, x2: 50, y2: 0, door: false, open: false };
    const { canvas, props } = renderTable({ tool: 'wall', scene: scene({ walls: [existing] }) });
    tap(canvas, { x: 98, y: 103 });
    expect(props.onWalls).not.toHaveBeenCalled();
    move(canvas, { x: 290, y: 110 }, { buttons: 0 });
    const [preview] = segments({ x: 100, y: 100 }, { x: 300, y: 100 });
    expect(preview.style.strokeStyle, 'vista previa del tramo').toBe('rgba(90,169,230,.8)');
    expect(preview.style.dash.length).toBe(2);

    tap(canvas, { x: 302, y: 97 });
    expect(props.onWalls).toHaveBeenLastCalledWith([existing, { x1: 100, y1: 100, x2: 300, y2: 100, door: false, open: false }]);
    tap(canvas, { x: 296, y: 304 });
    expect(props.onWalls).toHaveBeenLastCalledWith([existing, { x1: 300, y1: 100, x2: 300, y2: 300, door: false, open: false }]);
    tap(canvas, { x: 301, y: 299 });
    expect(props.onWalls, 'la misma esquina no crea un tramo').toHaveBeenCalledTimes(2);

    fireEvent.keyDown(canvas, { key: 'Escape' });
    tap(canvas, { x: 500, y: 300 });
    expect(props.onWalls, 'Escape corta la cadena').toHaveBeenCalledTimes(2);
    tap(canvas, { x: 500, y: 100 });
    expect(props.onWalls).toHaveBeenLastCalledWith([existing, { x1: 500, y1: 300, x2: 500, y2: 100, door: false, open: false }]);
  });

  it('puerta: dos pulsaciones crean una puerta cerrada y la cadena no sigue', () => {
    const { canvas, props } = renderTable({ tool: 'door' });
    tap(canvas, { x: 200, y: 200 });
    move(canvas, { x: 250, y: 200 }, { buttons: 0 });
    expect(segments({ x: 200, y: 200 }, { x: 250, y: 200 })[0].style.strokeStyle).toBe('rgba(233,180,76,.8)');
    tap(canvas, { x: 250, y: 200 });
    expect(props.onWalls).toHaveBeenCalledWith([{ x1: 200, y1: 200, x2: 250, y2: 200, door: true, open: false }]);
    tap(canvas, { x: 300, y: 200 });
    expect(props.onWalls).toHaveBeenCalledTimes(1);
  });

  it('el botón derecho corta la cadena de muros', () => {
    const { canvas, props } = renderTable({ tool: 'wall' });
    tap(canvas, { x: 100, y: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 2, buttons: 2, ...client({ x: 200, y: 200 }) });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 2, ...client({ x: 200, y: 200 }) });
    tap(canvas, { x: 300, y: 100 });
    expect(props.onWalls).not.toHaveBeenCalled();
  });

  it('un jugador no dibuja muros ni luces aunque tenga la herramienta', () => {
    const wallTool = renderTable({ tool: 'wall', isGM: false, userId: PLAYER });
    tap(wallTool.canvas, { x: 100, y: 100 });
    tap(wallTool.canvas, { x: 300, y: 100 });
    expect(wallTool.props.onWalls).not.toHaveBeenCalled();
    expect(wallTool.props.onSelect).toHaveBeenLastCalledWith(null);
    wallTool.unmount();
    ctx = undefined as unknown as RecordingContext;

    const lightTool = renderTable({ tool: 'light', isGM: false, userId: PLAYER });
    tap(lightTool.canvas, { x: 100, y: 100 });
    expect(lightTool.props.onLights).not.toHaveBeenCalled();
  });

  it('luz: añade una antorcha (20/20) donde se pulsa', () => {
    const lamp = { x: 10, y: 10, bright: 30, dim: 30 };
    const { canvas, props } = renderTable({ tool: 'light', scene: scene({ lights: [lamp] }) });
    tap(canvas, { x: 250, y: 150 });
    expect(props.onLights).toHaveBeenCalledWith([lamp, { x: expect.closeTo(250, 6), y: expect.closeTo(150, 6), bright: 20, dim: 20 }]);
  });

  it('objeto: pide colocarlo donde se pulsa', () => {
    const { canvas, props } = renderTable({ tool: 'object' });
    tap(canvas, { x: 420, y: 260 });
    expect(props.onPlaceObject).toHaveBeenCalledWith(expect.closeTo(420, 6), expect.closeTo(260, 6));
  });

  it('zona: los vértices se ajustan a la cuadrícula, se ve el trazo hasta el cursor y el doble clic la crea activa', () => {
    const existing = { id: 'z0', name: 'Vieja', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }], monster_ids: [], armed: false };
    const { canvas, props } = renderTable({ tool: 'zone', scene: scene({ zones: [existing] }) });
    tap(canvas, { x: 98, y: 52 });
    tap(canvas, { x: 302, y: 48 });
    move(canvas, { x: 310, y: 240 }, { buttons: 0 });
    const draft = frame().paints.find((p) => p.op === 'stroke' && p.style.strokeStyle === 'rgba(239,79,85,.9)')!;
    expect(draft.path.map((o) => o.args.slice(0, 2))).toEqual([[100, 50], [300, 50], [expect.closeTo(310, 6), expect.closeTo(240, 6)]]);

    tap(canvas, { x: 299, y: 251 });
    fireEvent.doubleClick(canvas);
    expect(props.onZones).toHaveBeenCalledWith([existing, {
      id: expect.stringMatching(/^z/), name: 'Zona 2', points: [{ x: 100, y: 50 }, { x: 300, y: 50 }, { x: 300, y: 250 }], monster_ids: [], armed: true,
    }]);
  });

  it('zona: con menos de tres vértices el doble clic la descarta', () => {
    const { canvas, props } = renderTable({ tool: 'zone', scene: scene({ zones: undefined as unknown as VTTScene['zones'] }) });
    tap(canvas, { x: 100, y: 50 });
    tap(canvas, { x: 300, y: 50 });
    fireEvent.doubleClick(canvas);
    expect(props.onZones).not.toHaveBeenCalled();
    tap(canvas, { x: 100, y: 50 });
    tap(canvas, { x: 300, y: 50 });
    tap(canvas, { x: 300, y: 250 });
    fireEvent.doubleClick(canvas);
    expect(props.onZones).toHaveBeenCalledWith([expect.objectContaining({ name: 'Zona 1', points: [{ x: 100, y: 50 }, { x: 300, y: 50 }, { x: 300, y: 250 }] })]);
  });

  describe('borrar', () => {
    const keep = { x: 50, y: 350, bright: 20, dim: 20 };
    const lamp = { x: 600, y: 300, bright: 20, dim: 20 };
    const long = { x1: 0, y1: 200, x2: 400, y2: 200, door: false, open: false };
    const short = { x1: 450, y1: 50, x2: 500, y2: 50, door: false, open: false };
    const diamond = { id: 'z1', name: 'Rombo', points: [{ x: 600, y: 50 }, { x: 700, y: 150 }, { x: 600, y: 250 }, { x: 500, y: 150 }], monster_ids: [], armed: true };
    const other = { id: 'z2', name: 'Otra', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }], monster_ids: [], armed: true };
    const s = scene({ lights: [keep, lamp], walls: [long, short], zones: [other, diamond] });

    it('quita la luz pulsada (con margen alrededor del punto)', () => {
      const { canvas, props } = renderTable({ tool: 'erase', scene: s });
      tap(canvas, { x: 608, y: 306 });
      expect(props.onLights).toHaveBeenCalledWith([keep]);
      expect(props.onWalls).not.toHaveBeenCalled();
      expect(props.onZones).not.toHaveBeenCalled();
    });

    it('quita el muro pulsado por cualquier punto de su largo, no solo por los extremos', () => {
      const { canvas, props } = renderTable({ tool: 'erase', scene: s });
      tap(canvas, { x: 200, y: 205 });
      expect(props.onWalls).toHaveBeenCalledWith([short]);
      expect(props.onLights).not.toHaveBeenCalled();
    });

    it('quita la zona que contiene el punto pulsado y solo esa', () => {
      const { canvas, props } = renderTable({ tool: 'erase', scene: s });
      tap(canvas, { x: 600, y: 150 });
      expect(props.onZones).toHaveBeenCalledWith([other]);
      tap(canvas, { x: 690, y: 150 });
      expect(props.onZones).toHaveBeenLastCalledWith([other]);
      expect(props.onZones).toHaveBeenCalledTimes(2);
    });

    it('fuera de toda luz, muro y zona no borra nada', () => {
      const { canvas, props } = renderTable({ tool: 'erase', scene: s });
      for (const p of [{ x: 300, y: 350 }, { x: 530, y: 70 }, { x: 680, y: 230 }, { x: 520, y: 230 }, { x: 680, y: 70 }, { x: 750, y: 150 }, { x: 600, y: 30 }, { x: 200, y: 230 }]) {
        tap(canvas, p);
      }
      expect(props.onLights).not.toHaveBeenCalled();
      expect(props.onWalls).not.toHaveBeenCalled();
      expect(props.onZones).not.toHaveBeenCalled();
      expect(props.onSelect, 'borrar no selecciona').not.toHaveBeenCalled();
    });
  });
});
