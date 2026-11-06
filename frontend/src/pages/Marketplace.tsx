/* Mercado: dynamic shops for players, shop management for the GM (market-bastions.md). */
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCampaign } from '../lib/useCampaign';
import { marketApi, type Shop } from '../services/marketApi';
import { ShopView } from '../components/market/ShopView';
import { ShopManager } from '../components/market/ShopManager';

export function Marketplace() {
  const { campaignId = '' } = useParams<{ campaignId: string }>();
  const { isGM, myCharacter } = useCampaign(campaignId);
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<'manage' | 'browse'>('manage');
  const shops = useQuery({ queryKey: ['shops', campaignId], queryFn: () => marketApi.shops(campaignId), enabled: Boolean(campaignId) });
  const shopParam = Number(params.get('shop')) || null;
  const list = (shops.data ?? []).slice().sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));
  const openShop = (id: number | null) => setParams(id ? { shop: String(id) } : {});
  const showManager = isGM && mode === 'manage';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mc-eyebrow">Partida</div>
          <h1 className="font-display text-[28px] leading-tight">Mercado</h1>
          <p className="mt-1 text-[14px] text-muted">
            {isGM ? 'Crea tiendas y decide cuándo abren: siempre, con su escena o al acercarse a su mostrador en el mapa.' : 'Tiendas abiertas ahora. Algunas solo abren en su escena o junto a su mostrador.'}
          </p>
        </div>
        {isGM && (
          <div className="mc-seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={mode === 'manage'} onClick={() => setMode('manage')}>Gestionar</button>
            <button type="button" aria-pressed={mode === 'browse'} onClick={() => setMode('browse')}>Ver como tienda</button>
          </div>
        )}
      </header>

      {showManager ? <ShopManager campaignId={campaignId} /> : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-2">
            {shops.isLoading && <div className="text-muted">Cargando…</div>}
            {!shops.isLoading && list.length === 0 && <p className="mc-card p-4 text-[13.5px] text-muted">No hay tiendas abiertas por ahora.</p>}
            {list.map((s) => <ShopCard key={s.id} shop={s} active={shopParam === s.id} onClick={() => openShop(s.id)} />)}
          </aside>
          <section className="min-w-0">
            {shopParam ? (
              <div className="mc-card p-5"><ShopView campaignId={campaignId} shopId={shopParam} characterId={myCharacter?.id} onClose={() => openShop(null)} /></div>
            ) : (
              <div className="mc-card flex min-h-[220px] flex-col items-center justify-center gap-2 p-8 text-center text-muted">
                <span className="material-symbols-outlined text-[30px] text-faint">storefront</span>
                Elige una tienda para ver qué vende.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ShopCard({ shop, active, onClick }: { shop: Shop; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`mc-card flex items-center gap-3 p-3 text-left transition-colors hover:border-line-strong ${active ? 'border-accent' : ''} ${shop.available ? '' : 'opacity-70'}`}>
      <span className={`material-symbols-outlined ${shop.available ? 'text-gold' : 'text-faint'}`}>{shop.icon || 'storefront'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{shop.name}</span>
        <span className={`block truncate text-[12.5px] ${shop.available ? 'text-ok' : 'text-muted'}`}>{shop.available ? `Abierta · ${shop.item_count} objetos` : shop.reason}</span>
      </span>
    </button>
  );
}
