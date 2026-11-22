import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { campaignApi, characterApi } from '../services/api';
import type { CampaignMember, Character } from '../types';
import { PixelAvatar } from '../components/avatar/PixelAvatar';
import { splitSource } from '../lib/avatar';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';

const pct = (c: Character) => (c.max_hp > 0 ? Math.max(0, Math.min(100, (c.current_hp / c.max_hp) * 100)) : 0);

export function PartyRoster() {
  const { campaignId } = useParams<{ campaignId: string }>();
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
