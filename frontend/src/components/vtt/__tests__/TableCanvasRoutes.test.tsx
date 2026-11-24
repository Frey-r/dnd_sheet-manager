/* T-20 · contratos/T-20-ruta-frontend.md and T-22 (pen tool, replaces F3 by D-0067) — F5 (place an NPC with a click), F6 (only the GM sees
   routes) and live route positions on the board. Sensor: a minimal recording 2D context (strokes with their path,
   arcs); the canvas sits at (30, 40) and measures 800×600, the 800×400 scene is fitted at z = 0.95. */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableCanvas } from '../TableCanvas';
import { newExploredCanvas, renderFog } from '../../../lib/vision';
import { routePosition } from '../../../lib/vtt/routePosition';
import type { VTTScene, VTTToken } from '../../../services/vttApi';

vi.mock(import('../../../lib/avatar/render'), async (importOriginal) => ({ ...(await importOriginal()), drawAvatarInto: vi.fn() }));
vi.mock(import('../../../lib/vision'), async (importOriginal) => ({ ...(await importOriginal()), renderFog: vi.fn(), newExploredCanvas: vi.fn() }));

interface Pt { x: number; y: number }
interface Op { op: string; args: number[] }
interface Paint { op: string; path: Op[] }

class Rec {
  frames: Paint[][] = [];
  canvas: HTMLCanvasElement;
  fillStyle = ''; strokeStyle = ''; lineWidth = 1; globalAlpha = 1; font = ''; textAlign = ''; textBaseline = '';
  private path: Op[] = [];
  constructor(c: HTMLCanvasElement) { this.canvas = c; }
  setTransform() { this.frames.push([]); }
  translate() {} scale() {} save() {} restore() {} setLineDash() {} clip() {}
  beginPath() { this.path = []; }
  moveTo(x: number, y: number) { this.path.push({ op: 'moveTo', args: [x, y] }); }
  lineTo(x: number, y: number) { this.path.push({ op: 'lineTo', args: [x, y] }); }
  arc(...a: number[]) { this.path.push({ op: 'arc', args: a }); }
  closePath() { this.path.push({ op: 'closePath', args: [] }); }
  fill() { this.frames[this.frames.length - 1].push({ op: 'fill', path: [...this.path] }); }
  stroke() { this.frames[this.frames.length - 1].push({ op: 'stroke', path: [...this.path] }); }
  fillRect() {} fillText() {} drawImage() {} measureText(t: string) { return { width: t.length * 7 }; }
}
let ctx: Rec;
const last = () => ctx.frames[ctx.frames.length - 1];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
/** Strokes whose path contains the segment a → b. */
const segment = (a: Pt, b: Pt) => last().filter((p) => p.op === 'stroke' && p.path.some((o, i) => o.op === 'moveTo' || o.op === 'lineTo'
  ? near(o.args[0], a.x) && near(o.args[1], a.y) && p.path[i + 1]?.op === 'lineTo' && near(p.path[i + 1].args[0], b.x) && near(p.path[i + 1].args[1], b.y)
  : false));
/** Token discs (filled arcs) centred on p. */
const discAt = (p: Pt) => last().some((x) => x.op === 'fill' && x.path.some((o) => o.op === 'arc' && near(o.args[0], p.x) && near(o.args[1], p.y)));

const VIEW = { z: 0.95, x: 20, y: 110 };
const client = (p: Pt) => ({ clientX: 30 + VIEW.x + p.x * VIEW.z, clientY: 40 + VIEW.y + p.y * VIEW.z });

const scene = (over: Partial<VTTScene> = {}): VTTScene => ({
  id: 1, campaign_id: 7, name: 'Muralla', map_url: '', width_px: 800, height_px: 400, grid_size_px: 50, grid_offset_x: 0,
  grid_offset_y: 0, feet_per_cell: 5, ambient_light: 'bright', fog_enabled: false, walls: [], lights: [], mode: 'exploration',
  exploration_pace: 2, zones: [], is_active: true, ...over,
});
const token = (over: Partial<VTTToken> = {}): VTTToken => ({
  id: 5, scene_id: 1, name: 'Guardia', kind: 'npc', character_id: null, owner_user_id: null, image_url: '', color: '#333',
  x: 125, y: 125, size_cells: 1, hp: 0, max_hp: 0, ac: 10, hidden: false, vision_ft: 0, darkvision_ft: 0, blindsight_ft: 0,
  light_bright_ft: 0, light_dim_ft: 0, speed_ft: 30, passive_perception: 10, stealth_bonus: 0, dex_mod: 0, sneaking: false,
  detects: false, ...over,
});

