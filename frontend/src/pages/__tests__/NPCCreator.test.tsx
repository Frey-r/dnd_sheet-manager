/* T-14 · Creador de PNJ con la distribución del creador de jugadores.
   Contrato: contratos/T-14-npc-creador.md (estructura accesible, C1–C7); spec: character-appearance.md
   § NPC creator y § Sidekick classes; decisiones D-0040 y D-0041.
   Montajes: NPCCreatorPage en /campaign/:campaignId/gm/npcs/new y …/:npcId/edit; para C6, la lista
   (NPCManager, ruta /campaign/:campaignId/gm/npcs) y el detalle (NPCDetail, …/npcs/:npcId), con una sonda
   de la ruta actual para comprobar a dónde navegan "Añadir NPC" y "Editar NPC". */
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NPCCreatorPage } from '../NPCCreator';
import { NPCManager } from '../NPCManager';
import { NPCDetail } from '../NPCDetail';
import { npcApi } from '../../services/api';
import { listClasses, listRaces } from '../../services/srdService';
import { AVATAR_H, BODIES, HAIR_STYLES, normalizeAppearance, type Appearance } from '../../lib/avatar';
import {
  HALFLING, HALFLING_VISUAL, NPC_CLASSES, NPC_LIST, NPC_PIP, NPC_PLAIN, NPC_PORTRAIT, NPC_RACES, PIP_APPEARANCE, PIP_STATS,
  SIDEKICK_BASES, WARRIOR_SIDEKICK,
} from '../../test/catalog-npc';
import { renderRoute } from '../../test/render';

vi.mock(import('../../services/srdService'), async (importOriginal) => ({
  ...(await importOriginal()),
  listRaces: vi.fn(),
  listClasses: vi.fn(),
}));
// npcApi (and the market/combat calls of the NPC detail) become spies too: no network.
vi.mock(import('../../services/api'), async (importOriginal) => {
  const actual = await importOriginal();
  const spies = <T extends object>(o: T) => Object.fromEntries(Object.keys(o).map((k) => [k, vi.fn()])) as unknown as T;
  return {
    ...(await import('../../test/mocks')).mockApiModule(actual),
    npcApi: spies(actual.npcApi),
    marketApi: spies(actual.marketApi),
    combatApi: spies(actual.combatApi),
  };
});

const CAMPAIGN_ID = 7;
const STEPS = ['Origen', 'Personalización', 'Estadísticas', 'Detalles'] as const;
const PLAYER_CLASSES = ['Wizard', 'Fighter', 'Rogue'];
const ABILITY_LABELS = { str: 'Fuerza', dex: 'Destreza', con: 'Constitución', int: 'Inteligencia', wis: 'Sabiduría', cha: 'Carisma' } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRaces).mockResolvedValue({ data: NPC_RACES });
  vi.mocked(listClasses).mockResolvedValue({ data: NPC_CLASSES });
  vi.mocked(npcApi.list).mockResolvedValue({ data: NPC_LIST } as never);
  vi.mocked(npcApi.get).mockResolvedValue({ data: NPC_PIP } as never);
  vi.mocked(npcApi.create).mockResolvedValue({ data: { ...NPC_PIP, id: 11 } } as never);
  vi.mocked(npcApi.update).mockResolvedValue({ data: NPC_PIP } as never);
});

const renderCreator = () => renderRoute(<NPCCreatorPage />, {
  path: '/campaign/:campaignId/gm/npcs/new',
  url: `/campaign/${CAMPAIGN_ID}/gm/npcs/new`,
});
const renderEditor = () => renderRoute(<NPCCreatorPage />, {
  path: '/campaign/:campaignId/gm/npcs/:npcId/edit',
  url: `/campaign/${CAMPAIGN_ID}/gm/npcs/${NPC_PIP.id}/edit`,
});

/** Shows the current path, so a test can read where a link or button navigated to. */
function LocationProbe() {
  return <p data-testid="ruta-actual">{useLocation().pathname}</p>;
}
const currentPath = () => screen.getByTestId('ruta-actual').textContent;

