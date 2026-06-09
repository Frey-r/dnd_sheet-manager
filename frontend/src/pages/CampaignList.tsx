import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { campaignApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import type { Campaign } from '../types';

export function CampaignListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDM } = useAuth();

  useEffect(() => {
    campaignApi.list()
      .then((res) => { setCampaigns(res.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-10">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background mb-2">Mis Campañas</h1>
          <p className="font-body-lg text-secondary hidden md:block">
            Select a campaign to manage sessions, combat, and lore.
          </p>
        </div>
        {isDM && (
          <Link
            to="/campaigns/new"
            className="bg-primary-container text-on-primary-container px-6 py-3 rounded-lg font-label-bold flex items-center gap-2 hover:bg-surface-tint transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            Crear Campaña
          </Link>
        )}
      </div>

      {/* Campaign grid */}
      {loading ? (
        <div className="text-center py-20 text-secondary">Cargando...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-6xl text-outline mb-4 block">map</span>
          <p className="font-body-lg text-secondary">No tienes campañas aún.</p>
          <Link to="/campaigns/new" className="text-primary font-label-bold">Crea tu primera</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to={`/campaign/${campaign.id}`}
              className="bg-surface rounded-xl border border-border-low-contrast overflow-hidden flex flex-col group cursor-pointer hover:border-primary transition-colors hover:shadow-md"
            >
              <div className="h-32 bg-surface-container relative overflow-hidden">
                {campaign.status === 'active' && (
                  <div className="absolute top-3 left-3 bg-success-active text-on-primary px-3 py-1 rounded-full font-label-bold text-label-bold flex items-center gap-1 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-on-primary animate-pulse" />
                    Activa
                  </div>
                )}
                {campaign.status === 'paused' && (
                  <div className="absolute top-3 left-3 bg-surface-variant text-on-surface px-3 py-1 rounded-full font-label-bold border border-border-low-contrast">
                    En Pausa
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h2 className="font-headline-md text-on-background group-hover:text-primary transition-colors mb-2">
                  {campaign.name}
                </h2>
                <p className="font-body-md text-secondary mb-4 line-clamp-2 flex-1">{campaign.description}</p>
                <div className="flex justify-between items-center pt-4 border-t border-surface-container">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-sm">person</span>
                    <span className="font-label-sm text-on-surface-variant">GM Name</span>
                  </div>
                  <div className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded">
                    <span className="material-symbols-outlined text-outline text-sm">groups</span>
                    <span className="font-label-bold text-on-background">5/6</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* FAB mobile */}
      <Link
        to="/campaigns/new"
        className="md:hidden fixed bottom-24 right-4 w-14 h-14 bg-primary-container text-on-primary-container rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.15)] flex items-center justify-center z-50 hover:bg-surface-tint"
      >
        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </Link>
    </div>
  );
}
