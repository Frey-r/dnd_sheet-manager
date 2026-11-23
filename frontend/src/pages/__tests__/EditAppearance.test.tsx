/* T-5 · W10: the appearance editor reuses the customization screen (contratos/T-5-creador-wow.md). */
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditAppearancePage } from '../EditAppearance';
import { characterApi } from '../../services/api';
import { CLOTH, EYES, HAIR, HAIR_STYLES, resolveRaceVisual, skinsFor, type Appearance } from '../../lib/avatar';
import { ELF_PHB, WIZARD } from '../../test/catalog';
import { renderRoute } from '../../test/render';

vi.mock(import('../../services/api'), async (importOriginal) => (await import('../../test/mocks')).mockApiModule(await importOriginal()));

const ELF_VISUAL = resolveRaceVisual(ELF_PHB.name);
// A stored look that is valid for the elf, so loading it does not change it.
const STORED: Appearance = {
  v: 1, body: 1, skin: skinsFor(ELF_VISUAL)[1], eyes: EYES[1], hair: 3, hairColor: HAIR[3],
  outfit: 2, outfitColors: [CLOTH[1], CLOTH[3]], feature: 1,
};
const CHARACTER = { id: 42, campaign_id: 7, name: 'Lyra', race: ELF_PHB.name, class: WIZARD.name, level: 1, appearance: JSON.stringify(STORED) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(characterApi.get).mockResolvedValue({ data: CHARACTER } as never);
  vi.mocked(characterApi.updateAppearance).mockResolvedValue({ data: { ok: true } } as never);
});

describe('EditAppearancePage · pantalla de personalización (T-5)', () => {
  it('W10 editor de apariencia: Personalización, escenario y ficha; "Guardar apariencia" envía el borrador', async () => {
    const { user } = renderRoute(<EditAppearancePage />, {
      path: '/campaign/:campaignId/character/:characterId/appearance',
      url: `/campaign/${CHARACTER.campaign_id}/character/${CHARACTER.id}/appearance`,
    });

    const panel = await screen.findByRole('region', { name: 'Personalización' });
    expect(within(screen.getByRole('region', { name: 'Escenario' })).getByRole('img', { name: /^Retrato de / })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /ficha/i })).toBeInTheDocument();

    const hairRow = within(panel).getByRole('group', { name: 'Peinado' });
    expect(within(hairRow).getByText(HAIR_STYLES[STORED.hair])).toBeInTheDocument();
    await user.click(within(hairRow).getByRole('button', { name: 'Peinado: siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Guardar apariencia' }));

    await waitFor(() => expect(characterApi.updateAppearance).toHaveBeenCalledTimes(1));
    const [id, draft] = vi.mocked(characterApi.updateAppearance).mock.calls[0];
    expect(String(id)).toBe(String(CHARACTER.id));
    expect(draft).toEqual({ ...STORED, hair: STORED.hair + 1 });
  });
});
