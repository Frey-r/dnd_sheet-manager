/* T-14 · Creador de PNJ, complemento de los tests bloqueados (NPCCreator.test.tsx) para el cierre por mutación:
   título y rótulos del escenario, qué paneles abre cada paso (Resumen solo en Detalles), pistas de Estadísticas,
   avisos de error al guardar y al cargar el catálogo, la puerta de carga al editar (mocks diferidos), PNJ antiguos
   (sin clase, estadísticas parciales o nulas, claves de perfil que se conservan) y la navegación tras guardar. */
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NPCCreatorPage } from '../NPCCreator';
import { npcApi } from '../../services/api';
import { listClasses, listRaces } from '../../services/srdService';
import { HALFLING, NPC_CLASSES, NPC_PIP, NPC_RACES, WARRIOR_SIDEKICK } from '../../test/catalog-npc';
import { renderRoute } from '../../test/render';

vi.mock(import('../../services/srdService'), async (importOriginal) => ({
  ...(await importOriginal()),
  listRaces: vi.fn(),
  listClasses: vi.fn(),
}));
vi.mock(import('../../services/api'), async (importOriginal) => {
  const actual = await importOriginal();
  const spies = <T extends object>(o: T) => Object.fromEntries(Object.keys(o).map((k) => [k, vi.fn()])) as unknown as T;
  return { ...(await import('../../test/mocks')).mockApiModule(actual), npcApi: spies(actual.npcApi) };
});

const CAMPAIGN_ID = 7;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRaces).mockResolvedValue({ data: NPC_RACES });
  vi.mocked(listClasses).mockResolvedValue({ data: NPC_CLASSES });
  vi.mocked(npcApi.get).mockResolvedValue({ data: NPC_PIP } as never);
  vi.mocked(npcApi.create).mockResolvedValue({ data: { ...NPC_PIP, id: 11 } } as never);
  vi.mocked(npcApi.update).mockResolvedValue({ data: NPC_PIP } as never);
});

function LocationProbe() {
  return <p data-testid="ruta-actual">{useLocation().pathname}</p>;
}
const currentPath = () => screen.getByTestId('ruta-actual').textContent;

/** Creator at …/npcs/new; the route also matches the detail it navigates to, so the probe stays mounted. */
const renderCreator = () => renderRoute(<><NPCCreatorPage /><LocationProbe /></>, {
  path: '/campaign/:campaignId/gm/npcs/*',
  url: `/campaign/${CAMPAIGN_ID}/gm/npcs/new`,
});
const renderEditor = () => renderRoute(<><NPCCreatorPage /><LocationProbe /></>, {
  path: '/campaign/:campaignId/gm/npcs/:npcId/*',
  url: `/campaign/${CAMPAIGN_ID}/gm/npcs/${NPC_PIP.id}/edit`,
});

const region = (name: string) => screen.getByRole('region', { name });
const actionBar = () => screen.getByRole('navigation', { name: 'Acciones del creador' });
const stage = () => region('Escenario');
const eyebrow = () => stage().querySelector('.cc-stage__eyebrow')?.textContent;
const caption = () => stage().querySelector('.cc-stage__title')?.textContent;
const hint = () => actionBar().querySelector('.cc-bar__hint')?.textContent;
const stepButton = (step: string) => within(actionBar()).getByRole('button', { name: new RegExp(`${step}$`) });
const field = (label: string) => screen.getByLabelText(label, { selector: 'input, textarea' }) as HTMLInputElement;
const heading = (name: string) => screen.queryByRole('heading', { name, level: 2 });

