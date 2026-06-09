import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loreApi } from '../services/api';
import type { LoreEntry } from '../types';

export function LoreEditor() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [entries, setEntries] = useState<LoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    loreApi.list(campaignId).then(r => setEntries(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Lore Editor</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-10 max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-label-bold text-on-surface">{entry.title}</h3>
                <span className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] uppercase ${
                  entry.lore_tier === 'gm_hidden_lore' ? 'bg-gm-amber/10 text-gm-amber' : entry.lore_tier === 'campaign_plot' ? 'bg-primary/10 text-primary' : 'bg-surface-subtle text-secondary'
                }`}>{entry.lore_tier}</span>
              </div>
              <p className="font-body-md text-on-surface-variant line-clamp-2">{entry.content_text}</p>
              <div className="flex items-center gap-2 mt-3 font-label-sm text-secondary">
                <span className={`w-2 h-2 rounded-full ${entry.vectorized ? 'bg-success-active' : 'bg-outline'}`} />
                {entry.vectorized ? 'Vectorized' : 'Pending'}
              </div>
            </div>
          ))}
        </div>
        {entries.length === 0 && (
          <div className="text-center py-20 text-secondary font-body-lg">No hay entradas de lore.</div>
        )}
      </main>
    </div>
  );
}
