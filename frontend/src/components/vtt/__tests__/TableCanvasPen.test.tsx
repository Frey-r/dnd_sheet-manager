/* T-30 · contratos/T-30-pluma-photoshop.md — the route pen behaves like Photoshop's pen (W1…W8).
   Sensor: minimal recording 2D context; canvas at (30, 40), 800×600; the 800×400 scene is fitted at z = 0.95 (view 20, 110). */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableCanvas } from '../TableCanvas';
import { newExploredCanvas, renderFog } from '../../../lib/vision';
import type { VTTScene, VTTToken } from '../../../services/vttApi';
import type { Route } from '../../../lib/vtt/routePosition';

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
  x: 700, y: 380, size_cells: 1, hp: 0, max_hp: 0, ac: 10, hidden: false, vision_ft: 0, darkvision_ft: 0, blindsight_ft: 0,
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
type Init = Record<string, unknown>;
const down = (cv: HTMLElement, p: Pt, i: Init = {}) => fireEvent.pointerDown(cv, { pointerId: 1, button: 0, buttons: 1, ...client(p), ...i });
const drag = (cv: HTMLElement, p: Pt, i: Init = {}) => fireEvent.pointerMove(cv, { pointerId: 1, buttons: 1, ...client(p), ...i });
const hover = (cv: HTMLElement, p: Pt) => fireEvent.pointerMove(cv, { pointerId: 1, buttons: 0, ...client(p) });
const up = (cv: HTMLElement, p: Pt, i: Init = {}) => fireEvent.pointerUp(cv, { pointerId: 1, button: 0, buttons: 0, ...client(p), ...i });
const tap = (cv: HTMLElement, p: Pt, i: Init = {}) => { down(cv, p, i); up(cv, p, i); };

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

const drawing = () => { const guard = token(); return { guard, ...renderTable({ tokens: [guard], selectedId: guard.id }) }; };
const editing = (route: Route) => {
  const guard = token({ route, route_clock: { elapsed_ms: 0, running: false } });
  return { guard, ...renderTable({ tokens: [guard], selectedId: guard.id }) };
};

describe('Dibujar (W1–W4)', () => {
  it('W1: the rubber band is already curved when the last anchor has an out handle', () => {
    const { canvas } = drawing();
    down(canvas, { x: 100, y: 100 }); drag(canvas, { x: 200, y: 100 }); up(canvas, { x: 200, y: 100 });
    hover(canvas, { x: 300, y: 250 });
    expect(curves([200, 100, 300, 250, 300, 250]).length).toBeGreaterThan(0);
  });

  it('W2: dragging on the first anchor when closing shapes the closing leg', () => {
    const { canvas, props, guard } = drawing();
    tap(canvas, { x: 100, y: 100 }); tap(canvas, { x: 300, y: 100 }); tap(canvas, { x: 300, y: 300 });
    down(canvas, { x: 101, y: 101 }); drag(canvas, { x: 140, y: 100 });
    expect(props.onRoute).not.toHaveBeenCalled();
    up(canvas, { x: 140, y: 100 });
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100, out: { x: 140, y: 100 }, in: { x: 60, y: 100 } }, { x: 300, y: 100 }, { x: 300, y: 300 }], true);
  });

  it('W3: Alt while dragging a new anchor moves only the out handle', () => {
    const { canvas, props, guard } = drawing();
    tap(canvas, { x: 100, y: 100 });
    down(canvas, { x: 300, y: 100 }); drag(canvas, { x: 300, y: 180 }); drag(canvas, { x: 350, y: 150 }, { altKey: true }); up(canvas, { x: 350, y: 150 }, { altKey: true });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100, out: { x: 350, y: 150 }, in: { x: 300, y: 20 } }], false);
  });

  it('W4: Shift constrains a handle to 45°', () => {
    const { canvas, props, guard } = drawing();
    tap(canvas, { x: 100, y: 100 });
    down(canvas, { x: 300, y: 100 }); drag(canvas, { x: 340, y: 150 }, { shiftKey: true }); up(canvas, { x: 340, y: 150 }, { shiftKey: true });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100, out: { x: 345, y: 145 }, in: { x: 255, y: 55 } }], false);
  });
});

