/* T-29 · contratos/T-29-ruta-curvas-pluma.md — K2 (click-and-drag makes a smooth anchor), K3 (Bézier legs are
   drawn with bezierCurveTo) and K4 (editing handles). Sensor: a minimal recording 2D context; the canvas sits at
   (30, 40), measures 800×600, and the 800×400 scene is fitted at z = 0.95 (view x 20, y 110). */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableCanvas } from '../TableCanvas';
import { newExploredCanvas, renderFog } from '../../../lib/vision';
import type { VTTScene, VTTToken } from '../../../services/vttApi';

vi.mock(import('../../../lib/avatar/render'), async (importOriginal) => ({ ...(await importOriginal()), drawAvatarInto: vi.fn() }));
vi.mock(import('../../../lib/vision'), async (importOriginal) => ({ ...(await importOriginal()), renderFog: vi.fn(), newExploredCanvas: vi.fn() }));

interface Pt { x: number; y: number }
interface Op { op: string; args: number[] }
class Rec {
  frames: { op: string; path: Op[] }[][] = [];
  canvas: HTMLCanvasElement;
  fillStyle = ''; strokeStyle = ''; lineWidth = 1; globalAlpha = 1; font = ''; textAlign = ''; textBaseline = '';
  private path: Op[] = [];
  constructor(c: HTMLCanvasElement) { this.canvas = c; }
  setTransform() { this.frames.push([]); }
  translate() {} scale() {} save() {} restore() {} setLineDash() {} clip() {}
  beginPath() { this.path = []; }
  moveTo(x: number, y: number) { this.path.push({ op: 'moveTo', args: [x, y] }); }
  lineTo(x: number, y: number) { this.path.push({ op: 'lineTo', args: [x, y] }); }
  bezierCurveTo(...a: number[]) { this.path.push({ op: 'bezierCurveTo', args: a }); }
  arc(...a: number[]) { this.path.push({ op: 'arc', args: a }); }
  closePath() {}
  fill() { this.frames[this.frames.length - 1].push({ op: 'fill', path: [...this.path] }); }
  stroke() { this.frames[this.frames.length - 1].push({ op: 'stroke', path: [...this.path] }); }
  fillRect() {} fillText() {} drawImage() {} measureText(t: string) { return { width: t.length * 7 }; }
}
let ctx: Rec;
const last = () => ctx.frames[ctx.frames.length - 1];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const curves = (args: number[]) => last().filter((p) => p.op === 'stroke' && p.path.some((o) => o.op === 'bezierCurveTo' && o.args.every((v, i) => near(v, args[i]))));

const client = (p: Pt) => ({ clientX: 30 + 20 + p.x * 0.95, clientY: 40 + 110 + p.y * 0.95 });
const scene = (): VTTScene => ({
  id: 1, campaign_id: 7, name: 'Muralla', map_url: '', width_px: 800, height_px: 400, grid_size_px: 50, grid_offset_x: 0,
  grid_offset_y: 0, feet_per_cell: 5, ambient_light: 'bright', fog_enabled: false, walls: [], lights: [], mode: 'exploration',
  exploration_pace: 2, zones: [], is_active: true,
});
const token = (over: Partial<VTTToken> = {}): VTTToken => ({
  id: 5, scene_id: 1, name: 'Guardia', kind: 'npc', character_id: null, owner_user_id: null, image_url: '', color: '#333',
  x: 600, y: 350, size_cells: 1, hp: 0, max_hp: 0, ac: 10, hidden: false, vision_ft: 0, darkvision_ft: 0, blindsight_ft: 0,
  light_bright_ft: 0, light_dim_ft: 0, speed_ft: 30, passive_perception: 10, stealth_bonus: 0, dex_mod: 0, sneaking: false,
  detects: false, ...over,
});

type Props = ComponentProps<typeof TableCanvas>;
function renderTable(over: Partial<Props> = {}) {
  const props: Props = {
    scene: scene(), tokens: [], isGM: true, userId: 1, viewers: null, tool: 'route', selectedId: null,
    onSelect: vi.fn(), onMove: vi.fn(), onWalls: vi.fn(), onLights: vi.fn(), onRoute: vi.fn(), onRouteEdit: vi.fn(), ...over,
  };
  render(<TableCanvas {...props} />);
  const canvas = screen.getByLabelText('Mesa virtual: Muralla') as HTMLCanvasElement;
  canvas.setPointerCapture = vi.fn();
  return { canvas, props };
}
const down = (cv: HTMLElement, p: Pt, init: Record<string, unknown> = {}) => fireEvent.pointerDown(cv, { pointerId: 1, button: 0, buttons: 1, ...client(p), ...init });
const drag = (cv: HTMLElement, p: Pt, init: Record<string, unknown> = {}) => fireEvent.pointerMove(cv, { pointerId: 1, buttons: 1, ...client(p), ...init });
const up = (cv: HTMLElement, p: Pt, init: Record<string, unknown> = {}) => fireEvent.pointerUp(cv, { pointerId: 1, button: 0, buttons: 0, ...client(p), ...init });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    ctx ??= new Rec(this);
    return ctx;
  } as unknown as HTMLCanvasElement['getContext']);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 30, top: 40, x: 30, y: 40, width: 800, height: 600, right: 830, bottom: 640, toJSON: () => ({}) } as DOMRect);
  vi.mocked(renderFog).mockReturnValue(null as never);
  vi.mocked(newExploredCanvas).mockReturnValue({ toDataURL: () => '' } as unknown as HTMLCanvasElement);
});
afterEach(() => { ctx = undefined as unknown as Rec; vi.unstubAllGlobals(); });

