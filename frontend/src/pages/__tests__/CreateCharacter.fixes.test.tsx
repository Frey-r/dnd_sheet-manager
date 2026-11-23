/* T-6 · Correcciones del creador tras la revisión (contratos/T-6-creador-correcciones.md, F1–F6).
   Los tests de T-5 (CreateCharacter.test.tsx) siguen bloqueados; estos van aparte. Fixtures: el catálogo de
   T-5 más Tabaxi y Dragonborn (familias sin pelo) y Drow (fija defaults.hairColor), en test/catalog-extra.ts. */
import { render, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCharacterPage } from '../CreateCharacter';
import { CustomizePanel } from '../../components/character/creator/CustomizePanel';
import { api, characterApi } from '../../services/api';
import { listClasses, listRaces } from '../../services/srdService';
import { HAIR, HAIR_STYLES, defaultAppearance, resolveRaceVisual, type Appearance, type RaceVisual } from '../../lib/avatar';
import { CLASSES, ELF_2024, ELF_PHB } from '../../test/catalog';
import { DRAGONBORN, DROW, RACES_EXTRA, TABAXI } from '../../test/catalog-extra';
import { renderRoute } from '../../test/render';
import type { SRDRace } from '../../types/srd';

vi.mock(import('../../services/srdService'), async (importOriginal) => ({
  ...(await importOriginal()),
  listRaces: vi.fn(),
  listClasses: vi.fn(),
}));
vi.mock(import('../../services/api'), async (importOriginal) => (await import('../../test/mocks')).mockApiModule(await importOriginal()));

const CAMPAIGN_ID = 7;
const visualOf = (r: SRDRace) => resolveRaceVisual(r.name, r.size);
const ELF_VISUAL = visualOf(ELF_2024);
const ELF_DEFAULT = defaultAppearance(ELF_VISUAL);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRaces).mockResolvedValue({ data: RACES_EXTRA });
  vi.mocked(listClasses).mockResolvedValue({ data: CLASSES });
  vi.mocked(api.get).mockResolvedValue({ data: { current: null } } as never);
  vi.mocked(characterApi.create).mockResolvedValue({ data: { id: 99, warnings: [] } } as never);
});
afterEach(() => vi.unstubAllGlobals());

const renderCreator = () => renderRoute(<CreateCharacterPage />, {
  path: '/campaign/:campaignId/character/new',
  url: `/campaign/${CAMPAIGN_ID}/character/new`,
});

const region = (name: string) => screen.getByRole('region', { name });
const actionBar = () => screen.getByRole('navigation', { name: 'Acciones del creador' });
const panelRow = (label: string) => within(region('Personalización')).getByRole('group', { name: label });
const raceTile = (base: string) => within(region('Razas')).getByRole('button', { name: base });

async function clickPrimary(user: UserEvent, name: string) {
  const button = within(actionBar()).getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

async function pickRace(user: UserEvent, base: string) {
  const razas = await screen.findByRole('region', { name: 'Razas' });
  await user.click(await within(razas).findByRole('button', { name: base }));
}

async function pickClass(user: UserEvent, base = 'Wizard') {
  await user.click(await within(region('Clases')).findByRole('button', { name: base }));
}

async function toCustomize(user: UserEvent) {
  await clickPrimary(user, 'Personalizar');
  return screen.findByRole('region', { name: 'Personalización' });
}

/** Index of the value shown in a ◀ value ▶ row: exactly one of `names` must be visible as its own text. */
function shownIndex(row: HTMLElement, names: readonly string[]) {
  const shown = names.flatMap((n, i) => (within(row).queryAllByText(n).length ? [i] : []));
  expect(shown, `la fila debe mostrar exactamente uno de: ${names.join(', ')}`).toHaveLength(1);
  return shown[0];
}

/** Opens the swatch grid of a colour row and returns its listbox. */
async function openSwatches(user: UserEvent, label: string) {
  await user.click(within(panelRow(label)).getByRole('button', { name: `${label}: elegir color` }));
  return screen.findByRole('listbox');
}

/** Index of the selected swatch (aria-selected), −1 when none (custom colour). */
const selectedIndex = (listbox: HTMLElement) =>
  within(listbox).getAllByRole('option').findIndex((o) => o.getAttribute('aria-selected') === 'true');

/** From Personalización to the end of the wizard; returns the appearance sent to characterApi.create. */
async function createAndReadAppearance(user: UserEvent): Promise<Appearance> {
  await clickPrimary(user, 'Siguiente');
  await clickPrimary(user, 'Siguiente');
  await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Lyra');
  await clickPrimary(user, 'Crear personaje');
  await waitFor(() => expect(characterApi.create).toHaveBeenCalledTimes(1));
  return vi.mocked(characterApi.create).mock.calls[0][0].appearance as Appearance;
}

// ── Canvas sensor (F5, F6) ─────────────────────────────────────────────────────────────────────────
// jsdom has no 2D backend (setup.ts returns null, so PixelAvatar skips drawing). These tests give every
// canvas a recording context: drawImage counts draws per canvas and keeps the last source (the cached
// sprite canvas from avatarCanvas, one per look). ImageData is stubbed for avatarCanvas' putImageData.

class FakeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

function recordCanvases() {
  const draws = new Map<HTMLCanvasElement, { n: number; last: unknown }>();
  vi.stubGlobal('ImageData', FakeImageData);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      imageSmoothingEnabled: true,
      clearRect: () => {},
      putImageData: () => {},
      drawImage: (src: unknown) => {
        const d = draws.get(this) ?? { n: 0, last: null };
        draws.set(this, { n: d.n + 1, last: src });
      },
    } as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext']);
  const created = vi.spyOn(document, 'createElement');
  return {
    count: (c: Element) => draws.get(c as HTMLCanvasElement)?.n ?? 0,
    last: (c: Element) => draws.get(c as HTMLCanvasElement)?.last ?? null,
    canvasesCreated: () => created.mock.calls.filter(([tag]) => String(tag).toLowerCase() === 'canvas').length,
  };
}

