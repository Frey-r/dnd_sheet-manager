import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { characterApi } from '../services/api';
import type { Character, CharacterFeature } from '../types';

export function FeaturesTab() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const [character, setCharacter] = useState<Character | null>(null);
  const [features, setFeatures] = useState<CharacterFeature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!characterId) return;
    setLoading(true);
    Promise.all([
      characterApi.get(characterId).then(r => setCharacter(r.data)).catch(() => {}),
      characterApi.features(characterId).then(r => setFeatures(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [characterId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;
  if (!character) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Personaje no encontrado</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast h-16 flex justify-between items-center px-4">
        <div className="flex items-center gap-2">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">{character.name}</h1>
        </div>
      </header>

      <nav className="bg-surface border-b border-border-low-contrast sticky top-16 z-30">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-4">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Core Stats</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/features`} className="py-3 border-b-2 border-primary text-primary font-label-bold whitespace-nowrap">Features & Abilities</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/inventory`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Inventory</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/spells`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Spells</Link>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-2 py-1 bg-surface-variant text-on-surface rounded font-label-sm">{character.race} {character.class} Lvl {character.level}</span>
          {character.background && <span className="px-2 py-1 bg-surface-variant text-on-surface rounded font-label-sm">{character.background}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
              <h3 className="font-label-bold text-on-surface uppercase tracking-wider mb-4">Passive Senses</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center bg-surface-subtle p-3 rounded border border-border-low-contrast">
                  <span className="font-body-md text-on-surface">Passive Perception</span>
                  <span className="font-headline-md text-on-background">{character.passive_perception}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-8 flex flex-col gap-6">
            {features.length > 0 ? (
              <section>
                <h3 className="font-label-bold text-on-surface uppercase tracking-wider border-b border-border-low-contrast pb-2 mb-4">Features & Abilities</h3>
                <div className="flex flex-col gap-4">
                  {features.map((f) => (
                    <div key={f.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4 border-l-4 border-l-primary">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-body-lg text-on-background font-bold">{f.name}</h4>
                        <span className="px-2 py-1 bg-surface-variant text-secondary rounded text-[10px] uppercase font-bold">{f.type}</span>
                      </div>
                      <p className="font-body-md text-on-surface-variant">{f.description}</p>
                      {f.uses_per_rest != null && f.uses_per_rest > 0 && (
                        <div className="mt-2 font-label-sm text-secondary">Uses: {f.uses_per_rest} per {f.rest_type || 'rest'}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-4xl text-outline mb-3 block">auto_awesome</span>
                <p className="font-body-lg text-secondary">No features configured</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
