/* Change a character's pixel-art avatar after creation (character-appearance.md): the creator's
   Personalización screen (stage, customization panel and token preview) with save in the bar. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { characterApi } from '../services/api';
import { getApiError } from '../services/errors';
import type { Character } from '../types';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { ActionBar } from '../components/character/creator/ActionBar';
import { CreatorStage } from '../components/character/creator/CreatorStage';
import { CustomizePanel } from '../components/character/creator/CustomizePanel';
import { TokenPreview } from '../components/character/creator/TokenPreview';
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
  const caption = `${splitSource(c.race).base} · ${splitSource(c.class).base}`;
  const sheet = `/campaign/${campaignId}/character/${characterId}`;

  const save = useMutation({
    mutationFn: (a: Appearance) => characterApi.updateAppearance(characterId, a),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['character', characterId] });
      void qc.invalidateQueries({ queryKey: ['characters', String(campaignId)] });
      navigate(sheet);
    },
  });

  return (
    <div className="cc" data-step="custom">
      <h1 className="sr-only">Apariencia de {c.name}</h1>
      {save.error && <ErrorState message={getApiError(save.error, 'No se pudo guardar la apariencia')} />}
      <div className="cc-layout">
        <CreatorStage eyebrow={c.name} caption={caption} appearance={draft} race={c.race} klass={c.class} />
        <div className="cc-side cc-side--start">
          <CustomizePanel value={draft} visual={visual} onChange={setDraft} />
        </div>
        <div className="cc-side cc-side--end">
          <TokenPreview appearance={draft} race={c.race} klass={c.class} name={c.name} meta={`${caption} · Nivel ${c.level}`} />
        </div>
      </div>
      <ActionBar
        label="Acciones del editor"
        start={<Link to={sheet} className="mc-btn cc-back"><ChevronLeft size={16} aria-hidden /><span className="cc-back__text">Cancelar</span></Link>}
        center={<p className="cc-bar__hint">La raza y la clase no cambian aquí.</p>}
        end={(
          <button type="button" onClick={() => save.mutate(draft)} disabled={save.isPending} className="mc-btn mc-btn-primary cc-primary">
            {save.isPending ? 'Guardando…' : 'Guardar apariencia'}
          </button>
        )}
      />
    </div>
  );
}
