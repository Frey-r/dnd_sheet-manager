import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { npcApi } from '../services/api';
import type { NPC } from '../types';

export function NPCManager() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    npcApi.list(campaignId).then(r => setNpcs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">NPCs</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-10 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {npcs.map((npc) => (
            <Link key={npc.id} to={`/campaign/${campaignId}/gm/npcs/${npc.id}`} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 hover:border-primary transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-surface-container-high border border-border-low-contrast flex items-center justify-center font-label-bold text-on-surface">
                  {npc.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-label-bold text-on-surface">{npc.name}</h3>
                  <p className="font-label-sm text-on-surface-variant">{npc.role}</p>
                </div>
                <span className={`ml-auto px-2 py-0.5 rounded-full font-label-sm text-[10px] uppercase ${
                  npc.status === 'ally' ? 'bg-success-active/10 text-success-active' : npc.status === 'enemy' ? 'bg-hp-danger/10 text-hp-danger' : 'bg-surface-dim text-secondary'
                }`}>{npc.status}</span>
              </div>
              {npc.description && <p className="font-body-md text-on-surface-variant line-clamp-2">{npc.description}</p>}
            </Link>
          ))}
        </div>
        {npcs.length === 0 && (
          <div className="text-center py-20 text-secondary font-body-lg">No hay NPCs. Crea uno.</div>
        )}
      </main>
    </div>
  );
}