describe('Pluma con curvas (K2)', () => {
  it('click and drag makes a smooth anchor: out at the cursor, in mirrored; a still click stays a corner', () => {
    const guard = token();
    const { canvas, props } = renderTable({ tokens: [guard], selectedId: guard.id });
    down(canvas, { x: 100, y: 100 }); up(canvas, { x: 100, y: 100 });
    down(canvas, { x: 300, y: 100 });
    drag(canvas, { x: 300.4, y: 179.6 });
    expect(curves([100, 100, 300, 20, 300, 100]).length, 'the curve shows while dragging').toBeGreaterThan(0);
    up(canvas, { x: 300.4, y: 179.6 });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100, in: { x: 300, y: 20 }, out: { x: 300, y: 180 } }], false);
  });

  it('a tiny jitter (< 4 screen px) is still a corner', () => {
    const guard = token();
    const { canvas, props } = renderTable({ tokens: [guard], selectedId: guard.id });
    down(canvas, { x: 100, y: 100 }); drag(canvas, { x: 102, y: 101 }); up(canvas, { x: 102, y: 101 });
    down(canvas, { x: 300, y: 100 }); up(canvas, { x: 300, y: 100 });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100 }], false);
  });
});

describe('Rutas curvas en el tablero (K3)', () => {
  it('a saved leg with handles is drawn with bezierCurveTo, also the closing leg of a loop', () => {
    const route = { mode: 'loop' as const, points: [
      { x: 100, y: 100, in: { x: 60, y: 300 }, out: { x: 100, y: 20 } },
      { x: 400, y: 100, in: { x: 400, y: 20 } },
      { x: 400, y: 300 },
    ] };
    renderTable({ tool: 'select', tokens: [token({ route, route_clock: { elapsed_ms: 0, running: false } })] });
    expect(curves([100, 20, 400, 20, 400, 100]).length).toBeGreaterThan(0);
    expect(curves([400, 300, 60, 300, 100, 100]).length, 'closing leg uses the first anchor in-handle').toBeGreaterThan(0);
  });
});

describe('Editar manejadores (K4)', () => {
  const route = { mode: 'once' as const, points: [{ x: 100, y: 100 }, { x: 300, y: 100, in: { x: 300, y: 20 }, out: { x: 300, y: 180 } }, { x: 500, y: 300 }] };
  const setup = () => {
    const guard = token({ route, route_clock: { elapsed_ms: 0, running: false } });
    return { guard, ...renderTable({ tokens: [guard], selectedId: guard.id }) };
  };

  it('dragging a handle moves it and mirrors the opposite one', () => {
    const { canvas, props, guard } = setup();
    down(canvas, { x: 301, y: 181 }); drag(canvas, { x: 340, y: 160 }); up(canvas, { x: 340, y: 160 });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [route.points[0], { x: 300, y: 100, in: { x: 260, y: 40 }, out: { x: 340, y: 160 } }, route.points[2]]);
  });

  it('with Alt only that handle moves', () => {
    const { canvas, props, guard } = setup();
    down(canvas, { x: 300, y: 21 }, { altKey: true }); drag(canvas, { x: 250, y: 30 }, { altKey: true }); up(canvas, { x: 250, y: 30 }, { altKey: true });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [route.points[0], { x: 300, y: 100, in: { x: 250, y: 30 }, out: { x: 300, y: 180 } }, route.points[2]]);
  });

  it('dragging the anchor carries its handles', () => {
    const { canvas, props, guard } = setup();
    down(canvas, { x: 300, y: 100 }); drag(canvas, { x: 310, y: 110 }); up(canvas, { x: 310, y: 110 });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [route.points[0], { x: 310, y: 110, in: { x: 310, y: 30 }, out: { x: 310, y: 190 } }, route.points[2]]);
  });
});