const canvasLabel = (c: Element) => (c.closest('button')?.textContent?.trim() || 'canvas sin botón');

describe('CreateCharacterPage · correcciones (T-6)', () => {
  it.each([
    ['Tabaxi', TABAXI],
    ['Dragonborn', DRAGONBORN],
  ] as const)('F1 %s → Elf: Peinado vuelve al de la familia (no "Calvo") y el color de pelo es de HAIR, no el acento anterior', async (base, hairless) => {
    const accent = defaultAppearance(visualOf(hairless)).hairColor;
    expect(visualOf(hairless).hair, `fixture: ${base} es de una familia sin pelo`).toBe(false);
    expect(ELF_VISUAL.hair, 'fixture: el elfo usa peinados').toBe(true);

    const { user } = renderCreator();
    await pickRace(user, base);
    await pickRace(user, 'Elf');
    await pickClass(user);
    await toCustomize(user);

    const hair = shownIndex(panelRow('Peinado'), HAIR_STYLES);
    expect(HAIR_STYLES[hair], 'Peinado tras volver a una familia con pelo').not.toBe('Calvo');
    expect(HAIR_STYLES[hair], 'el peinado por defecto de la familia nueva').toBe(HAIR_STYLES[ELF_DEFAULT.hair]);

    const swatch = selectedIndex(await openSwatches(user, 'Color de pelo'));
    expect(swatch, 'el color de pelo es una muestra de HAIR').toBeGreaterThanOrEqual(0);
    const color = HAIR[swatch];
    // Con Tabaxi el acento coincide con el color de pelo por defecto (HAIR[2]): ahí solo cabe exigir HAIR.
    if (accent !== ELF_DEFAULT.hairColor) expect(color, `no se queda con el acento de ${base}`).not.toBe(accent);

    const sent = await createAndReadAppearance(user);
    expect(sent.hair, 'characterApi.create recibe ese peinado').toBe(hair);
    expect(sent.hairColor, 'characterApi.create recibe ese color de pelo').toBe(color);
  });

  it('F2 Elf → Drow: el color de pelo pasa a defaults.hairColor de la familia', async () => {
    const drowColor = visualOf(DROW).defaults?.hairColor;
    expect(drowColor, 'fixture: Drow fija defaults.hairColor').toBeDefined();
    expect(drowColor).not.toBe(ELF_DEFAULT.hairColor);

    const { user } = renderCreator();
    await pickRace(user, 'Elf');
    await pickRace(user, 'Drow');
    await pickClass(user);
    await toCustomize(user);

    expect(HAIR[selectedIndex(await openSwatches(user, 'Color de pelo'))], 'muestra elegida en Color de pelo').toBe(drowColor);
    expect((await createAndReadAppearance(user)).hairColor).toBe(drowColor);
  });

  it('F2 un color de pelo elegido a mano en la sesión se conserva al pasar a Drow', async () => {
    const drowColor = visualOf(DROW).defaults?.hairColor;
    const manual = HAIR.findIndex((c) => c !== ELF_DEFAULT.hairColor && c !== drowColor);

    const { user } = renderCreator();
    await pickRace(user, 'Elf');
    await pickClass(user);
    await toCustomize(user);
    await user.click(within(await openSwatches(user, 'Color de pelo')).getAllByRole('option')[manual]);
    await user.click(within(actionBar()).getByRole('button', { name: 'Atrás' }));
    await pickRace(user, 'Drow');
    await toCustomize(user);

    expect((await createAndReadAppearance(user)).hairColor, 'el color elegido a mano gana al de la familia').toBe(HAIR[manual]);
  });

  it('F3 raza sin pelo: la fila de color se llama como accentLabel y no hay Peinado ni "Color de pelo"', async () => {
    const accentLabel = visualOf(TABAXI).accentLabel;
    expect(accentLabel, 'fixture: Tabaxi tiene accentLabel').toBeTruthy();

    const { user } = renderCreator();
    await pickRace(user, 'Tabaxi');
    await pickClass(user);
    const panel = await toCustomize(user);

    expect(within(panel).getByRole('group', { name: accentLabel })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: `${accentLabel}: elegir color` })).toBeInTheDocument();
    expect(within(panel).queryByRole('group', { name: 'Color de pelo' })).toBeNull();
    expect(within(panel).queryByRole('group', { name: 'Peinado' })).toBeNull();
  });

  it('F3 "Color de acento" sin accentLabel y sin grupo "Rasgo racial" cuando la raza tiene una sola opción', () => {
    const tabaxi = visualOf(TABAXI);
    const cases: { id: string; visual: RaceVisual; color: string; trait: boolean }[] = [
      { id: 'sin pelo y sin accentLabel', visual: { ...tabaxi, accentLabel: undefined }, color: 'Color de acento', trait: tabaxi.options.length > 1 },
      { id: 'una sola opción', visual: { ...ELF_VISUAL, options: [ELF_VISUAL.options[0]] }, color: 'Color de pelo', trait: false },
      { id: 'dos opciones (control)', visual: { ...ELF_VISUAL, options: ELF_VISUAL.options.slice(0, 2) }, color: 'Color de pelo', trait: true },
    ];
    for (const c of cases) {
      const view = render(<CustomizePanel value={defaultAppearance(c.visual)} visual={c.visual} onChange={vi.fn()} />);
      const panel = within(view.container);
      expect(panel.getByRole('group', { name: c.color }), `${c.id}: fila ${c.color}`).toBeInTheDocument();
      expect(panel.queryAllByRole('group', { name: 'Rasgo racial' }), `${c.id}: grupo Rasgo racial`).toHaveLength(c.trait ? 1 : 0);
      view.unmount();
    }
  });

  it('F4 popover: aria-controls apunta al listbox y cada opción tiene nombre accesible propio', async () => {
    const { user } = renderCreator();
    await pickRace(user, 'Elf');
    await pickClass(user);
    await toCustomize(user);

    const trigger = within(panelRow('Color principal')).getByRole('button', { name: 'Color principal: elegir color' });
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(listbox.id, 'el listbox tiene id').not.toBe('');
    expect(trigger.getAttribute('aria-controls'), 'aria-controls del botón = id del listbox').toBe(listbox.id);

    const options = within(listbox).getAllByRole('option');
    const names = options.map((o) => (o.getAttribute('aria-label') ?? o.textContent ?? '').trim());
    expect(names.filter((n) => !n), 'opciones sin nombre').toEqual([]);
    expect(new Set(names).size, 'nombres distintos').toBe(options.length);
    options.forEach((o, i) => expect(within(listbox).getByRole('option', { name: names[i] })).toBe(o));
  });

  it('F4 teclado: las flechas mueven la opción activa, Enter la elige y Escape cierra devolviendo el foco al botón', async () => {
    const { user } = renderCreator();
    await pickRace(user, 'Elf');
    await pickClass(user);
    await toCustomize(user);

    const trigger = within(panelRow('Color principal')).getByRole('button', { name: 'Color principal: elegir color' });
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    const options = within(listbox).getAllByRole('option');

    /** Active option: roving tabindex (focused option, the only one with tabIndex 0) or aria-activedescendant
        (focus on the listbox, the attribute names the option). Null when neither pattern is coherent. */
    const active = () => {
      const ref = listbox.getAttribute('aria-activedescendant');
      if (ref) return document.activeElement === listbox ? options.findIndex((o) => o.id === ref) : -1;
      const at = options.findIndex((o) => o === document.activeElement);
      const tabbable = options.filter((o) => o.tabIndex === 0);
      return at >= 0 && tabbable.length === 1 && tabbable[0] === options[at] ? at : -1;
    };

    const start = active();
    expect(start, 'al abrir hay una opción activa').toBeGreaterThanOrEqual(0);
    expect(start + 2, 'fixture: hay dos opciones a la derecha').toBeLessThan(options.length);
    await user.keyboard('{ArrowRight}');
    expect(active(), 'ArrowRight').toBe(start + 1);
    await user.keyboard('{ArrowRight}');
    expect(active(), 'ArrowRight ×2').toBe(start + 2);
    await user.keyboard('{ArrowLeft}');
    expect(active(), 'ArrowLeft').toBe(start + 1);

    await user.keyboard('{Enter}');
    const after = screen.queryByRole('listbox') ?? await openSwatches(user, 'Color principal');
    expect(selectedIndex(after), 'Enter elige la opción activa').toBe(start + 1);

    if (!screen.queryByRole('listbox')) await user.click(trigger);
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox'), 'Escape cierra').toBeNull();
    expect(trigger, 'el foco vuelve al botón').toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('F5 RG-1: en Personalización, cambiar el peinado no redibuja los previews de complexión ni las miniaturas ocultas', async () => {
    const sensor = recordCanvases();
    const { user } = renderCreator();
    await pickRace(user, 'Elf');
    await pickClass(user);
    await toCustomize(user);

    const stage = within(region('Escenario')).getByRole('img', { name: /^Retrato de / });
    const hidden = screen.queryByRole('region', { name: 'Razas', hidden: true });
    const hiddenCanvases = hidden ? [...hidden.querySelectorAll('canvas')] : [];
    const visible = [...document.querySelectorAll('canvas')].filter((c) => !hiddenCanvases.includes(c));
    const before = new Map<Element, number>([...hiddenCanvases, ...visible].map((c) => [c, sensor.count(c)]));
    const created = sensor.canvasesCreated();

    await user.click(within(panelRow('Peinado')).getByRole('button', { name: 'Peinado: siguiente' }));

    expect(sensor.count(stage), 'sensor: el avatar del escenario se redibuja').toBeGreaterThan(before.get(stage) ?? 0);
    const redrawn = hiddenCanvases.filter((c) => sensor.count(c) > (before.get(c) ?? 0)).map(canvasLabel);
    expect(redrawn, 'canvases del panel de razas (oculto) redibujados').toEqual([]);
    const visibleRedrawn = visible.filter((c) => sensor.count(c) > (before.get(c) ?? 0)).length;
    expect(sensor.canvasesCreated() - created, `canvases creados (≤ los ${visibleRedrawn} visibles redibujados: escenario y ficha)`).toBeLessThanOrEqual(visibleRedrawn);
  });

  describe('F6 RacePanel (sobrevivientes de mutación, E-0012)', () => {
    it('cada miniatura de raza tiene su retrato y solo las razas con varias entradas muestran el distintivo de versiones', async () => {
      renderCreator();
      await screen.findByRole('region', { name: 'Razas' });
      await within(region('Razas')).findByRole('button', { name: 'Elf' });
      for (const base of ['Human', 'Elf', 'Dwarf', 'Tiefling', 'Dragonborn', 'Drow', 'Tabaxi']) {
        expect(raceTile(base).querySelector('canvas'), `${base}: retrato en la miniatura`).not.toBeNull();
      }
      const badge = within(raceTile('Elf')).getByTitle('2 versiones');
      expect(badge).toHaveTextContent('2');
      for (const base of ['Human', 'Dwarf', 'Tabaxi']) expect(within(raceTile(base)).queryByTitle(/versiones/), `${base}: sin distintivo`).toBeNull();
    });

    it('orden: primero las razas comunes en el orden de COMMON_RACES, luego el resto alfabético', async () => {
      renderCreator();
      await screen.findByRole('region', { name: 'Razas' });
      await within(region('Razas')).findByRole('button', { name: 'Tabaxi' });
      const tiles = within(region('Razas')).getAllByRole('button', { pressed: false }).map((b) => b.textContent?.replace(/\d+$/, '').trim());
      const order = ['Human', 'Elf', 'Dwarf', 'Tiefling', 'Dragonborn', 'Drow', 'Tabaxi'];
      expect(tiles.filter((t) => order.includes(t ?? ''))).toEqual(order);
    });

    it('carga: mientras llegan las razas hay un estado de carga y no el mensaje "Sin resultados"', async () => {
      let resolve: (v: { data: SRDRace[] }) => void = () => {};
      vi.mocked(listRaces).mockReturnValue(new Promise((r) => { resolve = r; }) as never);
      renderCreator();
      const razas = await screen.findByRole('region', { name: 'Razas' });
      expect(within(razas).getByRole('status')).toBeInTheDocument();
      expect(within(razas).queryByText(/Sin resultados/)).toBeNull();
      resolve({ data: RACES_EXTRA });
      expect(await within(razas).findByRole('button', { name: 'Elf' })).toBeInTheDocument();
      expect(within(razas).queryByRole('status')).toBeNull();
    });

    it('búsqueda: filtra las miniaturas y sin coincidencias muestra "Sin resultados"', async () => {
      const { user } = renderCreator();
      const razas = await screen.findByRole('region', { name: 'Razas' });
      await within(razas).findByRole('button', { name: 'Human' });
      const search = within(razas).getByLabelText('Buscar raza');

      await user.type(search, 'elf');
      expect(within(razas).getByRole('button', { name: 'Elf' })).toBeInTheDocument();
      for (const base of ['Human', 'Dwarf', 'Tabaxi']) expect(within(razas).queryByRole('button', { name: base }), `${base} filtrada`).toBeNull();
      expect(within(razas).queryByText(/Sin resultados/)).toBeNull();

      await user.clear(search);
      await user.type(search, 'zzz');
      expect(within(razas).queryByRole('button', { name: 'Elf' })).toBeNull();
      expect(within(razas).getByText(/Sin resultados/)).toBeInTheDocument();

      await user.clear(search);
      expect(within(razas).getByRole('button', { name: 'Tabaxi' })).toBeInTheDocument();
      expect(within(razas).queryByText(/Sin resultados/)).toBeNull();
    });

    it('versión: el select cambia la entrada y la ficha de la raza muestra sus rasgos', async () => {
      const { user } = renderCreator();
      await pickRace(user, 'Elf');
      const select = within(region('Razas')).getByRole('combobox', { name: /versi[oó]n|libro/i }) as HTMLSelectElement;
      const target = select.value === String(ELF_PHB.id) ? ELF_2024 : ELF_PHB;
      const other = target === ELF_PHB ? ELF_2024 : ELF_PHB;
      await user.selectOptions(select, String(target.id));
      // Each trait is rendered as "<b>Name.</b> description".
      expect(within(region('Razas')).getByText(`${target.traits[0].name}.`)).toBeInTheDocument();
      expect(within(region('Razas')).queryByText(`${other.traits[0].name}.`)).toBeNull();
    });

    it('complexión: el toggle redibuja las miniaturas con la otra complexión', async () => {
      const sensor = recordCanvases();
      const { user } = renderCreator();
      await screen.findByRole('region', { name: 'Razas' });
      await within(region('Razas')).findByRole('button', { name: 'Tabaxi' });
      const bases = ['Human', 'Elf', 'Dwarf', 'Tabaxi'];
      const portraits = bases.map((b) => raceTile(b).querySelector('canvas') as HTMLCanvasElement);
      const before = portraits.map((c) => sensor.last(c));
      expect(before.every(Boolean), 'sensor: cada miniatura se dibujó').toBe(true);

      await user.click(within(within(region('Razas')).getByRole('group', { name: 'Tipo de cuerpo' })).getByRole('button', { name: 'Complexión esbelta' }));
      const same = bases.filter((_, i) => sensor.last(raceTile(bases[i]).querySelector('canvas') as HTMLCanvasElement) === before[i]);
      expect(same, 'miniaturas que siguen con la complexión anterior').toEqual([]);
    });

    it('raza activa al volver a Origen: sigue pulsada y su ficha a la vista', async () => {
      const { user } = renderCreator();
      await pickRace(user, 'Elf');
      await pickClass(user);
      await toCustomize(user);
      await user.click(within(actionBar()).getByRole('button', { name: 'Atrás' }));

      const razas = await screen.findByRole('region', { name: 'Razas' });
      expect(within(razas).getByRole('button', { name: 'Elf' })).toHaveAttribute('aria-pressed', 'true');
      for (const base of ['Human', 'Drow', 'Tabaxi']) expect(within(razas).getByRole('button', { name: base })).toHaveAttribute('aria-pressed', 'false');
      expect(within(razas).getByRole('heading', { name: 'Elf' })).toBeInTheDocument();
    });
  });
});