async function goTo(user: UserEvent, step: string) {
  const button = stepButton(step);
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

async function chooseOrigin(user: UserEvent, classBase: string) {
  const razas = await screen.findByRole('region', { name: 'Razas' });
  await user.click(await within(razas).findByRole('button', { name: 'Halfling' }));
  await user.click(await within(region('Clases')).findByRole('button', { name: classBase }));
}

async function typeInto(user: UserEvent, label: string, value: string | number) {
  const input = field(label);
  await user.clear(input);
  await user.type(input, String(value));
}

/** Which step panels are on screen: Personalización, Ficha, Estadísticas, Identidad, Resumen and the name field. */
const panels = () => ({
  races: !screen.getByRole('region', { name: 'Razas', hidden: true }).closest('[hidden]'),
  classes: !screen.getByRole('region', { name: 'Clases', hidden: true }).closest('[hidden]'),
  customize: screen.queryByRole('region', { name: 'Personalización' }) !== null,
  token: heading('Ficha') !== null,
  stats: heading('Estadísticas') !== null,
  identity: screen.queryByRole('group', { name: 'Relación' }) !== null,
  summary: heading('Resumen') !== null,
  name: screen.queryByLabelText('Nombre', { selector: 'input' }) !== null,
});
const NONE = { races: false, classes: false, customize: false, token: false, stats: false, identity: false, summary: false, name: false };

describe('NPCCreatorPage · complemento (T-14)', () => {
  it('crear: título, escenario "Nuevo PNJ" · "Raza · Clase" en silueta y rótulos al elegir origen y nombre', async () => {
    const { user } = renderCreator();
    expect(screen.getByRole('heading', { level: 1, name: 'Crear PNJ' })).toBeInTheDocument();
    expect(eyebrow()).toBe('Nuevo PNJ');
    expect(caption()).toBe('Raza · Clase');
    expect(stage().querySelector('.cc-stage__figure')).toHaveClass('is-placeholder');
    expect(hint()).toBe('Elige una raza y una clase.');

    await chooseOrigin(user, 'Warrior Sidekick');
    expect(caption()).toBe('Halfling · Warrior Sidekick');
    expect(stage().querySelector('.cc-stage__figure')).not.toHaveClass('is-placeholder');
    await user.click(within(region('Clases')).getByRole('button', { name: 'Sin clase' }));
    expect(caption()).toBe('Halfling · Sin clase');
    expect(hint()).toBe('Paso 1 de 4');

    await goTo(user, 'Detalles');
    expect(hint()).toBe('Ponle nombre al PNJ.');
    await typeInto(user, 'Nombre', '  Pip  ');
    expect(eyebrow()).toBe('Pip');
    expect(hint()).toBe('Paso 4 de 4');
  });

  it('cada paso abre sus paneles: Origen, Personalización con la ficha, Estadísticas y Detalles con el Resumen', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Warrior Sidekick');
    expect(panels()).toEqual({ ...NONE, races: true, classes: true });

    await goTo(user, 'Personalización');
    await screen.findByRole('region', { name: 'Personalización' });
    expect(panels()).toEqual({ ...NONE, customize: true, token: true });
    expect(screen.getByText('Así se verá su ficha en la mesa.')).toBeInTheDocument();
    expect(screen.getByText('Y así en la lista de PNJ.')).toBeInTheDocument();

    await goTo(user, 'Estadísticas');
    expect(panels()).toEqual({ ...NONE, stats: true });

    await goTo(user, 'Detalles');
    expect(panels()).toEqual({ ...NONE, identity: true, summary: true, name: true });
  });

  it('Resumen: PG, CA, velocidad e iniciativa de lo escrito o sugerido, con la raza y la clase', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Warrior Sidekick');
    await goTo(user, 'Estadísticas');
    await typeInto(user, 'Destreza', 14);
    await typeInto(user, 'Clase de armadura', 15);
    await goTo(user, 'Detalles');

    const summary = heading('Resumen')!.closest('section') as HTMLElement;
    expect(within(summary).getByText('Halfling · Warrior Sidekick')).toBeInTheDocument();
    const facts = Object.fromEntries([...summary.querySelectorAll('.cc-stat')].map((s) => [s.querySelector('dt')?.textContent, s.querySelector('dd')?.textContent]));
    expect(facts).toEqual({ PG: String(WARRIOR_SIDEKICK.hit_die), CA: '15', Velocidad: `${HALFLING.speed} pies`, Iniciativa: '+2' });
    expect(within(summary).getByText('Se cambian en Estadísticas.')).toBeInTheDocument();
  });

  it('Estadísticas: pistas del dado de golpe de la clase (o d4 sin clase) y de la velocidad de la raza', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Warrior Sidekick');
    await goTo(user, 'Estadísticas');
    expect(screen.getByText(`Sugeridos: d${WARRIOR_SIDEKICK.hit_die} + mod. CON`)).toBeInTheDocument();
    expect(screen.getByText('Sugerida: la de Halfling')).toBeInTheDocument();

    await goTo(user, 'Origen');
    await user.click(within(region('Clases')).getByRole('button', { name: 'Sin clase' }));
    await goTo(user, 'Estadísticas');
    expect(screen.getByText('Sugeridos: d4 + mod. CON')).toBeInTheDocument();
  });

  it('guardar: "Guardando…" mientras espera, invalida la lista y navega al detalle del PNJ creado', async () => {
    const pending = deferred<{ data: typeof NPC_PIP }>();
    vi.mocked(npcApi.create).mockReturnValue(pending.promise as never);
    const { user, client } = renderCreator();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await chooseOrigin(user, 'Warrior Sidekick');
    await goTo(user, 'Detalles');
    await typeInto(user, 'Nombre', 'Pip');
    await user.click(within(actionBar()).getByRole('button', { name: 'Crear PNJ' }));

    const busy = await within(actionBar()).findByRole('button', { name: 'Guardando…' });
    expect(busy).toBeDisabled();
    expect(currentPath()).toBe(`/campaign/${CAMPAIGN_ID}/gm/npcs/new`);
    pending.resolve({ data: { ...NPC_PIP, id: 11 } });
    await waitFor(() => expect(currentPath()).toBe(`/campaign/${CAMPAIGN_ID}/gm/npcs/11`));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['npcs', String(CAMPAIGN_ID)] });
  });

  it('error al guardar: aviso y el creador sigue abierto con lo escrito', async () => {
    vi.mocked(npcApi.create).mockRejectedValue(new Error('boom'));
    const { user } = renderCreator();
    await chooseOrigin(user, 'Warrior Sidekick');
    await goTo(user, 'Detalles');
    await typeInto(user, 'Nombre', 'Pip');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(within(actionBar()).getByRole('button', { name: 'Crear PNJ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el PNJ');
    expect(field('Nombre')).toHaveDisplayValue('Pip');
    expect(currentPath()).toBe(`/campaign/${CAMPAIGN_ID}/gm/npcs/new`);
  });

  it.each([
    ['razas', () => { vi.mocked(listRaces).mockRejectedValue(new Error('razas')); }],
    ['clases', () => { vi.mocked(listClasses).mockRejectedValue(new Error('clases')); }],
  ])('catálogo de %s caído: aviso sobre el creador, que sigue montado', async (_name, fail) => {
    fail();
    renderCreator();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo de razas y clases');
    expect(region('Razas')).toBeInTheDocument();
    expect(region('Clases')).toBeInTheDocument();
  });

  it('con el catálogo cargado no hay avisos', async () => {
    renderCreator();
    await within(await screen.findByRole('region', { name: 'Razas' })).findByRole('button', { name: 'Halfling' });
    await within(region('Clases')).findByRole('button', { name: 'Warrior Sidekick' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('NPCCreatorPage · editar (T-14)', () => {
  const NPC_KEY = ['npcs', String(CAMPAIGN_ID), String(NPC_PIP.id)];
  /** What stays pending, its query key, how to make its request wait and what it answers at the end. */
  type Gate = [what: string, key: string[], hold: (pending: Promise<unknown>) => void, value: unknown];
  const GATES: Gate[] = [
    ['el PNJ', NPC_KEY, (p) => vi.mocked(npcApi.get).mockReturnValue(p as never), { data: NPC_PIP }],
    ['las razas', ['srd-races'], (p) => vi.mocked(listRaces).mockReturnValue(p as never), { data: NPC_RACES }],
    ['las clases', ['srd-classes'], (p) => vi.mocked(listClasses).mockReturnValue(p as never), { data: NPC_CLASSES }],
  ];
  it.each(GATES)('mientras falta %s solo se ve la carga; al llegar, el editor prellenado', async (_what, key, hold, value) => {
    const pending = deferred<unknown>();
    hold(pending.promise);
    const { client } = renderEditor();

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando…');
    // The other two requests have answered: only the pending one keeps the gate closed.
    const others = [NPC_KEY, ['srd-races'], ['srd-classes']].filter((k) => k.join() !== key.join());
    await waitFor(() => others.forEach((k) => expect(client.getQueryState(k)?.status, k.join()).toBe('success')));
    expect(client.getQueryState(key)?.status).toBe('pending');
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('region', { name: 'Razas' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Acciones del creador' })).toBeNull();

    pending.resolve(value);
    const razas = await screen.findByRole('region', { name: 'Razas' });
    expect(within(razas).getByRole('button', { name: 'Halfling' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Editar PNJ' })).toBeInTheDocument();
    expect(eyebrow()).toBe(NPC_PIP.name);
  });

  it.each([
    ['el PNJ', () => { vi.mocked(npcApi.get).mockRejectedValue(new Error('404')); }],
    ['el catálogo', () => { vi.mocked(listClasses).mockRejectedValue(new Error('500')); }],
  ])('si falla %s: aviso de carga y sin editor', async (_what, fail) => {
    fail();
    renderEditor();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el PNJ');
    expect(screen.queryByRole('region', { name: 'Razas' })).toBeNull();
  });

  it('PNJ sin clase y con estadísticas parciales: "Sin clase", vacíos = sugerido y el perfil se conserva al guardar', async () => {
    vi.mocked(npcApi.get).mockResolvedValue({ data: { ...NPC_PIP, class: '', stats: { ac: 12, cr: '1/2', traits: ['Valiente'] } } } as never);
    const { user } = renderEditor();
    const clases = await screen.findByRole('region', { name: 'Clases' });
    await waitFor(() => expect(within(clases).getByRole('button', { name: 'Sin clase' })).toHaveAttribute('aria-pressed', 'true'));
    expect(caption()).toBe('Halfling · Sin clase');

    await goTo(user, 'Estadísticas');
    expect(field('Fuerza')).toHaveDisplayValue('');
    expect(field('Fuerza')).toHaveAttribute('placeholder', '10');
    expect(field('Clase de armadura')).toHaveDisplayValue('12');
    expect(field('Puntos de golpe')).toHaveDisplayValue('');

    await goTo(user, 'Detalles');
    await user.click(within(actionBar()).getByRole('button', { name: 'Guardar PNJ' }));
    await waitFor(() => expect(npcApi.update).toHaveBeenCalledTimes(1));
    expect(vi.mocked(npcApi.update).mock.calls[0][2]).toMatchObject({
      class: '',
      stats: { cr: '1/2', traits: ['Valiente'], str: 10, ac: 12, hp: 4, speed: HALFLING.speed },
    });
    await waitFor(() => expect(currentPath()).toBe(`/campaign/${CAMPAIGN_ID}/gm/npcs/${NPC_PIP.id}`));
  });

  it('PNJ con estadísticas nulas: todos los campos vacíos con su sugerencia', async () => {
    vi.mocked(npcApi.get).mockResolvedValue({ data: { ...NPC_PIP, stats: null } } as never);
    const { user } = renderEditor();
    await screen.findByRole('region', { name: 'Razas' });
    await goTo(user, 'Estadísticas');
    for (const label of ['Fuerza', 'Clase de armadura', 'Puntos de golpe', 'Velocidad']) expect(field(label), label).toHaveDisplayValue('');
    expect(field('Velocidad')).toHaveAttribute('placeholder', String(HALFLING.speed));
  });

  it('PNJ con raza y clase fuera del catálogo: Origen queda sin elegir y bloquea los pasos', async () => {
    vi.mocked(npcApi.get).mockResolvedValue({ data: { ...NPC_PIP, race: 'Kenku', class: 'Bard' } } as never);
    renderEditor();
    const clases = await screen.findByRole('region', { name: 'Clases' });
    expect(within(clases).getByRole('button', { name: 'Sin clase' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(clases).getByRole('button', { name: 'Warrior Sidekick' })).toHaveAttribute('aria-pressed', 'false');
    expect(hint()).toBe('Elige una raza y una clase.');
    expect(caption()).toBe('Raza · Clase');
    expect(stepButton('Personalización')).toBeDisabled();
  });
});