const region = (name: string) => screen.getByRole('region', { name });
const actionBar = () => screen.getByRole('navigation', { name: 'Acciones del creador' });
const stageAvatar = () => within(region('Escenario')).getByRole('img', { name: /^Retrato de / });
const panelRow = (label: string) => within(region('Personalización')).getByRole('group', { name: label });
const companions = () => within(region('Clases')).getByRole('group', { name: 'Compañeros' });
const precedes = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const stepButton = (step: string) => within(actionBar()).getByRole('button', { name: new RegExp(`${step}$`) });
/** A labelled field of Estadísticas or Detalles (number or text input). */
const field = (label: string) => screen.getByLabelText(label, { selector: 'input, textarea' }) as HTMLInputElement;
/** What the field shows: the typed or prefilled value, or the suggestion as placeholder. */
const shown = (input: HTMLInputElement) => input.value || input.getAttribute('placeholder') || '';
const auraOf = (el: HTMLElement) => el.style.getPropertyValue('--aura').trim();
const chosen = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true' || (el as HTMLInputElement).checked === true;
const linkOrButton = (name: string) => screen.queryByRole('link', { name }) ?? screen.getByRole('button', { name });

/** Index of the value shown in a ◀ value ▶ row: exactly one of `names` must be visible as its own text. */
function shownIndex(row: HTMLElement, names: readonly string[]) {
  const visible = names.flatMap((n, i) => (within(row).queryAllByText(n).length ? [i] : []));
  expect(visible, `la fila debe mostrar exactamente uno de: ${names.join(', ')}`).toHaveLength(1);
  return visible[0];
}

