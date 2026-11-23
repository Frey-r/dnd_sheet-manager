/* ClassPanel (T-12 and T-14, complement to the locked creator tests): the class counter (players without
   sidekicks, NPCs with the "Compañeros"), loading and empty catalogue, the tile that keeps the chosen book,
   the book select only for classes with several entries, and "Sin clase" in NPC mode. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SRDClass } from '../../../../types/srd';
import { auraForClass } from '../../../../lib/avatar';
import { ClassPanel, type NPCClassOptions } from '../ClassPanel';
import { FIGHTER, ROGUE, WIZARD } from '../../../../test/catalog';
import { CLASSES_WITH_SIDEKICKS, NPC_CLASSES, WARRIOR_SIDEKICK, WARRIOR_SIDEKICK_PLAIN } from '../../../../test/catalog-npc';

const FIGHTER_2024: SRDClass = { ...FIGHTER, id: 24, name: "Fighter (Player's Handbook (2024))", source: 'XPHB' };

function renderPanel({ classes = NPC_CLASSES, loading = false, klass = null, npc }: {
  classes?: SRDClass[]; loading?: boolean; klass?: SRDClass | null; npc?: Partial<NPCClassOptions> | true;
} = {}) {
  const onChoose = vi.fn();
  const onNoClass = vi.fn();
  const options = npc ? { noClass: false, onNoClass, ...(npc === true ? {} : npc) } : undefined;
  const view = render(<ClassPanel classes={classes} loading={loading} klass={klass} onChoose={onChoose} npc={options} />);
  return { ...view, onChoose, onNoClass, user: userEvent.setup() };
}

const panel = () => screen.getByRole('region', { name: 'Clases' });
const counter = () => panel().querySelector('.cc-panel__meta')?.textContent;
const tile = (name: string) => within(panel()).getByRole('button', { name });
const bookSelect = () => within(panel()).queryByRole('combobox');

describe('ClassPanel · contador, carga, vacío, libro y Sin clase (T-12, T-14)', () => {
  it('jugadores: el contador y las losetas no cuentan las sidekick; no hay Compañeros ni "Sin clase"', () => {
    renderPanel({ classes: CLASSES_WITH_SIDEKICKS });
    expect(counter()).toBe('3');
    expect(within(panel()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Fighter', 'Rogue', 'Wizard']);
    expect(within(panel()).queryByRole('group', { name: 'Compañeros' })).toBeNull();
    expect(within(panel()).queryByRole('button', { name: 'Sin clase' })).toBeNull();
  });

  it('PNJ: el contador suma las clases y los compañeros; "Sin clase" va al final', () => {
    renderPanel({ npc: true });
    expect(counter()).toBe('6');
    const group = within(panel()).getByRole('group', { name: 'Compañeros' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Expert Sidekick', 'Spellcaster Sidekick', 'Warrior Sidekick']);
    expect(within(panel()).getAllByRole('button').at(-1)).toHaveTextContent('Sin clase');
  });

  it('cargando: indicador de carga y sin aviso de catálogo vacío', () => {
    renderPanel({ classes: [], loading: true });
    expect(within(panel()).getByRole('status')).toHaveTextContent('Cargando…');
    expect(within(panel()).queryByText('Sin clases en el catálogo.')).toBeNull();
  });

  it('catálogo vacío: aviso, sin indicador de carga y contador vacío (también en modo PNJ)', () => {
    renderPanel({ classes: [], npc: true });
    expect(within(panel()).getByText('Sin clases en el catálogo.')).toBeInTheDocument();
    expect(within(panel()).queryByRole('status')).toBeNull();
    expect(counter()).toBe('');
  });

  it('con clases cargadas no hay aviso de vacío ni indicador de carga', () => {
    renderPanel({ classes: [WIZARD] });
    expect(within(panel()).queryByText('Sin clases en el catálogo.')).toBeNull();
    expect(within(panel()).queryByRole('status')).toBeNull();
  });

  it('elegir otra clase pasa su entrada preferida aunque ya haya una elegida', async () => {
    const { user, onChoose } = renderPanel({ classes: [WIZARD, FIGHTER, FIGHTER_2024], klass: WIZARD });
    expect(tile('Wizard')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Fighter')).toHaveAttribute('aria-pressed', 'false');
    await user.click(tile('Fighter'));
    expect(onChoose).toHaveBeenCalledWith(FIGHTER_2024);
  });

  it('pulsar la clase elegida conserva el libro elegido', async () => {
    const { user, onChoose } = renderPanel({ classes: [WIZARD, FIGHTER, FIGHTER_2024], klass: FIGHTER });
    await user.click(tile('Fighter'));
    expect(onChoose).toHaveBeenCalledWith(FIGHTER);
  });

  it('el selector de libro aparece solo si la clase elegida tiene varias entradas y cambia de entrada', async () => {
    const { user, onChoose } = renderPanel({ classes: [WIZARD, FIGHTER, FIGHTER_2024], klass: FIGHTER });
    const select = bookSelect();
    expect(select).toHaveAccessibleName('Versión o libro de Fighter');
    expect(within(select as HTMLElement).getAllByRole('option').map((o) => o.textContent)).toEqual(["Player's Handbook (2014)", "Player's Handbook (2024)"]);
    await user.selectOptions(select as HTMLElement, String(FIGHTER_2024.id));
    expect(onChoose).toHaveBeenCalledWith(FIGHTER_2024);
  });

  it('una clase con una sola entrada muestra su libro sin selector', () => {
    renderPanel({ classes: [WIZARD, FIGHTER, FIGHTER_2024], klass: WIZARD });
    expect(bookSelect()).toBeNull();
    expect(within(panel()).getByText("Player's Handbook (2014) · SRD")).toBeInTheDocument();
  });

  it('sin clase elegida no hay selector y se invita a elegir', () => {
    renderPanel({ classes: [FIGHTER, FIGHTER_2024] });
    expect(bookSelect()).toBeNull();
    expect(within(panel()).getByText('Elige una clase para ver sus competencias.')).toBeInTheDocument();
  });

  it('PNJ: un compañero con varias entradas también tiene selector de libro', () => {
    renderPanel({ classes: CLASSES_WITH_SIDEKICKS, klass: WARRIOR_SIDEKICK_PLAIN, npc: true });
    expect(tile('Warrior Sidekick')).toHaveAttribute('aria-pressed', 'true');
    expect(bookSelect()).toHaveAccessibleName('Versión o libro de Warrior Sidekick');
  });

  it('jugadores: una sidekick que llega elegida no ofrece su selector de libro', () => {
    renderPanel({ classes: CLASSES_WITH_SIDEKICKS, klass: WARRIOR_SIDEKICK });
    expect(bookSelect()).toBeNull();
  });

  it('"Sin clase": refleja la elección, avisa al pulsarla y explica los PG sugeridos', async () => {
    const { user, onNoClass, onChoose } = renderPanel({ npc: { noClass: true } });
    const none = tile('Sin clase');
    expect(none).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel()).getByText(/^Sin clase: sin aura ni objeto en la mano/)).toBeInTheDocument();
    await user.click(none);
    expect(onNoClass).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('PNJ sin elegir nada: "Sin clase" sin pulsar y el texto por defecto', () => {
    renderPanel({ npc: true });
    expect(tile('Sin clase')).toHaveAttribute('aria-pressed', 'false');
    expect(within(panel()).getByText('Elige una clase para ver sus competencias.')).toBeInTheDocument();
  });

  it('cada loseta lleva el color de aura de su clase', () => {
    renderPanel({ classes: [ROGUE, WIZARD] });
    expect(tile('Rogue').style.getPropertyValue('--cls')).toBe(auraForClass(ROGUE.name));
    expect(tile('Wizard').style.getPropertyValue('--cls')).toBe(auraForClass(WIZARD.name));
  });
});