type Props = ComponentProps<typeof TableCanvas>;
function renderTable(over: Partial<Props> = {}) {
  const props: Props = {
    scene: scene(), tokens: [], isGM: true, userId: 1, viewers: null, tool: 'select', selectedId: null,
    onSelect: vi.fn(), onMove: vi.fn(), onWalls: vi.fn(), onLights: vi.fn(), onRoute: vi.fn(), onRouteEdit: vi.fn(), onPlaceNpc: vi.fn(), ...over,
  };
  render(<TableCanvas {...props} />);
  const canvas = screen.getByLabelText(`Mesa virtual: ${props.scene.name}`) as HTMLCanvasElement;
  canvas.setPointerCapture = vi.fn();
  return { canvas, props };
}
const tap = (cv: HTMLElement, p: Pt) => {
  fireEvent.pointerDown(cv, { pointerId: 1, button: 0, buttons: 1, ...client(p) });
  fireEvent.pointerUp(cv, { pointerId: 1, button: 0, buttons: 0, ...client(p) });
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    ctx ??= new Rec(this);
    return ctx;
  } as unknown as HTMLCanvasElement['getContext']);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 30, top: 40, x: 30, y: 40, width: 800, height: 600, right: 830, bottom: 640, toJSON: () => ({}),
  } as DOMRect);
  vi.mocked(renderFog).mockReturnValue(null as never);
  vi.mocked(newExploredCanvas).mockReturnValue({ toDataURL: () => '' } as unknown as HTMLCanvasElement);
});
afterEach(() => {
  ctx = undefined as unknown as Rec;
  vi.unstubAllGlobals();
});

describe('Pluma «Ruta de PNJ» (T-22, reemplaza F3 por D-0067)', () => {
  const key = (cv: HTMLElement, k: string) => fireEvent.keyDown(cv, { key: k });
  const pen = (over: Partial<Props> = {}) => {
    const guard = token();
    return { guard, ...renderTable({ tool: 'route', tokens: [guard], selectedId: guard.id, ...over }) };
  };

  it('P1: las anclas quedan en el píxel exacto del fondo, sin cuadrícula; el primer clic es P0', () => {
    const { canvas, props, guard } = pen();
    tap(canvas, { x: 123.4, y: 77.6 });
    tap(canvas, { x: 123.4, y: 77.6 }); // mismo píxel: no duplica
    tap(canvas, { x: 301, y: 89 });
    fireEvent.doubleClick(canvas);
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 123, y: 78 }, { x: 301, y: 89 }], false);
  });

  it('P2: Intro termina un trazado abierto; con un solo ancla no hace nada', () => {
    const { canvas, props, guard } = pen();
    tap(canvas, { x: 100, y: 100 });
    key(canvas, 'Enter');
    expect(props.onRoute).not.toHaveBeenCalled();
    tap(canvas, { x: 300, y: 100 });
    tap(canvas, { x: 300, y: 250 });
    key(canvas, 'Enter');
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 250 }], false);
  });

  it('P3: clic sobre la primera ancla con 3 o más anclas cierra el ciclo sin repetir P0', () => {
    const { canvas, props, guard } = pen();
    tap(canvas, { x: 100, y: 100 });
    tap(canvas, { x: 300, y: 100 });
    tap(canvas, { x: 300, y: 250 });
    tap(canvas, { x: 104, y: 103 }); // < 10 px de pantalla de P0
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 250 }], true);
  });

  it('P3: con solo 2 anclas, clicar la primera no cierra (sería una línea)', () => {
    const { canvas, props } = pen();
    tap(canvas, { x: 100, y: 100 });
    tap(canvas, { x: 300, y: 100 });
    tap(canvas, { x: 101, y: 101 });
    expect(props.onRoute).not.toHaveBeenCalled();
  });

  it('P4: Retroceso borra el último ancla y Esc cancela', () => {
    const { canvas, props, guard } = pen();
    tap(canvas, { x: 100, y: 100 });
    tap(canvas, { x: 300, y: 100 });
    tap(canvas, { x: 300, y: 250 });
    key(canvas, 'Backspace');
    key(canvas, 'Enter');
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100 }], false);
    vi.mocked(props.onRoute!).mockClear();
    tap(canvas, { x: 50, y: 50 });
    tap(canvas, { x: 90, y: 50 });
    key(canvas, 'Escape');
    key(canvas, 'Enter');
    expect(props.onRoute).not.toHaveBeenCalled();
  });

  it('P4: Mayús restringe el tramo a múltiplos de 45°', () => {
    const { canvas, props, guard } = pen();
    tap(canvas, { x: 100, y: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, shiftKey: true, ...client({ x: 300, y: 130 }) });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, buttons: 0, shiftKey: true, ...client({ x: 300, y: 130 }) });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, shiftKey: true, ...client({ x: 390, y: 205 }) });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, buttons: 0, shiftKey: true, ...client({ x: 390, y: 205 }) });
    key(canvas, 'Enter');
    const pts = vi.mocked(props.onRoute!).mock.calls[0][1];
    expect(vi.mocked(props.onRoute!).mock.calls[0][0]).toBe(guard);
    expect(pts[0]).toEqual({ x: 100, y: 100 });
    expect(pts[1]).toEqual({ x: 300, y: 100 }); // horizontal
    expect(pts[2].x - pts[1].x).toBe(pts[2].y - pts[1].y); // diagonal a 45°
  });

  it('el borrador se dibuja con la línea elástica hasta el cursor', () => {
    const { canvas } = pen();
    tap(canvas, { x: 100, y: 100 });
    tap(canvas, { x: 300, y: 100 });
    expect(segment({ x: 100, y: 100 }, { x: 300, y: 100 }).length).toBeGreaterThan(0);
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 0, ...client({ x: 300, y: 260 }) });
    expect(segment({ x: 300, y: 100 }, { x: 300, y: 260 }).length).toBeGreaterThan(0);
  });

  it('P5: arrastrar un ancla de la ruta del PNJ la mueve al píxel y guarda sin preguntar', () => {
    const route = { mode: 'pingpong' as const, points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 250 }] };
    const guard = token({ x: 100, y: 100, route, route_clock: { elapsed_ms: 0, running: false } });
    const { canvas, props } = renderTable({ tool: 'route', tokens: [guard], selectedId: guard.id });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, ...client({ x: 301, y: 101 }) });
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, ...client({ x: 333.2, y: 141.7 }) });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, buttons: 0, ...client({ x: 333.2, y: 141.7 }) });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 333, y: 142 }, { x: 300, y: 250 }]);
    expect(props.onRoute).not.toHaveBeenCalled();
  });

  it('sin un PNJ o monstruo seleccionado, el clic selecciona la ficha en vez de trazar', () => {
    const guard = token();
    const pc = token({ id: 6, kind: 'pc', x: 425, y: 225 });
    const { canvas, props } = renderTable({ tool: 'route', tokens: [guard, pc], selectedId: pc.id });
    tap(canvas, { x: 125, y: 125 });
    expect(props.onSelect).toHaveBeenCalledWith(guard.id);
    fireEvent.doubleClick(canvas);
    expect(props.onRoute).not.toHaveBeenCalled();
  });
});

