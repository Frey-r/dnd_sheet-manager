import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { campaignApi, characterApi } from '../services/api';
import type { CampaignMember, Character } from '../types';
import { PixelAvatar } from '../components/avatar/PixelAvatar';

export function PartyRoster() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: members = [], isLoading: loading } = useQuery({
    queryKey: ['party-roster', campaignId],
    enabled: Boolean(campaignId),
    queryFn: async () => {
      const [m, c] = await Promise.all([
        campaignApi.members(campaignId!),
        characterApi.listByCampaign(campaignId!).catch(() => ({ data: [] })),
      ]);
      const chars = (c.data ?? []) as Character[];
      return (m.data as CampaignMember[]).map((member) => ({ ...member, character: chars.find((ch) => ch.user_id === member.user_id) }));
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Party Roster</h1>
        </div>
        <Link to={`/campaign/${campaignId}/gm`} className="text-primary font-label-bold">GM Console</Link>
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
                <div className="font-label-bold text-on-surface">{m.username || `Player ${m.user_id}`}</div>
                <div className="font-label-sm text-on-surface-variant">{m.role}</div>
                {m.character && (
                  <div className="font-label-sm text-secondary mt-1">
                    {m.character.name} - {m.character.class} Lvl {m.character.level}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success-active" />
                <span className="font-label-sm text-success-active">Online</span>
              </div>
            </div>
          ))}
        </div>
        {members.length === 0 && (
          <div className="text-center py-20 text-secondary font-body-lg">No hay miembros en esta campaña</div>
        )}
      </main>
    </div>
  );
}
