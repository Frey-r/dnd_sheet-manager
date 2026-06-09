import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { noteApi } from '../services/api';

export function CampaignNotes() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [notes, setNotes] = useState<{ id: number; title: string; content: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    noteApi.list(campaignId).then(r => setNotes(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Notes</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-10 max-w-4xl mx-auto w-full">
        <div className="flex flex-col gap-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              <h3 className="font-label-bold text-on-surface">{n.title}</h3>
              <p className="font-body-md text-on-surface-variant mt-2 line-clamp-3">{n.content}</p>
            </div>
          ))}
        </div>
        {notes.length === 0 && (
          <div className="text-center py-20 text-secondary font-body-lg">No hay notas de campaña.</div>
        )}
      </main>
    </div>
  );
}
