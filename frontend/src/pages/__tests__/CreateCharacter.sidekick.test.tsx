/* T-12 · K2 Sin clases sidekick en el creador de jugadores (contratos/T-12-sin-sidekicks-jugadores.md,
   character-appearance.md § Sidekick classes, D-0040). El catálogo trae las tres clases sidekick de Tasha's,
   Warrior Sidekick con y sin libro: la región "Clases" no muestra ninguna y su contador no las cuenta. */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCharacterPage } from '../CreateCharacter';
import { api, characterApi } from '../../services/api';
import { listClasses, listRaces } from '../../services/srdService';
import { RACES } from '../../test/catalog';
import { CLASSES_WITH_SIDEKICKS } from '../../test/catalog-npc';
import { renderRoute } from '../../test/render';

vi.mock(import('../../services/srdService'), async (importOriginal) => ({
  ...(await importOriginal()),
  listRaces: vi.fn(),
  listClasses: vi.fn(),
}));
vi.mock(import('../../services/api'), async (importOriginal) => (await import('../../test/mocks')).mockApiModule(await importOriginal()));

const PLAYER_CLASSES = ['Wizard', 'Fighter', 'Rogue'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRaces).mockResolvedValue({ data: RACES });
  vi.mocked(listClasses).mockResolvedValue({ data: CLASSES_WITH_SIDEKICKS });
  vi.mocked(api.get).mockResolvedValue({ data: { current: null } } as never);
  vi.mocked(characterApi.create).mockResolvedValue({ data: { id: 99, warnings: [] } } as never);
});

const renderCreator = () => renderRoute(<CreateCharacterPage />, {
  path: '/campaign/:campaignId/character/new',
  url: '/campaign/7/character/new',
});

/** Header of the "Clases" panel: the heading and the class counter next to it. */
function classesHeader(clases: HTMLElement) {
  const heading = within(clases).getByRole('heading', { name: 'Clases' });
  return heading.closest('header') ?? (heading.parentElement as HTMLElement);
}

describe('CreateCharacterPage · sin clases sidekick (T-12 K2)', () => {
  it('K2 la región "Clases" no ofrece Expert, Spellcaster ni Warrior Sidekick y el resto sigue igual', async () => {
    renderCreator();
    const clases = await screen.findByRole('region', { name: 'Clases' });
    for (const name of PLAYER_CLASSES) {
      expect(await within(clases).findByRole('button', { name }), `${name} sigue en el selector`).toHaveAttribute('aria-pressed', 'false');
    }
    const offered = within(clases).getAllByRole('button').map((b) => b.textContent?.trim() ?? '');
    expect(offered.filter((name) => /sidekick|compa(ñ|n)ero/i.test(name)), 'ninguna ficha de clase sidekick').toEqual([]);
    expect(within(clases).queryByRole('group', { name: 'Compañeros' }), 'el grupo Compañeros es del creador de PNJ').toBeNull();
  });

  it('K2 el contador de clases excluye las sidekick (3 clases de jugador, no 6)', async () => {
    renderCreator();
    const clases = await screen.findByRole('region', { name: 'Clases' });
    await within(clases).findByRole('button', { name: 'Wizard' });
    const header = classesHeader(clases);
    expect(header, 'contador = clases de jugador').toHaveTextContent(/(^|\D)3(\D|$)/);
    expect(header, 'el contador no cuenta las sidekick').not.toHaveTextContent(/(^|\D)[4-7](\D|$)/);
  });
});
