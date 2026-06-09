import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mapApi } from '../services/api';
import type { MapEntry } from '../types';

export function MapGallery() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [maps, setMaps] = useState<MapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    mapApi.list(campaignId).then(r => setMaps(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/gm`} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Maps</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-10 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((m) => (
            <Link key={m.id} to={`/campaign/${campaignId}/gm/maps/${m.id}`} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg overflow-hidden hover:border-primary transition-colors group">
              <div className="h-40 bg-surface-subtle overflow-hidden">
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-outline">map</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-label-bold text-on-surface">{m.name}</h3>
                <p className="font-label-sm text-on-surface-variant flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  {m.location}
                </p>
              </div>
            </Link>
          ))}
        </div>
        {maps.length === 0 && (
          <div className="text-center py-20 text-secondary font-body-lg">No hay mapas en esta campaña.</div>
        )}
      </main>
    </div>
  );
}
