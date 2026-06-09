import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventApi } from '../services/api';
import type { CampaignEvent } from '../types';

export function EventsCalendar() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    eventApi.list(campaignId).then(r => setEvents(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Events</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-10 max-w-4xl mx-auto w-full">
        <div className="flex flex-col gap-3">
          {events.map((ev) => (
            <div key={ev.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-label-bold text-on-surface">{ev.title}</h3>
                  <p className="font-body-md text-on-surface-variant mt-1">{ev.description}</p>
                </div>
                <span className="font-label-sm text-secondary whitespace-nowrap ml-4">
                  {new Date(ev.date).toLocaleDateString()}
                  {ev.time && ` ${ev.time}`}
                </span>
              </div>
              {ev.location && <p className="font-label-sm text-outline mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">location_on</span>{ev.location}</p>}
            </div>
          ))}
        </div>
        {events.length === 0 && (
          <div className="text-center py-20 text-secondary font-body-lg">No hay eventos programados.</div>
        )}
      </main>
    </div>
  );
}
