/* T-11 · El tono de piel personalizado se respeta al dibujar (contratos/T-11-tono-personalizado.md, P1–P5; D-0034).
   Sensor: `avatarCanvas` y `drawAvatarInto` (lib/avatar/render) se sustituyen por espías: avatarCanvas devuelve un
   objeto con la apariencia que recibió y cada canvas recibe un contexto 2D que registra lo último dibujado. Así se lee
   la piel con la que se pinta cada retrato sin backend de canvas en jsdom. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCharacterPage } from '../CreateCharacter';
import { EditAppearancePage } from '../EditAppearance';
import { PixelAvatar } from '../../components/avatar/PixelAvatar';
import { TableCanvas } from '../../components/vtt/TableCanvas';
import { api, characterApi } from '../../services/api';
import { listClasses, listRaces } from '../../services/srdService';
import type { VTTScene, VTTToken } from '../../services/vttApi';
import { CLOTH, EYES, HAIR, defaultAppearance, resolveRaceVisual, skinsFor, type Appearance } from '../../lib/avatar';
import { avatarCanvas, drawAvatarInto } from '../../lib/avatar/render';
import { CLASSES, DWARF, ELF_2024, ELF_PHB, RACES, WIZARD } from '../../test/catalog';
import { renderRoute } from '../../test/render';
import type { SRDRace } from '../../types/srd';

vi.mock(import('../../services/srdService'), async (importOriginal) => ({
  ...(await importOriginal()),
  listRaces: vi.fn(),
  listClasses: vi.fn(),
}));
vi.mock(import('../../services/api'), async (importOriginal) => (await import('../../test/mocks')).mockApiModule(await importOriginal()));
vi.mock(import('../../lib/avatar/render'), async (importOriginal) => ({
  ...(await importOriginal()),
  avatarCanvas: vi.fn(),
  drawAvatarInto: vi.fn(),
}));

const CAMPAIGN_ID = 7;
/** Piel personalizada: hex válido que no está en ninguna paleta de raza usada aquí. */
const CUSTOM = '#3a9d5c';
const visualOf = (r: SRDRace) => resolveRaceVisual(r.name, r.size);
const HUMAN_VISUAL = resolveRaceVisual('Human');
const ELF_VISUAL = visualOf(ELF_2024);
const DWARF_VISUAL = visualOf(DWARF);

// ── Sensor de dibujo ────────────────────────────────────────────────────────────────────────────

interface Drawn { look?: Appearance }
const lastDrawn = new Map<HTMLCanvasElement, Drawn>();
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

