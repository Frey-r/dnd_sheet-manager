import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi } from '../services/api';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { CharacterTabs } from '../components/character/CharacterTabs';
import type { Character } from '../types';

type Physical = { age: string; height: string; weight: string; eyes: string; skin: string; hair: string };
type Bio = { personality_traits: string; ideals: string; bonds: string; flaws: string; backstory_text: string; notes: string; physical_description: Physical };
const PHYSICAL: [keyof Physical, string][] = [['age', 'Edad'], ['height', 'Altura'], ['weight', 'Peso'], ['eyes', 'Ojos'], ['skin', 'Piel'], ['hair', 'Pelo']];
const toPhysical = (raw: string | undefined): Physical => {
  let parsed: Partial<Physical> = {};
  try { parsed = raw ? (JSON.parse(raw) as Partial<Physical>) : {}; } catch { parsed = {}; }
  return Object.fromEntries(PHYSICAL.map(([key]) => [key, typeof parsed[key] === 'string' ? parsed[key] : ''])) as Physical;
};
/** Changes are saved automatically this long after the last keystroke. */
const AUTOSAVE_MS = 1500;
const LABELS: Record<'personality_traits' | 'ideals' | 'bonds' | 'flaws', string> = { personality_traits: 'Rasgos de personalidad', ideals: 'Ideales', bonds: 'Vínculos', flaws: 'Defectos' };
const toBio = (c: Character): Bio => ({ personality_traits: c.personality_traits || '', ideals: c.ideals || '', bonds: c.bonds || '', flaws: c.flaws || '', backstory_text: c.backstory_text || '', notes: c.notes || '', physical_description: toPhysical(c.physical_description) });
// Long texts grow with their content instead of scrolling inside a small box.
const autoGrow = (element: HTMLTextAreaElement) => { element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px`; };

export function BiographyTab() {
  const { campaignId, characterId = '' } = useParams<{ campaignId: string; characterId: string }>();
  const client = useQueryClient();
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((response) => response.data as Character) });
  // Edits live in `draft` until saved; before that the form shows the server copy.
  const [draft, setDraft] = useState<Bio | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const save = useMutation({
    mutationFn: (value: Bio) => characterApi.update(characterId, value),
    // Keep edits typed while the request was in flight: only clear the draft that was saved.
    onSuccess: (_, value) => { setSavedAt(new Date()); setDraft((current) => (current === value ? null : current)); void client.invalidateQueries({ queryKey: ['character', characterId] }); },
  });
  const { mutate } = save;
  // Autosave: the biography is stored shortly after the player stops typing.
  useEffect(() => {
    if (!draft) return;
    const timer = window.setTimeout(() => mutate(draft), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, mutate]);

  if (character.isLoading) return <LoadingState label="Cargando biografía…" />;
  if (character.error || !character.data) return <div className="p-8"><ErrorState message={getApiError(character.error, 'No se pudo cargar el personaje')} onRetry={() => void character.refetch()} /></div>;
  const data = character.data;
  const bio = draft ?? toBio(data);
  const edit = (patch: Partial<Bio>) => setDraft({ ...bio, ...patch });
  const editPhysical = (key: keyof Physical, value: string) => edit({ physical_description: { ...bio.physical_description, [key]: value } });

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

        <section aria-labelledby="physical-title" className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
          <h2 id="physical-title" className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-3">Rasgos físicos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{PHYSICAL.map(([key, label]) => <label key={key} className="text-sm text-secondary">{label}<input value={bio.physical_description[key]} maxLength={60} onChange={(event) => editPhysical(key, event.target.value)} className="mt-1 w-full rounded bg-surface-subtle border border-border-low-contrast px-2 h-9 text-on-surface" /></label>)}</div>
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
            ref={(element) => { if (element) autoGrow(element); }}
            onChange={(e) => { autoGrow(e.target); edit({ backstory_text: e.target.value }); }}
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
        <p role="status" aria-live="polite" className="text-sm text-secondary text-center">{save.isPending ? 'Guardando…' : draft ? 'Cambios sin guardar; se guardan solos en un momento.' : savedAt ? `Guardado a las ${savedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}.` : 'Los cambios se guardan automáticamente.'}</p>
        <button
          type="button"
          onClick={() => save.mutate(bio)}
          disabled={save.isPending || !draft}
          className="w-full bg-primary-container text-on-primary-container font-label-bold py-3 rounded-lg hover:bg-surface-tint transition-colors shadow-sm disabled:opacity-50"
        >
          {save.isPending ? 'Guardando…' : 'Guardar ahora'}
        </button>
      </main>
    </div>
  );
}