describe('Editar la ruta guardada (W5–W8)', () => {
  it('W5: a click on a straight leg adds a corner anchor at the projection', () => {
    const route: Route = { mode: 'once', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }] };
    const { canvas, props, guard } = editing(route);
    tap(canvas, { x: 200, y: 103 });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }]);
    expect(props.onRoute).not.toHaveBeenCalled();
  });

  it('W5: a click on a curve splits it without changing its shape (De Casteljau)', () => {
    const route: Route = { mode: 'once', points: [{ x: 100, y: 100, out: { x: 100, y: 0 } }, { x: 300, y: 100, in: { x: 300, y: 0 } }] };
    const { canvas, props, guard } = editing(route);
    tap(canvas, { x: 200, y: 26 });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [
      { x: 100, y: 100, out: { x: 100, y: 50 } },
      { x: 200, y: 25, in: { x: 150, y: 25 }, out: { x: 250, y: 25 } },
      { x: 300, y: 100, in: { x: 300, y: 50 } },
    ]);
  });

  it('W6: a click on a middle anchor deletes it; never below 2 anchors (open) or 3 (cycle)', () => {
    const open: Route = { mode: 'once', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }] };
    const a = editing(open);
    tap(a.canvas, { x: 300, y: 100 });
    expect(a.props.onRouteEdit).toHaveBeenCalledWith(a.guard, [{ x: 100, y: 100 }, { x: 300, y: 300 }]);
    document.body.innerHTML = '';
    const cycle: Route = { mode: 'loop', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }] };
    const b = editing(cycle);
    tap(b.canvas, { x: 300, y: 100 });
    expect(b.props.onRouteEdit).not.toHaveBeenCalled();
  });

  it('W7: a click on the last end of an open route continues drawing from it', () => {
    const route: Route = { mode: 'pingpong', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }] };
    const { canvas, props, guard } = editing(route);
    tap(canvas, { x: 300, y: 100 });
    tap(canvas, { x: 300, y: 300 });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }], false);
  });

  it('W7: from the first end, the route is reversed (handles swapped)', () => {
    const route: Route = { mode: 'once', points: [{ x: 100, y: 100, out: { x: 150, y: 50 } }, { x: 300, y: 100 }] };
    const { canvas, props, guard } = editing(route);
    tap(canvas, { x: 100, y: 100 });
    tap(canvas, { x: 100, y: 300 });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(props.onRoute).toHaveBeenCalledWith(guard, [{ x: 300, y: 100 }, { x: 100, y: 100, in: { x: 150, y: 50 } }, { x: 100, y: 300 }], false);
  });

  it('W8: Alt+click converts a smooth anchor into a corner', () => {
    const route: Route = { mode: 'once', points: [{ x: 100, y: 100 }, { x: 300, y: 100, in: { x: 250, y: 60 }, out: { x: 350, y: 140 } }, { x: 500, y: 100 }] };
    const { canvas, props, guard } = editing(route);
    tap(canvas, { x: 300, y: 100 }, { altKey: true });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 500, y: 100 }]);
  });

  it('W8: Alt+drag from a corner anchor pulls symmetric handles', () => {
    const route: Route = { mode: 'once', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 500, y: 100 }] };
    const { canvas, props, guard } = editing(route);
    down(canvas, { x: 300, y: 100 }, { altKey: true }); drag(canvas, { x: 360, y: 60 }, { altKey: true }); up(canvas, { x: 360, y: 60 }, { altKey: true });
    expect(props.onRouteEdit).toHaveBeenCalledWith(guard, [{ x: 100, y: 100 }, { x: 300, y: 100, out: { x: 360, y: 60 }, in: { x: 240, y: 140 } }, { x: 500, y: 100 }]);
  });
});
