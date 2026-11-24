/* T-20 · contratos/T-20-ruta-frontend.md — F4 (routine panel) and F5 (place a campaign NPC). */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlaceNpcList, RoutinePanel } from '../NpcRoutinePanel';
import type { VTTToken } from '../../../services/vttApi';

const token = (over: Partial<VTTToken> = {}): VTTToken => ({
  id: 7, scene_id: 1, name: 'Guardia', kind: 'npc', character_id: null, owner_user_id: null, image_url: '', color: '#333',
  x: 35, y: 35, size_cells: 1, hp: 10, max_hp: 10, ac: 12, hidden: false, vision_ft: 0, darkvision_ft: 0, blindsight_ft: 0,
  light_bright_ft: 0, light_dim_ft: 0, speed_ft: 30, passive_perception: 10, stealth_bonus: 0, dex_mod: 0, sneaking: false,
  detects: false, npc_id: null, disposition: 'neutral', route: null, route_paused: false, route_clock: null, ...over,
});
const patrol = { mode: 'loop' as const, points: [{ x: 35, y: 35 }, { x: 315, y: 35 }, { x: 315, y: 315 }] };

function setup(t: VTTToken) {
  const props = { token: t, onSetRoute: vi.fn(), onAction: vi.fn(), onDisposition: vi.fn(), onStartDrawing: vi.fn() };
  render(<RoutinePanel {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('RoutinePanel (F4)', () => {
  it('a token without route is static and offers to draw one', async () => {
    const p = setup(token());
    expect(screen.getByText('Quieto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
    await p.user.click(screen.getByRole('button', { name: 'Trazar ruta' }));
    expect(p.onStartDrawing).toHaveBeenCalledOnce();
  });

  it('shows the mode and changes it keeping the points', async () => {
    const p = setup(token({ route: patrol, route_clock: { elapsed_ms: 0, running: true } }));
    expect(screen.getByRole('button', { name: 'Patrulla' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('En ruta')).toBeInTheDocument();
    await p.user.click(screen.getByRole('button', { name: 'Ida y vuelta' }));
    expect(p.onSetRoute).toHaveBeenCalledWith({ mode: 'pingpong', points: patrol.points });
    await p.user.click(screen.getByRole('button', { name: 'Ida' }));
    expect(p.onSetRoute).toHaveBeenLastCalledWith({ mode: 'once', points: patrol.points });
  });

  it('pauses a walking route and resumes a paused one', async () => {
    const walking = setup(token({ route: patrol, route_clock: { elapsed_ms: 10, running: true } }));
    await walking.user.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(walking.onAction).toHaveBeenCalledWith('pause');
    walking.onAction.mockClear();
    document.body.innerHTML = '';
    const paused = setup(token({ route: patrol, route_paused: true, route_clock: { elapsed_ms: 10, running: false } }));
    expect(screen.getByText('Pausado')).toBeInTheDocument();
    await paused.user.click(screen.getByRole('button', { name: 'Reanudar' }));
    expect(paused.onAction).toHaveBeenCalledWith('resume');
  });

  it('a stopped clock that the GM did not pause reads «Detenido» (combat, narrative or inactive scene)', () => {
    setup(token({ route: patrol, route_clock: { elapsed_ms: 10, running: false } }));
    expect(screen.getByText('Detenido')).toBeInTheDocument();
  });

  it('restarts and removes the route', async () => {
    const p = setup(token({ route: patrol, route_clock: { elapsed_ms: 10, running: true } }));
    await p.user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(p.onAction).toHaveBeenCalledWith('restart');
    await p.user.click(screen.getByRole('button', { name: 'Quitar ruta' }));
    expect(p.onSetRoute).toHaveBeenCalledWith(null);
  });

  it('sets the same wait on every point', async () => {
    const p = setup(token({ route: patrol, route_clock: { elapsed_ms: 0, running: true } }));
    const wait = screen.getByLabelText('Espera en cada punto (s)');
    await p.user.clear(wait);
    await p.user.type(wait, '4');
    await p.user.tab();
    expect(p.onSetRoute).toHaveBeenLastCalledWith({ mode: 'loop', points: patrol.points.map((pt) => ({ ...pt, wait_s: 4 })) });
  });

  it('a loose token edits its disposition', async () => {
    const p = setup(token({ kind: 'monster', disposition: 'hostile' }));
    const group = screen.getByRole('group', { name: 'Disposición' });
    expect(within(group).getByRole('button', { name: 'Hostil' })).toHaveAttribute('aria-pressed', 'true');
    await p.user.click(within(group).getByRole('button', { name: 'Amistoso' }));
    expect(p.onDisposition).toHaveBeenCalledWith('friendly');
  });

  it('a campaign NPC shows its relation read-only', () => {
    setup(token({ npc_id: 3, npc_status: 'enemy', disposition: 'neutral' }));
    expect(screen.queryByRole('group', { name: 'Disposición' })).not.toBeInTheDocument();
    expect(screen.getByText(/Enemigo/)).toBeInTheDocument();
    expect(screen.getByText(/se cambia en la ficha del PNJ/)).toBeInTheDocument();
  });

  it('player tokens have no routine', () => {
    const { container } = render(<RoutinePanel token={token({ kind: 'pc' })} onSetRoute={vi.fn()} onAction={vi.fn()} onDisposition={vi.fn()} onStartDrawing={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PlaceNpcList (F5)', () => {
  const npcs = [{ id: 1, name: 'Guardia Brom', status: 'neutral' }, { id: 2, name: 'Mira la herrera', status: 'ally' }, { id: 3, name: 'Capitán Vex', status: 'enemy' }];

  it('lists the campaign NPCs, filters them and picks one', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<PlaceNpcList npcs={npcs} placedIds={new Set([2])} onPick={onPick} />);
    expect(screen.getAllByRole('button', { name: /Colocar/ })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Colocar Mira la herrera/ })).toHaveTextContent('en la escena');
    await user.type(screen.getByPlaceholderText('Buscar PNJ…'), 'vex');
    expect(screen.getAllByRole('button', { name: /Colocar/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /Colocar Capitán Vex/ }));
    expect(onPick).toHaveBeenCalledWith(npcs[2]);
  });

  it('explains when the campaign has no NPCs', () => {
    render(<PlaceNpcList npcs={[]} placedIds={new Set()} onPick={vi.fn()} />);
    expect(screen.getByText(/no tiene PNJ/)).toBeInTheDocument();
  });
});
