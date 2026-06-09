import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { characterApi } from '../services/api';
import type { InventoryItem } from '../types';

export function InventoryTab() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!characterId) return;
    setLoading(true);
    characterApi.inventory(characterId)
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [characterId]);

  const equipped = items.filter(i => i.is_equipped);
  const backpack = items.filter(i => !i.is_equipped);

  const slots = ['Head', 'Chest', 'Main Hand', 'Off Hand', 'Hands', 'Feet', 'Rings', 'Amulet'];

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="font-body-lg text-secondary">Cargando...</div></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16 w-full">
        <div className="flex items-center gap-3">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="p-2 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">arrow_back</span>
          </Link>
          <h1 className="font-headline-md text-on-surface font-bold">Inventory</h1>
        </div>
      </header>

      <nav className="bg-surface border-b border-border-low-contrast sticky top-16 z-30">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-4">
          <Link to={`/campaign/${campaignId}/character/${characterId}`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Stats</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/spells`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Spells</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/inventory`} className="py-3 border-b-2 border-primary text-primary font-label-bold whitespace-nowrap">Inventory</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/bio`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Bio</Link>
          <Link to={`/campaign/${campaignId}/character/${characterId}/features`} className="py-3 border-b-2 border-transparent text-secondary hover:text-on-surface font-label-bold whitespace-nowrap">Features</Link>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        {equipped.length > 0 && (
          <section>
            <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-3">Equipped</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {equipped.map((item) => (
                <div key={item.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-3">
                  <div className="font-label-bold text-on-surface text-sm">{item.name}</div>
                  <div className="font-label-sm text-secondary">{item.slot_type || item.item_type}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-3">Backpack</h3>
          {backpack.length === 0 ? (
            <div className="text-center py-10 bg-surface-container-lowest border border-border-low-contrast rounded-lg">
              <p className="font-body-md text-secondary">Mochila vacía</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {backpack.map((item) => (
                <div key={item.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-body-md text-on-surface">{item.name}</div>
                    <div className="font-label-sm text-secondary flex gap-2">
                      <span>{item.item_type}</span>
                      {item.rarity && <span className="text-primary">{item.rarity}</span>}
                      <span>{item.weight} lbs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-bold text-on-surface">x{item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
