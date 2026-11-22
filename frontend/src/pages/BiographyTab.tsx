import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { CharacterTabs } from '../components/character/CharacterTabs';
import type { Character } from '../types';

type Bio = { personality_traits: string; ideals: string; bonds: string; flaws: string; backstory_text: string; notes: string };
const LABELS: Record<'personality_traits' | 'ideals' | 'bonds' | 'flaws', string> = { personality_traits: 'Rasgos de personalidad', ideals: 'Ideales', bonds: 'Vínculos', flaws: 'Defectos' };
const toBio = (c: Character): Bio => ({ personality_traits: c.personality_traits || '', ideals: c.ideals || '', bonds: c.bonds || '', flaws: c.flaws || '', backstory_text: c.backstory_text || '', notes: c.notes || '' });

export function BiographyTab() {
  const { campaignId, characterId = '' } = useParams<{ campaignId: string; characterId: string }>();
  const client = useQueryClient();
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((response) => response.data as Character) });
  // Edits live in `draft` until saved; before that the form shows the server copy.
  const [draft, setDraft] = useState<Bio | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: (value: Bio) => characterApi.update(characterId, value),
    onSuccess: () => { setSaved(true); setDraft(null); void client.invalidateQueries({ queryKey: ['character', characterId] }); },
  });

  if (character.isLoading) return <LoadingState label="Cargando biografía…" />;
  if (character.error || !character.data) return <div className="p-8"><ErrorState message={getApiError(character.error, 'No se pudo cargar el personaje')} onRetry={() => void character.refetch()} /></div>;
  const data = character.data;
  const bio = draft ?? toBio(data);
  const edit = (patch: Partial<Bio>) => { setSaved(false); setDraft({ ...bio, ...patch }); };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Biografía</h1>
        </div>
      </header>

      <CharacterTabs campaignId={campaignId} characterId={characterId} active="bio" />

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
            <span className="font-label-sm text-secondary uppercase">Alineamiento</span>
            <div className="font-headline-md text-primary-container mt-1">{data.alignment || 'Sin definir'}</div>
          </div>
          <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
            <span className="font-label-sm text-secondary uppercase">Trasfondo</span>
            <div className="font-headline-md text-on-surface mt-1">{data.background || 'Ninguno'}</div>
          </div>
        </section>

        {(['personality_traits','ideals','bonds','flaws'] as const).map((field) => (
          <div key={field} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 focus-within:border-primary-container transition-colors">
            <label className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-2 block capitalize">{LABELS[field]}</label>
            <textarea
              value={bio[field]}
              onChange={(e) => edit({ [field]: e.target.value })}
              className="w-full bg-transparent border-none resize-none font-body-md text-on-surface outline-none"
              rows={2}
            />
          </div>
        ))}

        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 focus-within:border-primary-container transition-colors">
          <label className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Historia</label>
          <textarea
            value={bio.backstory_text}
            onChange={(e) => edit({ backstory_text: e.target.value })}
            className="w-full bg-transparent border-none resize-none font-body-md text-on-surface outline-none"
            rows={6}
            placeholder="Escribe la historia de tu personaje..."
          />
        </div>

        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 focus-within:border-primary-container transition-colors">
          <label className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Notas</label>
          <textarea
            value={bio.notes}
            onChange={(e) => edit({ notes: e.target.value })}
            className="w-full bg-transparent border-none resize-none font-body-md text-on-surface outline-none"
            rows={4}
            placeholder="Notas adicionales..."
          />
        </div>

        {save.error && <ErrorState message={getApiError(save.error, 'No se pudo guardar la biografía')} />}
        {saved && <p role="status" className="text-success-active text-center">Biografía guardada.</p>}
        <button
          type="button"
          onClick={() => save.mutate(bio)}
          disabled={save.isPending || !draft}
          className="w-full bg-primary-container text-on-primary-container font-label-bold py-3 rounded-lg hover:bg-surface-tint transition-colors shadow-sm disabled:opacity-50"
        >
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </main>
    </div>
  );
}
