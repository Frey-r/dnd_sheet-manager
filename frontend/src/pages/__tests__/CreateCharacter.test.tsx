/* T-5 · Creador de personajes con distribución de World of Warcraft.
   Contrato: contratos/T-5-creador-wow.md (estructura accesible, W1–W9 y presupuesto RG-1). */
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCharacterPage } from '../CreateCharacter';
import { api, characterApi } from '../../services/api';
import { listClasses, listRaces } from '../../services/srdService';
import { BODIES, HAIR_STYLES, OUTFITS, normalizeAppearance, resolveRaceVisual, skinsFor, type Appearance } from '../../lib/avatar';
import { CLASSES, ELF_2024, ELF_ENTRIES, RACES, WIZARD } from '../../test/catalog';
import { renderRoute } from '../../test/render';

vi.mock(import('../../services/srdService'), async (importOriginal) => ({
  ...(await importOriginal()),
  listRaces: vi.fn(),
  listClasses: vi.fn(),
}));
vi.mock(import('../../services/api'), async (importOriginal) => (await import('../../test/mocks')).mockApiModule(await importOriginal()));

const CAMPAIGN_ID = 7;
const ELF_VISUAL = resolveRaceVisual(ELF_2024.name, ELF_2024.size);
const BODY_TYPES = ['Complexión ancha', 'Complexión esbelta'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRaces).mockResolvedValue({ data: RACES });
  vi.mocked(listClasses).mockResolvedValue({ data: CLASSES });
  vi.mocked(api.get).mockResolvedValue({ data: { current: null } } as never);
  vi.mocked(characterApi.create).mockResolvedValue({ data: { id: 99, warnings: [] } } as never);
});

const renderCreator = () => renderRoute(<CreateCharacterPage />, {
  path: '/campaign/:campaignId/character/new',
  url: `/campaign/${CAMPAIGN_ID}/character/new`,
});