describe('Colocar un PNJ de la campaña (F5)', () => {
  it('con la herramienta «npc» el clic informa el punto de la escena', () => {
    const { canvas, props } = renderTable({ tool: 'npc' });
    tap(canvas, { x: 210, y: 160 });
    const [x, y] = vi.mocked(props.onPlaceNpc!).mock.calls[0];
    expect(x).toBeCloseTo(210, 6);
    expect(y).toBeCloseTo(160, 6);
  });
});

describe('Rutas en el tablero (F6 y posición viva)', () => {
  const route = { mode: 'loop' as const, points: [{ x: 125, y: 125 }, { x: 325, y: 125 }, { x: 325, y: 325 }] };

  it('el GM ve la ruta, con el tramo de cierre de la patrulla', () => {
    renderTable({ tokens: [token({ route, route_clock: { elapsed_ms: 0, running: false } })] });
    expect(segment(route.points[0], route.points[1]).length).toBeGreaterThan(0);
    expect(segment(route.points[1], route.points[2]).length).toBeGreaterThan(0);
    expect(segment(route.points[2], route.points[0]).length, 'cierre del bucle').toBeGreaterThan(0);
  });

  it('una ida y vuelta no dibuja tramo de cierre', () => {
    renderTable({ tokens: [token({ route: { ...route, mode: 'pingpong' }, route_clock: { elapsed_ms: 0, running: false } })] });
    expect(segment(route.points[2], route.points[0])).toHaveLength(0);
  });

  it('los jugadores no ven las rutas', () => {
    renderTable({ isGM: false, userId: 3, tokens: [token({ route, route_clock: { elapsed_ms: 0, running: false } })] });
    expect(segment(route.points[0], route.points[1])).toHaveLength(0);
  });

  it('la ficha se dibuja donde dice su reloj, no en x, y', () => {
    const t = token({ x: 125, y: 125, route, route_clock: { elapsed_ms: 1000, running: false } });
    renderTable({ isGM: false, userId: 3, tokens: [t] });
    const at = routePosition(route, (30 * 10) / 6 * 2, 1000); // 50 px / 5 ft cells at ×2 → 100 px/s
    expect(at).toEqual({ x: 225, y: 125 });
    expect(discAt(at)).toBe(true);
    expect(discAt({ x: 125, y: 125 })).toBe(false);
  });
});
