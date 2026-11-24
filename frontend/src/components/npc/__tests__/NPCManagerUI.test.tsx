/* T-27 · contratos/T-27-gestor-pnj-ui.md — U2…U7. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameClockBar } from '../GameClockBar';
import { AgendaEditor } from '../AgendaEditor';
import { CombatSheetForm } from '../CombatSheetForm';
import { WhereaboutsView } from '../WhereaboutsView';
import { GiveDialog } from '../GiveDialog';
import { SaveToAgendaDialog } from '../SaveToAgendaDialog';
import type { AgendaEntry, GameClock } from '../../../lib/npc/agenda';

const clock: GameClock = { game_day: 3, time_of_day: 'tarde', weekday: 'miercoles', first_weekday: 'lunes' };
const scenes = [{ id: 5, name: 'Muralla' }, { id: 7, name: 'Cuartel' }];

describe('GameClockBar (U2)', () => {
  it('the GM steps the clock and re-applies', async () => {
    const onStep = vi.fn(), onApply = vi.fn();
    const user = userEvent.setup();
    render(<GameClockBar clock={clock} isGM onStep={onStep} onApply={onApply} />);
    expect(screen.getByText('Día 3 · miércoles · Tarde')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avanzar el reloj' }));
    expect(onStep).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Retroceder el reloj' }));
    expect(onStep).toHaveBeenLastCalledWith(-1);
    await user.click(screen.getByRole('button', { name: 'Reaplicar agenda' }));
    expect(onApply).toHaveBeenCalledOnce();
  });
  it('players only see it', () => {
    render(<GameClockBar clock={clock} isGM={false} onStep={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByText('Día 3 · miércoles · Tarde')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('AgendaEditor (U3)', () => {
  const agenda: AgendaEntry[] = [
    { dia: 'todos', momento: 'noche', ubicacion: { escena_id: 7 }, posicion: { x: 70, y: 70 }, path: null },
    { dia: 'todos', momento: 'dia', ubicacion: { escena_id: 5 }, path: { mode: 'loop', points: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }] } },
  ];

  it('lists the entries in order', () => {
    render(<AgendaEditor agenda={agenda} scenes={scenes} onSave={vi.fn()} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Muralla · patrulla de 3 puntos');
    expect(rows[1]).toHaveTextContent('Cuartel · quieto en (70, 70)');
  });

  it('adds an entry with the form', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AgendaEditor agenda={agenda} scenes={scenes} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Añadir entrada' }));
    await user.selectOptions(screen.getByLabelText('Tipo de día'), 'semana');
    await user.selectOptions(screen.getByLabelText('Día de la semana'), 'domingo');
    await user.selectOptions(screen.getByLabelText('Momento'), 'tarde');
    await user.selectOptions(screen.getByLabelText('Escena'), '5');
    await user.clear(screen.getByLabelText('Posición X'));
    await user.type(screen.getByLabelText('Posición X'), '120');
    await user.clear(screen.getByLabelText('Posición Y'));
    await user.type(screen.getByLabelText('Posición Y'), '40');
    await user.click(screen.getByLabelText('Oculto'));
    await user.click(screen.getByRole('button', { name: 'Guardar entrada' }));
    expect(onSave).toHaveBeenCalledWith([...agenda, { dia: 'domingo', momento: 'tarde', ubicacion: { escena_id: 5 }, posicion: { x: 120, y: 40 }, path: null, oculto: true }]);
  });

  it('a numeric day and the away option', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AgendaEditor agenda={[]} scenes={scenes} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Añadir entrada' }));
    await user.selectOptions(screen.getByLabelText('Tipo de día'), 'numero');
    await user.clear(screen.getByLabelText('Día de juego'));
    await user.type(screen.getByLabelText('Día de juego'), '4');
    await user.selectOptions(screen.getByLabelText('Escena'), 'ausente');
    await user.click(screen.getByRole('button', { name: 'Guardar entrada' }));
    expect(onSave).toHaveBeenCalledWith([{ dia: 4, momento: 'dia', ubicacion: null }]);
  });

  it('editing keeps the route; deleting removes the row', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AgendaEditor agenda={agenda} scenes={scenes} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Editar entrada 1' })); // sorted: the day patrol first
    await user.click(screen.getByLabelText('Oculto'));
    await user.click(screen.getByRole('button', { name: 'Guardar entrada' }));
    const saved = onSave.mock.calls[0][0] as AgendaEntry[];
    const patrol = saved.find((e) => e.momento === 'dia')!;
    expect(patrol.path?.points).toHaveLength(3);
    expect(patrol.oculto).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Borrar entrada 2' }));
    expect(onSave).toHaveBeenLastCalledWith([agenda[1]]);
  });

  it('the JSON view saves, warns on broken JSON and shows the server problems', async () => {
    const onSave = vi.fn().mockRejectedValueOnce({ response: { data: { problems: ['entrada 2: repite el día y momento de la entrada 1'] } } }).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AgendaEditor agenda={agenda} scenes={scenes} onSave={onSave} />);
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    const box = screen.getByLabelText('Agenda en JSON') as HTMLTextAreaElement;
    expect(JSON.parse(box.value)).toEqual(agenda);
    await user.clear(box);
    await user.click(box);
    await user.paste('[{"dia": "todos", ');
    await user.click(screen.getByRole('button', { name: 'Guardar JSON' }));
    expect(screen.getByRole('alert')).toHaveTextContent('JSON no válido');
    expect(onSave).not.toHaveBeenCalled();
    await user.clear(box);
    await user.paste('[{"dia":"todos","momento":"dia","ubicacion":null},{"dia":"todos","momento":"dia","ubicacion":null}]');
    await user.click(screen.getByRole('button', { name: 'Guardar JSON' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(await screen.findByRole('alert')).toHaveTextContent('entrada 2: repite el día y momento de la entrada 1');
  });
});

describe('CombatSheetForm (U4)', () => {
  it('starts from the defaults and saves the edited sheet', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<CombatSheetForm combat={null} onSave={onSave} />);
    expect(screen.getByLabelText('PG')).toHaveValue(10);
    expect(screen.getByLabelText('Velocidad (pies)')).toHaveValue(30);
    await user.clear(screen.getByLabelText('PG'));
    await user.type(screen.getByLabelText('PG'), '22');
    await user.clear(screen.getByLabelText('PG máx.'));
    await user.type(screen.getByLabelText('PG máx.'), '22');
    await user.clear(screen.getByLabelText('CA'));
    await user.type(screen.getByLabelText('CA'), '16');
    await user.click(screen.getByLabelText('Detecta jugadores'));
    await user.click(screen.getByRole('button', { name: 'Guardar hoja de combate' }));
    expect(onSave).toHaveBeenCalledWith({ hp: 22, max_hp: 22, ac: 16, speed_ft: 30, passive_perception: 10, darkvision_ft: 0, blindsight_ft: 0, dex_mod: 0, stealth_bonus: 0, detects: true, size_cells: 1 });
  });
  it('shows a saved sheet', () => {
    render(<CombatSheetForm combat={{ hp: 5, max_hp: 9, ac: 12, speed_ft: 25 }} onSave={vi.fn()} />);
    expect(screen.getByLabelText('PG')).toHaveValue(5);
    expect(screen.getByLabelText('PG máx.')).toHaveValue(9);
    expect(screen.getByLabelText('CA')).toHaveValue(12);
  });
});

describe('WhereaboutsView (U5)', () => {
  it('shows scene, state and next destination', () => {
    render(<WhereaboutsView scenes={scenes} rows={[
      { npc_id: 1, nombre: 'Brom', relacion: 'enemy', escena_id: 5, escena: 'Muralla', estado: 'en_ruta', siguiente: { dia: 'todos', momento: 'noche', ubicacion: { escena_id: 7, escena: 'Cuartel' }, posicion: { x: 70, y: 70 }, path: null } },
      { npc_id: 2, nombre: 'Mira', relacion: 'ally', escena_id: null, escena: '', estado: 'sin_agenda', siguiente: null },
      { npc_id: 3, nombre: 'Vex', relacion: 'neutral', escena_id: null, escena: '', estado: 'ausente', siguiente: null },
    ]} />);
    const [brom, mira, vex] = screen.getAllByRole('row').slice(1);
    expect(brom).toHaveTextContent('Brom');
    expect(brom).toHaveTextContent('Muralla');
    expect(brom).toHaveTextContent('En ruta');
    expect(brom).toHaveTextContent('Cuartel · quieto en (70, 70)');
    expect(within(mira).getByText('Sin agenda')).toBeInTheDocument();
    expect(vex).toHaveTextContent('Ausente');
    expect(vex).toHaveTextContent('Se queda');
  });
});

describe('GiveDialog (U6)', () => {
  it('chooses a character and a quantity up to the maximum', async () => {
    const onGive = vi.fn();
    const user = userEvent.setup();
    render(<GiveDialog title="Entregar Alabarda" characters={[{ id: 4, name: 'Lyra' }, { id: 6, name: 'Thorin' }]} max={3} unit="objeto" onGive={onGive} onCancel={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Personaje'), '6');
    const qty = screen.getByLabelText('Cantidad');
    await user.clear(qty);
    await user.type(qty, '9');
    await user.click(screen.getByRole('button', { name: 'Entregar' }));
    expect(onGive).toHaveBeenCalledWith(6, 3);
  });
  it('coins are given in copper', async () => {
    const onGive = vi.fn();
    const user = userEvent.setup();
    render(<GiveDialog title="Entregar monedas" characters={[{ id: 4, name: 'Lyra' }]} max={250} unit="monedas" onGive={onGive} onCancel={vi.fn()} />);
    const qty = screen.getByLabelText('Monedas (pc)');
    await user.clear(qty);
    await user.type(qty, '120');
    await user.click(screen.getByRole('button', { name: 'Entregar' }));
    expect(onGive).toHaveBeenCalledWith(4, 120);
  });
});

describe('SaveToAgendaDialog (U7)', () => {
  it('defaults to the current clock and saves the chosen day and moment', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<SaveToAgendaDialog tokenName="Brom" clock={clock} onSave={onSave} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Día')).toHaveValue('3');
    expect(screen.getByLabelText('Momento')).toHaveValue('tarde');
    await user.click(screen.getByRole('button', { name: 'Guardar en la agenda' }));
    expect(onSave).toHaveBeenCalledWith(3, 'tarde');
    await user.selectOptions(screen.getByLabelText('Día'), 'laborables');
    await user.selectOptions(screen.getByLabelText('Momento'), 'noche');
    await user.click(screen.getByRole('button', { name: 'Guardar en la agenda' }));
    expect(onSave).toHaveBeenLastCalledWith('laborables', 'noche');
  });
});