const region = (name: string) => screen.getByRole('region', { name });
const actionBar = () => screen.getByRole('navigation', { name: 'Acciones del creador' });
const stageAvatar = () => within(region('Escenario')).getByRole('img', { name: /^Retrato de / });
const panelRow = (label: string) => within(region('Personalización')).getByRole('group', { name: label });
const precedes = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/** Clicks the bottom bar action once it is enabled (steps validate asynchronously). */
async function clickPrimary(user: UserEvent, name: string) {
  const button = within(actionBar()).getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

async function chooseOrigin(user: UserEvent, raceBase = 'Elf', classBase = 'Wizard') {
  const razas = await screen.findByRole('region', { name: 'Razas' });
  await user.click(await within(razas).findByRole('button', { name: raceBase }));
  await user.click(await within(region('Clases')).findByRole('button', { name: classBase }));
}

/** Index of the value shown in a ◀ value ▶ row: exactly one of `names` must be visible as its own text. */
function shownIndex(row: HTMLElement, names: readonly string[]) {
  const shown = names.flatMap((n, i) => (within(row).queryAllByText(n).length ? [i] : []));
  expect(shown, `la fila debe mostrar exactamente uno de: ${names.join(', ')}`).toHaveLength(1);
  return shown[0];
}

describe('CreateCharacterPage · distribución WoW (T-5)', () => {
  it('W1 distribución de Origen: regiones Razas, Escenario y Clases; Tipo de cuerpo antes de las razas', async () => {
    renderCreator();
    const razas = await screen.findByRole('region', { name: 'Razas' });
    const escenario = region('Escenario');
    const clases = region('Clases');
    expect(precedes(razas, clases), 'Razas va antes que Clases en el DOM').toBe(true);
    expect(within(escenario).getByRole('img', { name: /^Retrato de / })).toBeInTheDocument();

    const body = within(razas).getByRole('group', { name: 'Tipo de cuerpo' });
    for (const name of BODY_TYPES) expect(within(body).getByRole('button', { name })).toHaveAttribute('aria-pressed');
    expect(precedes(body, within(razas).getByLabelText('Buscar raza')), 'Tipo de cuerpo va antes que la búsqueda').toBe(true);

    for (const name of ['Human', 'Elf', 'Tiefling', 'Dwarf']) {
      const tile = await within(razas).findByRole('button', { name });
      expect(precedes(body, tile), `Tipo de cuerpo va antes que la raza ${name}`).toBe(true);
      expect(tile).toHaveAttribute('aria-pressed', 'false');
    }
    expect(within(razas).getAllByRole('button', { name: 'Elf' }), 'una sola ficha por raza base').toHaveLength(1);
    for (const name of ['Wizard', 'Fighter', 'Rogue']) {
      expect(await within(clases).findByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('W2 selección: Elf y Wizard quedan pulsados y el escenario muestra "Elf · Wizard"', async () => {
    const { user } = renderCreator();
    const escenario = await screen.findByRole('region', { name: 'Escenario' });
    expect(within(escenario).getByText('Raza · Clase')).toBeInTheDocument();

    await chooseOrigin(user, 'Elf', 'Wizard');
    expect(within(region('Razas')).getByRole('button', { name: 'Elf' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(region('Razas')).getByRole('button', { name: 'Human' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(region('Clases')).getByRole('button', { name: 'Wizard' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(region('Clases')).getByRole('button', { name: 'Fighter' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(region('Escenario')).getByText('Elf · Wizard')).toBeInTheDocument();
  });

  it('Detalle: los rasgos de la raza y las competencias de la clase se leen en Origen', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user, 'Elf', 'Wizard');
    expect(within(actionBar()).getByRole('button', { name: 'Personalizar' }), 'sigue en Origen').toBeInTheDocument();
    // Whichever Elf entry is the default, its trait is on screen; Wizard's weapon proficiencies too.
    expect(screen.getAllByText(/Trance|Elven Lineage/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Quarterstaffs/)).toBeInTheDocument();
  });

  it('W3 versiones: una raza con 2 entradas muestra el select de versión o libro y cambiarlo cambia la entrada', async () => {
    const { user } = renderCreator();
    const razas = await screen.findByRole('region', { name: 'Razas' });
    const versionSelect = { name: /versi[oó]n|libro/i };

    await user.click(await within(razas).findByRole('button', { name: 'Human' }));
    expect(within(region('Razas')).queryByRole('combobox', versionSelect), 'Human tiene una sola entrada').toBeNull();

    await user.click(within(region('Razas')).getByRole('button', { name: 'Elf' }));
    const select = within(region('Razas')).getByRole('combobox', versionSelect);
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    expect(options).toHaveLength(ELF_ENTRIES.length);
    expect(new Set(options.map((o) => o.textContent)).size, 'cada entrada se distingue por su libro').toBe(ELF_ENTRIES.length);
    const other = options.find((o) => !o.selected);
    expect(other).toBeDefined();
    const otherText = other?.textContent ?? '';

    await user.selectOptions(select, other as HTMLOptionElement);
    expect(within(region('Razas')).getByRole('combobox', versionSelect)).toHaveDisplayValue(otherText);
    expect(within(region('Razas')).getByRole('button', { name: 'Elf' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('W4 tipo de cuerpo: "Complexión esbelta" queda pulsada y desmarca "Complexión ancha"', async () => {
    const { user } = renderCreator();
    await screen.findByRole('region', { name: 'Razas' });
    const bodyButton = (name: string) => within(within(region('Razas')).getByRole('group', { name: 'Tipo de cuerpo' })).getByRole('button', { name });
    const [ancha, esbelta] = BODY_TYPES;

    expect(bodyButton(ancha)).toHaveAttribute('aria-pressed', 'true');
    expect(bodyButton(esbelta)).toHaveAttribute('aria-pressed', 'false');
    await user.click(bodyButton(esbelta));
    expect(bodyButton(esbelta)).toHaveAttribute('aria-pressed', 'true');
    expect(bodyButton(ancha)).toHaveAttribute('aria-pressed', 'false');
    await user.click(bodyButton(ancha));
    expect(bodyButton(ancha)).toHaveAttribute('aria-pressed', 'true');
    expect(bodyButton(esbelta)).toHaveAttribute('aria-pressed', 'false');
  });

  it('W5 bloqueo: "Personalizar" está deshabilitado hasta tener raza y clase', async () => {
    const { user } = renderCreator();
    const clases = await screen.findByRole('region', { name: 'Clases' });
    const personalizar = () => within(actionBar()).getByRole('button', { name: 'Personalizar' });

    expect(personalizar()).toBeDisabled();
    await user.click(await within(clases).findByRole('button', { name: 'Wizard' }));
    expect(personalizar(), 'falta la raza').toBeDisabled();
    await user.click(await within(region('Razas')).findByRole('button', { name: 'Elf' }));
    expect(personalizar()).toBeEnabled();
  });

  it('W6 personalización: filas ◀ valor ▶, Peinado avanza por HAIR_STYLES y Piel abre la paleta de la raza', async () => {
    const { user } = renderCreator();
    await chooseOrigin(user);
    await clickPrimary(user, 'Personalizar');
    const panel = await screen.findByRole('region', { name: 'Personalización' });

    expect(ELF_VISUAL.hair, 'fixture: el elfo usa peinados').toBe(true);
    const colorRows = ['Piel', 'Ojos', 'Color de pelo', 'Color principal', 'Color secundario'];
    const valueRows = ['Tipo de cuerpo', 'Peinado', ...(ELF_VISUAL.options.length > 1 ? ['Rasgo racial'] : []), 'Atuendo'];
    for (const label of [...valueRows, ...colorRows]) {
      const row = within(panel).getByRole('group', { name: label });
      expect(within(row).getByRole('button', { name: `${label}: anterior` })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: `${label}: siguiente` })).toBeInTheDocument();
    }
    for (const label of colorRows) {
      expect(within(panelRow(label)).getByRole('button', { name: `${label}: elegir color` })).toBeInTheDocument();
    }
    shownIndex(panelRow('Tipo de cuerpo'), BODIES);
    shownIndex(panelRow('Atuendo'), OUTFITS);
    if (ELF_VISUAL.options.length > 1) shownIndex(panelRow('Rasgo racial'), ELF_VISUAL.options.map((o) => o.label));
    expect(screen.getByRole('button', { name: 'Aleatorio' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /ficha/i })).toBeInTheDocument();

    const hair = shownIndex(panelRow('Peinado'), HAIR_STYLES);
    await user.click(within(panelRow('Peinado')).getByRole('button', { name: 'Peinado: siguiente' }));
    expect(shownIndex(panelRow('Peinado'), HAIR_STYLES)).toBe((hair + 1) % HAIR_STYLES.length);
    await user.click(within(panelRow('Peinado')).getByRole('button', { name: 'Peinado: anterior' }));
    expect(shownIndex(panelRow('Peinado'), HAIR_STYLES)).toBe(hair);

    const skins = skinsFor(ELF_VISUAL);
    const openSkins = async () => {
      await user.click(within(panelRow('Piel')).getByRole('button', { name: 'Piel: elegir color' }));
      return screen.findByRole('listbox');
    };
    const options = within(await openSkins()).getAllByRole('option');
    expect(options).toHaveLength(skins.length);
    const target = options.findIndex((o) => o.getAttribute('aria-selected') !== 'true');
    await user.click(options[target]);
    // The swatch grid may close on pick: reopen it to read the selection.
    const listbox = screen.queryByRole('listbox') ?? await openSkins();
    const selected = within(listbox).getAllByRole('option').map((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toEqual(skins.map((_, i) => i === target));
  });

  it('W7 avatar persistente: el img del escenario es el mismo nodo en los 4 pasos', async () => {
    const { user } = renderCreator();
    await screen.findByRole('region', { name: 'Escenario' });
    const avatar = stageAvatar();

    await chooseOrigin(user);
    expect(stageAvatar(), 'Origen').toBe(avatar);
    await clickPrimary(user, 'Personalizar');
    await screen.findByRole('region', { name: 'Personalización' });
    expect(stageAvatar(), 'Personalización').toBe(avatar);
    await clickPrimary(user, 'Siguiente');
    expect(stageAvatar(), 'Características').toBe(avatar);
    await clickPrimary(user, 'Siguiente');
    await screen.findByRole('textbox', { name: 'Nombre' });
    expect(stageAvatar(), 'Detalles').toBe(avatar);
    expect(avatar).toBeInTheDocument();
  });

  it('W8 detalles y creación: "Crear personaje" envía la apariencia elegida, la raza y la clase', async () => {
    const { user } = renderCreator();
    const razas = await screen.findByRole('region', { name: 'Razas' });
    await user.click(within(within(razas).getByRole('group', { name: 'Tipo de cuerpo' })).getByRole('button', { name: 'Complexión esbelta' }));
    await chooseOrigin(user);
    await clickPrimary(user, 'Personalizar');
    await screen.findByRole('region', { name: 'Personalización' });
    await user.click(within(panelRow('Peinado')).getByRole('button', { name: 'Peinado: siguiente' }));
    const hair = shownIndex(panelRow('Peinado'), HAIR_STYLES);
    await clickPrimary(user, 'Siguiente');
    await clickPrimary(user, 'Siguiente');
    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Lyra');
    await clickPrimary(user, 'Crear personaje');

    await waitFor(() => expect(characterApi.create).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(characterApi.create).mock.calls[0][0];
    expect(payload).toMatchObject({ name: 'Lyra', class: WIZARD.name, campaign_id: CAMPAIGN_ID });
    expect(ELF_ENTRIES.map((e) => e.name)).toContain(payload.race);
    const appearance = payload.appearance as Appearance;
    expect(appearance).toMatchObject({ v: 1, body: 1, hair });
    expect(normalizeAppearance(appearance, ELF_VISUAL, true), 'apariencia válida para el elfo').toEqual(appearance);
  });

  it('W9 barra inferior: "Acciones del creador" está en los 4 pasos y "Atrás" se deshabilita en Origen', async () => {
    const { user } = renderCreator();
    await screen.findByRole('region', { name: 'Razas' });
    const back = () => within(actionBar()).getByRole('button', { name: 'Atrás' });
    const primary = (name: string) => within(actionBar()).getByRole('button', { name });

    expect(back(), 'Origen').toBeDisabled();
    expect(primary('Personalizar')).toBeInTheDocument();
    await chooseOrigin(user);
    await clickPrimary(user, 'Personalizar');

    await screen.findByRole('region', { name: 'Personalización' });
    expect(back(), 'Personalización').toBeEnabled();
    expect(primary('Siguiente')).toBeInTheDocument();
    await clickPrimary(user, 'Siguiente');

    expect(back(), 'Características').toBeEnabled();
    expect(primary('Siguiente')).toBeInTheDocument();
    await clickPrimary(user, 'Siguiente');

    await screen.findByRole('textbox', { name: 'Nombre' });
    expect(back(), 'Detalles').toBeEnabled();
    expect(primary('Crear personaje')).toBeInTheDocument();

    for (let i = 0; i < 3; i++) await user.click(back());
    expect(await screen.findByRole('region', { name: 'Razas' })).toBeInTheDocument();
    expect(primary('Personalizar')).toBeInTheDocument();
    expect(back(), 'de vuelta en Origen').toBeDisabled();
  });

  it('RG-1 recursos: recorrer los 4 pasos reutiliza las queries srd-races y srd-classes sin peticiones nuevas', async () => {
    const { user, client } = renderCreator();
    await chooseOrigin(user);
    await clickPrimary(user, 'Personalizar');
    await clickPrimary(user, 'Siguiente');
    await clickPrimary(user, 'Siguiente');
    await screen.findByRole('textbox', { name: 'Nombre' });
    for (let i = 0; i < 3; i++) await user.click(within(actionBar()).getByRole('button', { name: 'Atrás' }));
    await screen.findByRole('region', { name: 'Razas' });

    expect(listRaces).toHaveBeenCalledTimes(1);
    expect(listClasses).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().find({ queryKey: ['srd-races'], exact: true })).toBeDefined();
    expect(client.getQueryCache().find({ queryKey: ['srd-classes'], exact: true })).toBeDefined();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
