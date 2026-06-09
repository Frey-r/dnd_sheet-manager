import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { campaignApi, characterApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import type { Campaign, Character, CampaignMember } from '../types';

export function CampaignHub() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { isDM } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    Promise.all([
      campaignApi.get(campaignId).then(r => setCampaign(r.data)).catch(() => {}),
      campaignApi.members(campaignId).then(r => setMembers(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => {
    if (!members.length) return;
    Promise.all(
      members.map(() =>
        characterApi.listByCampaign(campaignId!).then(r => r.data || []).catch(() => [])
      )
    ).then((results) => {
      const all = results.flat().filter(Boolean);
      // Remove duplicates by ID to be extra clean
      const unique = Array.from(new Map(all.map(ch => [ch.id, ch])).values());
      setCharacters(unique);
    });
  }, [members, campaignId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="font-body-lg text-secondary">Cargando campaña...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="font-body-lg text-secondary">Campaña no encontrada</div>
        <Link to="/campaigns" className="text-primary font-label-bold">Volver a campañas</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link to="/campaigns" className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-headline-md text-on-surface font-bold">{campaign.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDM && (
            <Link
              to={`/campaign/${campaignId}/gm`}
              className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-label-bold text-sm hover:bg-surface-tint transition-colors"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
              GM Console
            </Link>
          )}
          <div className="flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full border border-border-low-contrast">
            <div className="w-2 h-2 rounded-full bg-success-active animate-pulse" />
            <span className="font-label-bold text-on-surface text-xs">Connected</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {campaign.description && (
            <p className="font-body-md text-on-surface-variant bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              {campaign.description}
            </p>
          )}

          {characters.length > 0 && (
            <>
              <h2 className="font-label-bold text-on-surface-variant uppercase tracking-wider border-b border-border-low-contrast pb-2">Personajes</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map((ch) => (
                  <Link
                    key={ch.id}
                    to={`/campaign/${campaignId}/character/${ch.id}`}
                    className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label-bold">
                        {ch.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-label-bold text-on-surface">{ch.name}</h3>
                        <p className="font-label-sm text-on-surface-variant">{ch.race} {ch.class} Lvl {ch.level}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-on-surface-variant">HP</span>
                      <div className="w-24 bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${ch.current_hp < ch.max_hp * 0.3 ? 'bg-hp-danger' : ch.current_hp < ch.max_hp * 0.7 ? 'bg-gm-amber' : 'bg-success-active'}`}
                          style={{ width: `${Math.min((ch.current_hp / ch.max_hp) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="font-label-sm text-on-surface-variant ml-1">{ch.current_hp}/{ch.max_hp}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {characters.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center">
              <span className="material-symbols-outlined text-5xl text-outline mb-4 block">person_add</span>
              <p className="font-body-lg text-secondary mb-2">No hay personajes en esta campaña</p>
              <Link to={`/campaign/${campaignId}/character/new`} className="text-primary font-label-bold hover:underline">
                Crea tu primer personaje ahora
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}