async function goTo(user: UserEvent, step: (typeof STEPS)[number]) {
  const button = stepButton(step);
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

async function chooseOrigin(user: UserEvent, classBase: string | null) {
  const razas = await screen.findByRole('region', { name: 'Razas' });
  await user.click(await within(razas).findByRole('button', { name: 'Halfling' }));
  const clases = region('Clases');
  if (classBase === null) await user.click(await within(clases).findByRole('button', { name: 'Sin clase' }));
  else await user.click(await within(clases).findByRole('button', { name: classBase }));
}

async function typeInto(user: UserEvent, label: string, value: string | number) {
  const input = field(label);
  await user.clear(input);
  await user.type(input, String(value));
}

async function chooseRelation(user: UserEvent, label: 'Aliado' | 'Neutral' | 'Enemigo') {
  const group = screen.getByRole('group', { name: 'Relación' });
  await user.click(within(group).queryByRole('radio', { name: label }) ?? within(group).getByRole('button', { name: label }));
}

async function clickPrimary(user: UserEvent, name: string) {
  const button = within(actionBar()).getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

describe('NPCCreatorPage · distribución WoW con Compañeros (T-14)', () => {
  it('C1 distribución: regiones Razas, Escenario y Clases; "Clases" tiene el grupo Compañeros y "Sin clase"; 4 pasos', async () => {
    renderCreator();
    const razas = await screen.findByRole('region', { name: 'Razas' });
    const clases = region('Clases');
    expect(precedes(razas, clases), 'Razas va antes que Clases').toBe(true);
    expect(within(region('Escenario')).getByRole('img', { name: /^Retrato de / })).toBeInTheDocument();
    expect(within(razas).getByRole('group', { name: 'Tipo de cuerpo' })).toBeInTheDocument();
    expect(await within(razas).findByRole('button', { name: 'Halfling' })).toHaveAttribute('aria-pressed', 'false');

    const group = companions();
    for (const name of SIDEKICK_BASES) {
      expect(within(group).getByRole('button', { name }), `${name} en Compañeros`).toHaveAttribute('aria-pressed', 'false');
    }
    for (const name of PLAYER_CLASSES) {
      const tile = within(clases).getByRole('button', { name });
      expect(group.contains(tile), `${name} no es un compañero`).toBe(false);
      expect(precedes(tile, group), `${name} va antes que Compañeros`).toBe(true);
    }
    const none = within(clases).getByRole('button', { name: 'Sin clase' });
    expect(none).toHaveAttribute('aria-pressed', 'false');
    expect(precedes(group, none), 'Sin clase va después de Compañeros').toBe(true);

    const steps = STEPS.map(stepButton);
    steps.slice(1).forEach((step, i) => expect(precedes(steps[i], step), `${STEPS[i]} antes que ${STEPS[i + 1]}`).toBe(true));
  });

  it('C2 crear: Halfling + Warrior Sidekick, peinado, estadísticas y detalles → npcApi.create con raza, clase, apariencia y stats', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Warrior Sidekick');
    expect(within(companions()).getByRole('button', { name: 'Warrior Sidekick' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(region('Razas')).getByRole('button', { name: 'Halfling' })).toHaveAttribute('aria-pressed', 'true');

    await goTo(user, 'Personalización');
    await screen.findByRole('region', { name: 'Personalización' });
    expect(HALFLING_VISUAL.hair, 'fixture: el mediano usa peinados').toBe(true);
    const before = shownIndex(panelRow('Peinado'), HAIR_STYLES);
    await user.click(within(panelRow('Peinado')).getByRole('button', { name: 'Peinado: siguiente' }));
    const hair = shownIndex(panelRow('Peinado'), HAIR_STYLES);
    expect(hair).toBe((before + 1) % HAIR_STYLES.length);

    await goTo(user, 'Estadísticas');
    const stats = { str: 8, dex: 16, con: 12, int: 10, wis: 13, cha: 14 };
    for (const [key, label] of Object.entries(ABILITY_LABELS)) await typeInto(user, label, stats[key as keyof typeof stats]);
    await typeInto(user, 'Clase de armadura', 13);
    await typeInto(user, 'Puntos de golpe', 11);
    await typeInto(user, 'Velocidad', 30);

    await goTo(user, 'Detalles');
    await typeInto(user, 'Nombre', 'Pip');
    await typeInto(user, 'Oficio o rol', 'Cocinero del gremio');
    await chooseRelation(user, 'Aliado');
    await typeInto(user, 'Descripción y notas', 'Sabe todos los rumores del puerto.');
    await clickPrimary(user, 'Crear PNJ');

    await waitFor(() => expect(npcApi.create).toHaveBeenCalledTimes(1));
    const [campaignId, payload] = vi.mocked(npcApi.create).mock.calls[0];
    expect(String(campaignId)).toBe(String(CAMPAIGN_ID));
    expect(payload).toMatchObject({
      name: 'Pip', role: 'Cocinero del gremio', status: 'ally', description: 'Sabe todos los rumores del puerto.',
      race: HALFLING.name, class: WARRIOR_SIDEKICK.name,
      stats: { ...stats, ac: 13, hp: 11, speed: 30 },
    });
    const appearance = payload.appearance as Appearance;
    expect(appearance).toMatchObject({ v: 1, hair });
    expect(normalizeAppearance(appearance, HALFLING_VISUAL), 'apariencia válida para el mediano').toEqual(appearance);
    expect(npcApi.update).not.toHaveBeenCalled();
  });

  it('C3 sin clase: el escenario muestra el avatar sin aura y class se envía vacío', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Warrior Sidekick');
    expect(auraOf(stageAvatar()), 'con un compañero hay aura').not.toMatch(/^(transparent)?$/);

    const none = within(region('Clases')).getByRole('button', { name: 'Sin clase' });
    await user.click(none);
    expect(none).toHaveAttribute('aria-pressed', 'true');
    expect(within(companions()).getByRole('button', { name: 'Warrior Sidekick' })).toHaveAttribute('aria-pressed', 'false');
    expect(auraOf(stageAvatar()), 'sin clase no hay aura').toBe('transparent');
    expect(stageAvatar()).not.toHaveClass('avatar-pulse');

    await goTo(user, 'Personalización');
    await goTo(user, 'Estadísticas');
    await goTo(user, 'Detalles');
    await typeInto(user, 'Nombre', 'Bruno');
    await clickPrimary(user, 'Crear PNJ');

    await waitFor(() => expect(npcApi.create).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(npcApi.create).mock.calls[0][1];
    expect(payload).toMatchObject({ name: 'Bruno', race: HALFLING.name, class: '' });
    expect(payload.appearance, 'el PNJ sin clase también tiene avatar').toMatchObject({ v: 1 });
  });

  it('C4 prellenado con clase: velocidad de la raza y PG = dado de golpe + mod CON mientras el GM no los escribe', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Warrior Sidekick');
    await goTo(user, 'Personalización');
    await goTo(user, 'Estadísticas');

    expect(shown(field('Velocidad')), 'velocidad del mediano').toBe(String(HALFLING.speed));
    expect(shown(field('Constitución')), 'característica por defecto').toBe('10');
    expect(shown(field('Puntos de golpe')), 'd8 + mod CON 10 (+0)').toBe(String(WARRIOR_SIDEKICK.hit_die));
    await typeInto(user, 'Constitución', 14);
    expect(shown(field('Puntos de golpe')), 'd8 + mod CON 14 (+2)').toBe(String(WARRIOR_SIDEKICK.hit_die + 2));

    await goTo(user, 'Detalles');
    await typeInto(user, 'Nombre', 'Pip');
    await clickPrimary(user, 'Crear PNJ');
    await waitFor(() => expect(npcApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(npcApi.create).mock.calls[0][1], 'lo prellenado se guarda').toMatchObject({
      stats: { con: 14, hp: WARRIOR_SIDEKICK.hit_die + 2, speed: HALFLING.speed, str: 10 },
    });
  });

  it('C4 sin clase: PG sugeridos = 4 + mod CON; lo que escribe el GM manda sobre la sugerencia', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, null);
    await goTo(user, 'Personalización');
    await goTo(user, 'Estadísticas');

    expect(shown(field('Puntos de golpe')), '4 + mod CON 10 (+0)').toBe('4');
    await typeInto(user, 'Constitución', 14);
    expect(shown(field('Puntos de golpe')), '4 + mod CON 14 (+2)').toBe('6');
    await typeInto(user, 'Puntos de golpe', 7);
    await typeInto(user, 'Velocidad', 20);
    await typeInto(user, 'Constitución', 8);
    expect(shown(field('Puntos de golpe')), 'el GM escribió los PG').toBe('7');
    expect(shown(field('Velocidad')), 'el GM escribió la velocidad').toBe('20');

    await goTo(user, 'Detalles');
    await typeInto(user, 'Nombre', 'Bruno');
    await clickPrimary(user, 'Crear PNJ');
    await waitFor(() => expect(npcApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(npcApi.create).mock.calls[0][1]).toMatchObject({ class: '', stats: { con: 8, hp: 7, speed: 20 } });
  });

  it('C5 editar: la ruta de edición prellena raza, clase, apariencia, estadísticas y detalles; "Guardar PNJ" llama a npcApi.update', async () => {
    const { user } = renderEditor();
    await screen.findByRole('region', { name: 'Razas' });
    await waitFor(() => expect(within(region('Razas')).getByRole('button', { name: 'Halfling' })).toHaveAttribute('aria-pressed', 'true'));
    expect(within(companions()).getByRole('button', { name: 'Warrior Sidekick' })).toHaveAttribute('aria-pressed', 'true');

    await goTo(user, 'Personalización');
    await screen.findByRole('region', { name: 'Personalización' });
    expect(shownIndex(panelRow('Peinado'), HAIR_STYLES), 'peinado guardado').toBe(PIP_APPEARANCE.hair);
    expect(shownIndex(panelRow('Tipo de cuerpo'), BODIES), 'complexión guardada').toBe(PIP_APPEARANCE.body);

    await goTo(user, 'Estadísticas');
    for (const [key, label] of Object.entries(ABILITY_LABELS)) {
      expect(field(label), label).toHaveDisplayValue(String(PIP_STATS[key as keyof typeof PIP_STATS]));
    }
    expect(field('Clase de armadura')).toHaveDisplayValue(String(PIP_STATS.ac));
    expect(field('Puntos de golpe')).toHaveDisplayValue(String(PIP_STATS.hp));
    expect(field('Velocidad')).toHaveDisplayValue(String(PIP_STATS.speed));
    await typeInto(user, 'Fuerza', 9);

    await goTo(user, 'Detalles');
    expect(field('Nombre')).toHaveDisplayValue(NPC_PIP.name);
    expect(field('Oficio o rol')).toHaveDisplayValue(NPC_PIP.role);
    expect(field('Descripción y notas')).toHaveDisplayValue(NPC_PIP.description);
    const relation = screen.getByRole('group', { name: 'Relación' });
    const ally = within(relation).queryByRole('radio', { name: 'Aliado' }) ?? within(relation).getByRole('button', { name: 'Aliado' });
    expect(chosen(ally), 'relación guardada: Aliado').toBe(true);
    expect(within(actionBar()).queryByRole('button', { name: 'Crear PNJ' }), 'al editar se guarda, no se crea').toBeNull();

    await typeInto(user, 'Nombre', 'Pip el Audaz');
    await clickPrimary(user, 'Guardar PNJ');

    await waitFor(() => expect(npcApi.update).toHaveBeenCalledTimes(1));
    const [campaignId, npcId, payload] = vi.mocked(npcApi.update).mock.calls[0];
    expect(String(campaignId)).toBe(String(CAMPAIGN_ID));
    expect(String(npcId)).toBe(String(NPC_PIP.id));
    expect(payload).toMatchObject({
      name: 'Pip el Audaz', race: HALFLING.name, class: WARRIOR_SIDEKICK.name, status: 'ally',
      stats: { ...PIP_STATS, str: 9 },
    });
    expect(payload.appearance).toMatchObject({ hair: PIP_APPEARANCE.hair, body: PIP_APPEARANCE.body });
    expect(npcApi.create).not.toHaveBeenCalled();
  });

  it('C7 avatar persistente: el img del escenario es el mismo nodo en los 4 pasos', async () => {
    const { user } = renderCreator();
    await screen.findByRole('region', { name: 'Escenario' });
    const avatar = stageAvatar();

    await chooseOrigin(user, 'Warrior Sidekick');
    expect(stageAvatar(), 'Origen').toBe(avatar);
    await goTo(user, 'Personalización');
    await screen.findByRole('region', { name: 'Personalización' });
    expect(stageAvatar(), 'Personalización').toBe(avatar);
    await goTo(user, 'Estadísticas');
    field('Fuerza');
    expect(stageAvatar(), 'Estadísticas').toBe(avatar);
    await goTo(user, 'Detalles');
    field('Nombre');
    expect(stageAvatar(), 'Detalles').toBe(avatar);
    expect(avatar).toBeInTheDocument();
  });

  it('RG-1 recursos: recorrer los 4 pasos y volver pide el catálogo de razas y clases una sola vez', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Expert Sidekick');
    for (const step of STEPS.slice(1)) await goTo(user, step);
    await goTo(user, 'Origen');
    await screen.findByRole('region', { name: 'Razas' });

    expect(listRaces).toHaveBeenCalledTimes(1);
    expect(listClasses).toHaveBeenCalledTimes(1);
    expect(npcApi.create).not.toHaveBeenCalled();
  });
});

describe('Lista y detalle de PNJ con avatar pixel (T-14 C6)', () => {
  /** Card of an NPC in the list: the article (or list item) that holds its name. */
  async function cardOf(name: string) {
    const label = await screen.findByText(name);
    const card = label.closest<HTMLElement>('article, li, [role="article"], [role="listitem"]');
    expect(card, `tarjeta de ${name}`).not.toBeNull();
    return card as HTMLElement;
  }

  it('C6 lista: recorte de cabeza pixel para el PNJ con apariencia, retrato subido o iniciales para los antiguos; "Añadir NPC" lleva a /gm/npcs/new', async () => {
    const { user } = renderRoute(<><NPCManager /><LocationProbe /></>, {
      path: '/campaign/:campaignId/gm/npcs/*',
      url: `/campaign/${CAMPAIGN_ID}/gm/npcs`,
    });

    const pip = await cardOf(NPC_PIP.name);
    const head = within(pip).getByRole('img', { name: /^Retrato de / });
    expect(head.tagName, 'avatar pixel (PixelAvatar)').toBe('CANVAS');
    expect(Number(head.getAttribute('height')), 'recorte de cabeza, no el sprite entero').toBeLessThan(AVATAR_H);

    const vex = await cardOf(NPC_PORTRAIT.name);
    expect(vex.querySelector(`img[src="${NPC_PORTRAIT.image_url}"]`), 'retrato subido').not.toBeNull();
    expect(vex.querySelector('canvas'), 'sin raza ni apariencia no hay avatar pixel').toBeNull();

    const marlo = await cardOf(NPC_PLAIN.name);
    expect(within(marlo).getByText('VM'), 'iniciales').toBeInTheDocument();
    expect(marlo.querySelector('canvas, img'), 'sin retrato ni avatar').toBeNull();

    expect(currentPath()).toBe(`/campaign/${CAMPAIGN_ID}/gm/npcs`);
    await user.click(linkOrButton('Añadir NPC'));
    await waitFor(() => expect(currentPath()).toBe(`/campaign/${CAMPAIGN_ID}/gm/npcs/new`));
  });

  it('C6 detalle: sprite pixel completo del PNJ y "Editar NPC" lleva a /gm/npcs/:npcId/edit', async () => {
    const { user } = renderRoute(<><NPCDetail /><LocationProbe /></>, {
      path: '/campaign/:campaignId/gm/npcs/:npcId/*',
      url: `/campaign/${CAMPAIGN_ID}/gm/npcs/${NPC_PIP.id}`,
    });

    await screen.findByRole('heading', { name: NPC_PIP.name, level: 1 });
    const sprites = screen.queryAllByRole('img', { name: /^Retrato de / }).filter((el) => el.tagName === 'CANVAS');
    expect(sprites.map((el) => Number(el.getAttribute('height'))), 'sprite completo del PNJ').toContain(AVATAR_H);

    await user.click(linkOrButton('Editar NPC'));
    await waitFor(() => expect(currentPath()).toBe(`/campaign/${CAMPAIGN_ID}/gm/npcs/${NPC_PIP.id}/edit`));
  });
});
