/* Change a character's pixel-art avatar after creation (character-appearance.md). */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi } from '../services/api';
import { getApiError } from '../services/errors';
import type { Character } from '../types';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { PixelAvatar } from '../components/avatar/PixelAvatar';
import { AppearanceEditor } from '../components/character/creator/AppearanceEditor';
import { normalizeAppearance, parseStoredAppearance, resolveRaceVisual, splitSource, type Appearance } from '../lib/avatar';

export function EditAppearancePage() {
  const { characterId = '' } = useParams<{ campaignId: string; characterId: string }>();
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((r) => r.data as Character) });
  if (character.isLoading) return <LoadingState label="Cargando personaje…" />;
  if (character.error || !character.data) return <ErrorState message="Personaje no encontrado" />;
  return <AppearanceForm key={character.data.id} character={character.data} />;
}

function AppearanceForm({ character: c }: { character: Character }) {
  const { campaignId = '', characterId = '' } = useParams<{ campaignId: string; characterId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const visual = useMemo(() => resolveRaceVisual(c.race), [c.race]);
  const [draft, setDraft] = useState<Appearance>(() => normalizeAppearance(parseStoredAppearance(c.appearance), visual));

  const save = useMutation({
    mutationFn: (a: Appearance) => characterApi.updateAppearance(characterId, a),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['character', characterId] });
      void qc.invalidateQueries({ queryKey: ['characters', String(campaignId)] });
      navigate(`/campaign/${campaignId}/character/${characterId}`);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-headline-lg">Apariencia de {c.name}</h1>
        <p className="mt-1 text-muted">{splitSource(c.race).base} · {splitSource(c.class).base}. La raza y la clase no cambian aquí.</p>
      </div>
      {save.error && <ErrorState message={getApiError(save.error, 'No se pudo guardar la apariencia')} />}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <section className="avatar-stage order-first flex flex-col items-center gap-3 rounded-2xl border border-line px-6 pb-5 pt-6 lg:sticky lg:top-20 lg:order-none lg:col-start-2">
          <PixelAvatar appearance={draft} race={c.race} klass={c.class} pulse scale={6} className="max-w-full" />
          <div className="font-display text-[20px]">{c.name}</div>
        </section>
        <div className="mc-card flex flex-col gap-4 p-5 lg:col-start-1 lg:row-start-1">
          <AppearanceEditor value={draft} visual={visual} onChange={setDraft} />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Link to={`/campaign/${campaignId}/character/${characterId}`} className="mc-btn h-10 px-4">Cancelar</Link>
            <button type="button" onClick={() => save.mutate(draft)} disabled={save.isPending} className="mc-btn mc-btn-primary h-10 px-4">{save.isPending ? 'Guardando…' : 'Guardar apariencia'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
