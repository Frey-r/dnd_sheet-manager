import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { campaignApi, characterApi } from '../services/api';
import type { CampaignMember, Character } from '../types';
import { PixelAvatar } from '../components/avatar/PixelAvatar';
import { splitSource } from '../lib/avatar';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { useCampaign } from '../lib/useCampaign';

const pct = (c: Character) => (c.max_hp > 0 ? Math.max(0, Math.min(100, (c.current_hp / c.max_hp) * 100)) : 0);
const QUICK_GOLD = [-10, -1, 1, 10, 100];

/** GM-only gold editor: set an exact amount or adjust it with quick buttons. */
function GoldEditor({ character, onSaved }: { character: Character; onSaved: () => Promise<unknown> }) {
  const [draft, setDraft] = useState(String(character.gold));
  const save = useMutation({
    mutationFn: (gold: number) => characterApi.update(character.id, { gold: Math.max(0, Math.round(gold)) }),
    onSuccess: () => onSaved(),
  });
  const parsed = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
  return (
    <div className="mt-3 rounded-lg border border-line bg-card-2 p-2.5">
      <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (valid) save.mutate(parsed); }}>
        <label className="flex items-center gap-2 font-label-sm text-secondary">Oro
          <input type="number" min={0} step={1} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={`Oro de ${character.name}`} className="h-8 w-24 rounded bg-surface-subtle border-border-low-contrast px-2 text-sm" />
        </label>
        <span className="text-xs text-muted">po</span>
        <button type="submit" disabled={!valid || save.isPending || parsed === character.gold} className="mc-btn mc-btn-sm ml-auto">{save.isPending ? 'Guardando…' : 'Fijar'}</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Ajuste rápido de oro de ${character.name}`}>
        {QUICK_GOLD.map((delta) => (
          <button key={delta} type="button" disabled={save.isPending || character.gold + delta < 0} onClick={() => save.mutate(character.gold + delta)} className="mc-btn mc-btn-sm">{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}</button>
        ))}
      </div>
      {save.error && <div className="mt-2"><ErrorState message={getApiError(save.error, 'No se pudo actualizar el oro')} /></div>}
    </div>
  );
}

export function PartyRoster() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const client = useQueryClient();
  const { isGM } = useCampaign(campaignId);
  const { data: members = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['party-roster', campaignId],
    enabled: Boolean(campaignId),
    queryFn: async () => {
      const [m, c] = await Promise.all([
        campaignApi.members(campaignId!),
        characterApi.listByCampaign(campaignId!),
      ]);
      const chars = (c.data ?? []) as Character[];
      return (m.data as CampaignMember[]).map((member) => ({ ...member, character: chars.find((ch) => ch.user_id === member.user_id) }));
    },
  });

  if (loading) return <LoadingState label="Cargando grupo…" />;
  if (error) return <div className="p-8"><ErrorState message={getApiError(error, 'No se pudo cargar el grupo')} onRetry={() => void refetch()} /></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Grupo</h1>
        </div>
        <Link to={`/campaign/${campaignId}/gm`} className="text-primary font-label-bold">Consola del DM</Link>
      </header>

      <main className="flex-1 p-4 md:p-10 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map((m) => (
            <div key={m.user_id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary-container flex items-center justify-center">
                {m.character
                  ? <PixelAvatar appearance={m.character.appearance} race={m.character.race} klass={m.character.class} aura={false} crop="bust" scale={2} />
                  : <span className="material-symbols-outlined text-on-secondary-container">person</span>}
              </div>
              <div className="flex-1">
                <div className="font-label-bold text-on-surface">{m.username || `Jugador ${m.user_id}`}</div>
                <div className="font-label-sm text-on-surface-variant">{m.role === 'gm' ? 'DM' : 'Jugador'}</div>
                {m.character && (
                  <>
                    <div className="font-label-sm text-secondary mt-1">
                      {m.character.name} · {splitSource(m.character.class).base} Nv {m.character.level}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden" role="progressbar" aria-label={`PV de ${m.character.name}`} aria-valuemin={0} aria-valuemax={m.character.max_hp} aria-valuenow={m.character.current_hp}>
                        <div className={`h-full rounded-full ${pct(m.character) < 30 ? 'bg-hp-danger' : pct(m.character) < 70 ? 'bg-gm-amber' : 'bg-success-active'}`} style={{ width: `${pct(m.character)}%` }} />
                      </div>
                      <span className="font-label-sm">PV {m.character.current_hp}/{m.character.max_hp}</span>
                      <span className="font-label-sm text-secondary">CA {m.character.ac}</span>
                    </div>
                    {isGM ? (
                      <GoldEditor key={`${m.character.id}-${m.character.gold}`} character={m.character}
                        onSaved={() => Promise.all([
                          client.invalidateQueries({ queryKey: ['party-roster', campaignId] }),
                          client.invalidateQueries({ queryKey: ['character', String(m.character?.id)] }),
                        ])} />
                    ) : <div className="font-label-sm text-secondary mt-1">Oro: {m.character.gold} po</div>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {members.length === 0 && (
          <div className="text-center py-20 text-secondary font-body-lg">No hay miembros en esta campaña.</div>
        )}
      </main>
    </div>
  );
}