/** Contexto 2D de mentira: drawImage guarda la fuente por canvas; el resto de métodos no hace nada. */
function contextFor(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  let ctx = contexts.get(canvas);
  if (!ctx) {
    const state: Record<string | symbol, unknown> = {
      drawImage: (src: Drawn) => { lastDrawn.set(canvas, src); },
      measureText: () => ({ width: 0 }),
    };
    ctx = new Proxy(state, {
      get: (t, k) => (k in t ? t[k] : (t[k] = () => {})),
      set: (t, k, v) => { t[k] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    contexts.set(canvas, ctx);
  }
  return ctx;
}

/** Apariencia con la que se pintó por última vez el canvas (vía avatarCanvas). */
const drawnLook = (canvas: Element) => lastDrawn.get(canvas as HTMLCanvasElement)?.look;

/** jsdom no tiene ImageData (los emblemas de clase hacen putImageData sobre su canvas en caché). */
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

beforeEach(() => {
  vi.clearAllMocks();
  lastDrawn.clear();
  vi.stubGlobal('ImageData', FakeImageData);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.mocked(avatarCanvas).mockImplementation((a) => ({ look: a }) as unknown as HTMLCanvasElement);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return contextFor(this);
  } as unknown as HTMLCanvasElement['getContext']);
  vi.mocked(listRaces).mockResolvedValue({ data: RACES });
  vi.mocked(listClasses).mockResolvedValue({ data: CLASSES });
  vi.mocked(api.get).mockResolvedValue({ data: { current: null } } as never);
  vi.mocked(characterApi.create).mockResolvedValue({ data: { id: 99, warnings: [] } } as never);
  vi.mocked(characterApi.updateAppearance).mockResolvedValue({ data: { ok: true } } as never);
});
afterEach(() => vi.unstubAllGlobals());

// ── Creador ─────────────────────────────────────────────────────────────────────────────────────

const renderCreator = () => renderRoute(<CreateCharacterPage />, {
  path: '/campaign/:campaignId/character/new',
  url: `/campaign/${CAMPAIGN_ID}/character/new`,
});

const region = (name: string) => screen.getByRole('region', { name });
const actionBar = () => screen.getByRole('navigation', { name: /^Acciones del (creador|editor)$/ });
const stageAvatar = () => within(region('Escenario')).getByRole('img', { name: /^Retrato de / });
const skinRow = () => within(region('Personalización')).getByRole('group', { name: 'Piel' });

async function clickPrimary(user: UserEvent, name: string) {
  const button = within(actionBar()).getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

async function pickRace(user: UserEvent, base: string) {
  const razas = await screen.findByRole('region', { name: 'Razas' });
  await user.click(await within(razas).findByRole('button', { name: base }));
}

async function toCustomize(user: UserEvent) {
  await clickPrimary(user, 'Personalizar');
  return screen.findByRole('region', { name: 'Personalización' });
}

/** Abre el popover "Piel: elegir color" y escribe el hex en su input type="color". */
async function chooseCustomSkin(user: UserEvent, hex: string) {
  await user.click(within(skinRow()).getByRole('button', { name: 'Piel: elegir color' }));
  const input = within(skinRow()).getByLabelText('Piel: color personalizado') as HTMLInputElement;
  expect(input.type, 'el selector personalizado es un input type="color"').toBe('color');
  fireEvent.change(input, { target: { value: hex } });
}

async function createAndReadAppearance(user: UserEvent): Promise<Appearance> {
  await clickPrimary(user, 'Siguiente');
  await clickPrimary(user, 'Siguiente');
  await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Lyra');
  await clickPrimary(user, 'Crear personaje');
  await waitFor(() => expect(characterApi.create).toHaveBeenCalledTimes(1));
  return vi.mocked(characterApi.create).mock.calls[0][0].appearance as Appearance;
}

describe('Tono de piel personalizado (T-11)', () => {
  it('fixture: la piel personalizada no está en la paleta de Human, Elf ni Dwarf, y Elf y Dwarf son familias distintas', () => {
    for (const v of [HUMAN_VISUAL, ELF_VISUAL, DWARF_VISUAL]) expect(skinsFor(v), v.key).not.toContain(CUSTOM);
    expect(ELF_VISUAL.key).not.toBe(DWARF_VISUAL.key);
  });

  it('P1 dibujo: PixelAvatar con una piel fuera de la paleta de la raza la entrega tal cual a avatarCanvas', () => {
    const stored: Appearance = { ...defaultAppearance(HUMAN_VISUAL), skin: CUSTOM };
    for (const [form, appearance] of [['objeto', stored], ['JSON guardado', JSON.stringify(stored)]] as const) {
      vi.mocked(avatarCanvas).mockClear();
      const view = render(<PixelAvatar appearance={appearance} race="Human" klass="Fighter" />);
      expect(avatarCanvas, `${form}: sensor, PixelAvatar dibuja`).toHaveBeenCalled();
      const [drawn] = vi.mocked(avatarCanvas).mock.calls.at(-1)!;
      expect(drawn.skin, `${form}: piel que recibe avatarCanvas`).toBe(CUSTOM);
      expect(drawn, `${form}: el resto de la apariencia no cambia`).toEqual(stored);
      view.unmount();
    }
  });

  it('P2 creador: un color personalizado en "Piel" cambia el escenario y characterApi.create lo recibe', async () => {
    const { user } = renderCreator();
    await pickRace(user, 'Elf');
    await user.click(await within(region('Clases')).findByRole('button', { name: 'Wizard' }));
    await toCustomize(user);

    await chooseCustomSkin(user, CUSTOM);
    expect(within(skinRow()).getByText('Personalizado'), 'la fila Piel marca el color personalizado').toBeInTheDocument();
    expect(drawnLook(stageAvatar()), 'sensor: el escenario se dibujó').toBeDefined();
    expect.soft(drawnLook(stageAvatar())?.skin, 'piel con la que se dibuja el escenario').toBe(CUSTOM);

    expect((await createAndReadAppearance(user)).skin, 'piel que recibe characterApi.create').toBe(CUSTOM);
  });

  it('P3 editor: EditAppearancePage muestra y guarda la piel personalizada guardada sin reemplazarla', async () => {
    const stored: Appearance = {
      v: 1, body: 1, skin: CUSTOM, eyes: EYES[1], hair: 3, hairColor: HAIR[3],
      outfit: 2, outfitColors: [CLOTH[1], CLOTH[3]], feature: 1,
    };
    const character = { id: 42, campaign_id: CAMPAIGN_ID, name: 'Lyra', race: ELF_PHB.name, class: WIZARD.name, level: 1, appearance: JSON.stringify(stored) };
    vi.mocked(characterApi.get).mockResolvedValue({ data: character } as never);
    const { user } = renderRoute(<EditAppearancePage />, {
      path: '/campaign/:campaignId/character/:characterId/appearance',
      url: `/campaign/${CAMPAIGN_ID}/character/${character.id}/appearance`,
    });

    await screen.findByRole('region', { name: 'Personalización' });
    expect.soft(within(skinRow()).queryByText('Personalizado'), 'la fila Piel muestra "Personalizado"').not.toBeNull();
    expect.soft(drawnLook(stageAvatar())?.skin, 'piel con la que se dibuja el escenario').toBe(CUSTOM);

    await user.click(within(actionBar()).getByRole('button', { name: 'Guardar apariencia' }));
    await waitFor(() => expect(characterApi.updateAppearance).toHaveBeenCalledTimes(1));
    const [, draft] = vi.mocked(characterApi.updateAppearance).mock.calls[0];
    expect(draft, 'se guarda la apariencia tal cual, con la piel personalizada').toEqual(stored);
  });

  it('P4 cambio de raza: Elf con piel personalizada → Dwarf vuelve a la piel por defecto de la familia nueva', async () => {
    const dwarfSkin = defaultAppearance(DWARF_VISUAL).skin;
    const { user } = renderCreator();
    await pickRace(user, 'Elf');
    await user.click(await within(region('Clases')).findByRole('button', { name: 'Wizard' }));
    await toCustomize(user);
    await chooseCustomSkin(user, CUSTOM);
    expect(within(skinRow()).getByText('Personalizado'), 'precondición: la piel personalizada quedó elegida').toBeInTheDocument();

    await user.click(within(actionBar()).getByRole('button', { name: 'Atrás' }));
    await pickRace(user, 'Dwarf');
    await toCustomize(user);

    const tone = skinsFor(DWARF_VISUAL).indexOf(dwarfSkin);
    expect(tone, 'fixture: la piel por defecto del enano está en su paleta').toBeGreaterThanOrEqual(0);
    expect(within(skinRow()).getByText(`Tono ${tone + 1}`), 'la fila Piel muestra el tono por defecto del enano').toBeInTheDocument();
    expect((await createAndReadAppearance(user)).skin, 'piel que recibe characterApi.create').toBe(dwarfSkin);
  });

  it('P5 VTT: el token de TableCanvas vinculado a un personaje dibuja su piel personalizada', () => {
    const appearance: Appearance = { ...defaultAppearance(HUMAN_VISUAL), skin: CUSTOM };
    const scene = {
      id: 1, campaign_id: CAMPAIGN_ID, name: 'Mesa', map_url: '', width_px: 800, height_px: 600, grid_size_px: 50,
      grid_offset_x: 0, grid_offset_y: 0, feet_per_cell: 5, ambient_light: 'bright', fog_enabled: false,
      walls: [], lights: [], mode: 'exploration', exploration_pace: 0, zones: [], is_active: true,
    } as VTTScene;
    const token = {
      id: 5, scene_id: 1, name: 'Lyra', kind: 'pc', character_id: 42, owner_user_id: 3, image_url: '', color: '#c0392b',
      x: 100, y: 100, size_cells: 1, hp: 10, max_hp: 10, ac: 12, hidden: false,
    } as VTTToken;
    render(
      <TableCanvas
        scene={scene} tokens={[token]} isGM userId={3} viewers={null} tool="select" selectedId={null}
        onSelect={vi.fn()} onMove={vi.fn()} onWalls={vi.fn()} onLights={vi.fn()}
        characters={[{ id: 42, race: 'Human', class: 'Fighter', appearance: JSON.stringify(appearance) }]}
      />,
    );
    expect(drawAvatarInto, 'sensor: el token vinculado se dibuja con su avatar').toHaveBeenCalled();
    const [, drawn] = vi.mocked(drawAvatarInto).mock.calls.at(-1)!;
    expect(drawn.skin, 'piel con la que se dibuja el token').toBe(CUSTOM);
  });
});
