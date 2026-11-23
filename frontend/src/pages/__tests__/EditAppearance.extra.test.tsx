/* EditAppearancePage (T-11 P6, complement to the locked T-5 and T-11 tests): loading, a character that does not
   exist, a failed save that shows the server's reason and stays, a save in flight, a successful save back to the
   sheet, and Cancel. */
import { screen, waitFor, within } from '@testing-library/react';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditAppearancePage } from '../EditAppearance';
import { characterApi } from '../../services/api';
import { CLOTH, EYES, HAIR, resolveRaceVisual, skinsFor, type Appearance } from '../../lib/avatar';
import { ELF_PHB, WIZARD } from '../../test/catalog';
import { renderRoute } from '../../test/render';

vi.mock(import('../../services/api'), async (importOriginal) => (await import('../../test/mocks')).mockApiModule(await importOriginal()));

const ELF_VISUAL = resolveRaceVisual(ELF_PHB.name);
const STORED: Appearance = {
  v: 1, body: 1, skin: skinsFor(ELF_VISUAL)[2], eyes: EYES[1], hair: 3, hairColor: HAIR[3],
  outfit: 2, outfitColors: [CLOTH[1], CLOTH[3]], feature: 1,
};
const CHARACTER = { id: 42, campaign_id: 7, name: 'Lyra', race: ELF_PHB.name, class: WIZARD.name, level: 3, appearance: JSON.stringify(STORED) };
const SHEET = `/campaign/${CHARACTER.campaign_id}/character/${CHARACTER.id}`;
/** The catch-all route of renderRoute: reached when the page navigates away from the editor. */
const AWAY = 'Fuera del creador';

const openEditor = () => renderRoute(<EditAppearancePage />, {
  path: '/campaign/:campaignId/character/:characterId/appearance',
  url: `${SHEET}/appearance`,
});
const saveButton = () => within(screen.getByRole('navigation', { name: 'Acciones del editor' })).getByRole('button', { name: /^(Guardar apariencia|Guardando…)$/ });
const serverError = (message: string) => new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
  data: { error: message }, status: 422, statusText: 'Unprocessable Entity', headers: {}, config: {},
} as AxiosResponse);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(characterApi.get).mockResolvedValue({ data: CHARACTER } as never);
  vi.mocked(characterApi.updateAppearance).mockResolvedValue({ data: { ok: true } } as never);
});

describe('EditAppearancePage · carga, errores y guardado (T-11 P6)', () => {
  it('mientras carga el personaje muestra "Cargando personaje…"', () => {
    vi.mocked(characterApi.get).mockReturnValue(new Promise(() => {}) as never);
    openEditor();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando personaje…');
    expect(screen.queryByRole('region', { name: 'Personalización' })).toBeNull();
  });

  it('si la API falla muestra "Personaje no encontrado" y no el editor', async () => {
    vi.mocked(characterApi.get).mockRejectedValue(new Error('404'));
    openEditor();
    expect(await screen.findByRole('alert')).toHaveTextContent('Personaje no encontrado');
    expect(screen.queryByRole('region', { name: 'Personalización' })).toBeNull();
  });

  it('si la API responde sin personaje muestra "Personaje no encontrado" y no el editor', async () => {
    vi.mocked(characterApi.get).mockResolvedValue({ data: null } as never);
    openEditor();
    expect(await screen.findByRole('alert')).toHaveTextContent('Personaje no encontrado');
    expect(screen.queryByRole('region', { name: 'Personalización' })).toBeNull();
  });

  it('cabecera: nombre del personaje, raza y clase sin el libro y el nivel en la ficha; Cancelar vuelve a la ficha', async () => {
    openEditor();
    await screen.findByRole('region', { name: 'Personalización' });
    expect(screen.getByRole('heading', { name: 'Apariencia de Lyra' })).toBeInTheDocument();
    expect(screen.getByText('Elf · Wizard')).toBeInTheDocument();
    expect(screen.getByText('Elf · Wizard · Nivel 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', SHEET);
  });

  it('sin intentar guardar no hay ningún aviso de error', async () => {
    openEditor();
    await screen.findByRole('region', { name: 'Personalización' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si guardar falla muestra el motivo del servidor y se queda en el editor', async () => {
    vi.mocked(characterApi.updateAppearance).mockRejectedValue(serverError('La apariencia no es válida'));
    const { user } = openEditor();
    await screen.findByRole('region', { name: 'Personalización' });

    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('La apariencia no es válida');
    expect(screen.queryByText(AWAY), 'no navega a la ficha').toBeNull();
    expect(saveButton()).toBeEnabled();
    expect(saveButton()).toHaveTextContent('Guardar apariencia');
  });

  it('si guardar falla sin motivo muestra "No se pudo guardar la apariencia"', async () => {
    vi.mocked(characterApi.updateAppearance).mockRejectedValue(new Error('boom'));
    const { user } = openEditor();
    await screen.findByRole('region', { name: 'Personalización' });

    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la apariencia');
  });

  it('mientras guarda el botón dice "Guardando…" y está deshabilitado', async () => {
    vi.mocked(characterApi.updateAppearance).mockReturnValue(new Promise(() => {}) as never);
    const { user } = openEditor();
    await screen.findByRole('region', { name: 'Personalización' });

    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toHaveTextContent('Guardando…'));
    expect(saveButton()).toBeDisabled();
  });

  it('al guardar invalida el personaje y la lista de la campaña y vuelve a la ficha', async () => {
    const { user, client } = openEditor();
    await screen.findByRole('region', { name: 'Personalización' });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await user.click(saveButton());
    expect(await screen.findByText(AWAY), 'navega fuera del editor').toBeInTheDocument();
    expect(characterApi.updateAppearance).toHaveBeenCalledWith(String(CHARACTER.id), STORED);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['character', String(CHARACTER.id)] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['characters', String(CHARACTER.campaign_id)] });
  });
});
