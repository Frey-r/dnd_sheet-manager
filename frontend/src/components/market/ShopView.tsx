/* A shop as a player sees it: fill a cart and send it to the seller to haggle (the price is
   role-played with the GM, nothing is bought instantly), or sell from the inventory
   (market-bastions.md §3). */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi } from '../../services/api';
import {
  HAGGLE_SKILLS, cpToGP, formatCP, gpToCP, marketApi, offersApi, rarityLabel, typeLabel, type ShopItem, type ShopOffer,
} from '../../services/marketApi';

interface Props {
  campaignId: string | number;
  shopId: number;
  characterId?: number;
  onClose?: () => void;
}

type Cart = Record<number, number>;
const errText = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo completar';
const cartKey = (c: string | number, s: number) => `cart:${c}:${s}`;
const loadCart = (key: string): Cart => { try { return JSON.parse(localStorage.getItem(key) || '{}') as Cart; } catch { return {}; } };

export function ShopView({ campaignId, shopId, characterId, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'shop' | 'cart' | 'sell'>('shop');
  const [cart, setCart] = useState<Cart>(() => loadCart(cartKey(campaignId, shopId)));
  const [sellQty, setSellQty] = useState<Record<number, number>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => { try { localStorage.setItem(cartKey(campaignId, shopId), JSON.stringify(cart)); } catch { /* ignore */ } }, [cart, campaignId, shopId]);

  const data = useQuery({ queryKey: ['shop-items', campaignId, shopId], queryFn: () => marketApi.items(campaignId, shopId) });
  const sellable = useQuery({ queryKey: ['shop-sellable', campaignId, shopId], queryFn: () => marketApi.sellable(campaignId, shopId), enabled: tab === 'sell' });
  const offers = useQuery({ queryKey: ['offers', String(campaignId)], queryFn: () => offersApi.list(campaignId), refetchInterval: 8000 });
  const wallet = useQuery({
    queryKey: ['character', String(characterId)],
    queryFn: async () => (await characterApi.get(characterId!)).data as { gold: number; silver?: number; copper?: number },
    enabled: Boolean(characterId),
  });

  const flash = (ok: boolean, text: string) => { setNotice({ ok, text }); setTimeout(() => setNotice(null), 4500); };
  const refresh = () => {
    for (const key of [['shop-items', campaignId, shopId], ['shop-sellable', campaignId, shopId], ['character', String(characterId)], ['shops', String(campaignId)], ['offers', String(campaignId)]]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
  const sell = useMutation({
    mutationFn: (id: number) => marketApi.sell(campaignId, shopId, id, sellQty[id] ?? 1),
    onSuccess: (r) => { flash(true, r.message); refresh(); },
    onError: (e) => flash(false, errText(e)),
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'reject' | 'withdraw' }) => offersApi.act(campaignId, id, action),
    onSuccess: (r) => { flash(true, r.message); refresh(); },
    onError: (e) => { flash(false, errText(e)); refresh(); },
  });

  const shop = data.data?.shop;
  const allItems = useMemo(() => data.data?.items ?? [], [data.data]);
  const items = allItems.filter((i) => !filter || i.name.toLowerCase().includes(filter.toLowerCase()));
  const w = wallet.data;
  const walletCP = w ? w.gold * 100 + (w.silver ?? 0) * 10 + (w.copper ?? 0) : null;
  const canTrade = Boolean(shop?.available);
  const active = offers.data?.active?.[0] ?? null;
  const lastResolved = offers.data?.recent?.find((o) => o.shop_id === shopId) ?? null;
  const cartLines = useMemo(() => Object.entries(cart)
    .map(([id, qty]) => ({ item: allItems.find((i) => i.id === Number(id)), qty }))
    .filter((l): l is { item: ShopItem; qty: number } => Boolean(l.item) && l.qty > 0), [cart, allItems]);
  const cartCount = cartLines.reduce((n, l) => n + l.qty, 0);

  const setQty = (it: ShopItem, qty: number) => {
    const max = it.stock === -1 ? 99 : it.stock;
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[it.id]; else next[it.id] = Math.min(max, qty);
      return next;
    });
  };

  if (data.isLoading) return <div className="p-6 text-center text-muted">Cargando tienda…</div>;
  if (!shop) return <div className="p-6 text-center text-bad">No se pudo abrir la tienda.</div>;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="material-symbols-outlined mt-1 text-[26px] text-gold">{shop.icon || 'storefront'}</span>
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-tight">{shop.name}</h2>
            <p className="text-[13px] text-muted">
              {shop.npc_name ? `Atiende ${shop.npc_name}` : 'Tienda'}
              {shop.buy_rate_pct > 0 ? ` · compra al ${shop.buy_rate_pct}%` : ' · no compra objetos'}
              {shop.price_pct !== 100 ? ` · precios ${shop.price_pct > 100 ? '+' : ''}${shop.price_pct - 100}%` : ''}
            </p>
            {shop.description && <p className="mt-1 max-w-prose text-[13.5px] text-ink-2">{shop.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {walletCP !== null && <span className="mc-badge text-gold"><span className="material-symbols-outlined text-[15px]">payments</span>{formatCP(walletCP)}</span>}
          {onClose && <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onClose}>Cerrar</button>}
        </div>
      </header>

      {!canTrade && <div className="rounded-lg border border-line bg-card-2 px-3 py-2 text-[13px] text-warn">{shop.reason || 'La tienda no está disponible ahora.'}</div>}
      {active && <ActiveOffer offer={active} busy={act.isPending} onAct={(action) => act.mutate({ id: active.id, action })} />}
      {!active && lastResolved && <ResolvedOffer offer={lastResolved} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="mc-seg" role="group" aria-label="Sección de la tienda">
          <button type="button" aria-pressed={tab === 'shop'} onClick={() => setTab('shop')}>Tienda</button>
          <button type="button" aria-pressed={tab === 'cart'} onClick={() => setTab('cart')}>
            <span className="material-symbols-outlined text-[16px]">shopping_cart</span>Carrito{cartCount ? ` · ${cartCount}` : ''}
          </button>
          <button type="button" aria-pressed={tab === 'sell'} onClick={() => setTab('sell')} disabled={shop.buy_rate_pct <= 0}>Vender</button>
        </div>
        {tab === 'shop' && <input className="h-9 min-w-[140px] flex-1 rounded-lg border border-line bg-card-2 px-3 text-[14px] outline-none focus:border-accent" placeholder="Buscar en la tienda…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
        {notice && <span role="status" className={`ml-auto text-[13px] ${notice.ok ? 'text-ok' : 'text-bad'}`}>{notice.text}</span>}
      </div>

      {tab === 'shop' && (items.length === 0 ? (
        <div className="mc-card p-8 text-center text-muted">{allItems.length ? 'Nada coincide.' : 'La tienda no tiene existencias.'}</div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((it) => {
            const inCart = cart[it.id] ?? 0;
            return (
              <li key={it.id} className={`mc-card flex flex-col gap-2 p-3.5 ${inCart ? 'border-accent' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{it.name}</div>
                    <div className="text-[12.5px] text-muted">{typeLabel(it.item_type)} · {rarityLabel(it.rarity)}{it.attunement_required ? ' · sintonía' : ''}{it.weight ? ` · ${it.weight} lb` : ''}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[14px] text-gold">{formatCP(it.final_price_cp)}</div>
                    <div className="text-[12px] text-faint">{it.stock === -1 ? 'sin límite' : `${it.stock} en stock`}</div>
                  </div>
                </div>
                {it.description && <p className="line-clamp-2 text-[12.5px] text-ink-2">{it.description}</p>}
                <div className="mt-auto flex items-center justify-end gap-2">
                  {inCart > 0 ? (
                    <Stepper value={inCart} max={it.stock === -1 ? 99 : it.stock} onChange={(n) => setQty(it, n)} label={it.name} />
                  ) : (
                    <button type="button" className="mc-btn mc-btn-sm" disabled={!canTrade} onClick={() => setQty(it, 1)}>
                      <span className="material-symbols-outlined text-[17px]">add_shopping_cart</span>Al carrito
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ))}

      {tab === 'cart' && (
        <CartPanel campaignId={campaignId} shopId={shopId} lines={cartLines} walletCP={walletCP} sellerName={shop.npc_name}
          disabled={!canTrade || !characterId} blockedBy={active}
          onQty={setQty}
          onSent={(msg) => { setCart({}); flash(true, msg); refresh(); }}
          onError={(msg) => flash(false, msg)} />
      )}

      {tab === 'sell' && (
        <ul className="flex flex-col gap-2">
          {sellable.isLoading && <li className="text-muted">Cargando tu inventario…</li>}
          {sellable.data?.length === 0 && <li className="mc-card p-6 text-center text-muted">No tienes objetos.</li>}
          {sellable.data?.map((it) => {
            const n = sellQty[it.id] ?? 1;
            return (
              <li key={it.id} className="mc-card flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{it.name} {it.quantity > 1 && <span className="text-faint">×{it.quantity}</span>}</div>
                  <div className="text-[12.5px] text-muted">{typeLabel(it.item_type)}{it.value_cp ? ` · vale ${formatCP(it.value_cp)}` : ''}</div>
                </div>
                {it.reason ? <span className="text-[12.5px] text-faint">{it.reason}</span> : (
                  <>
                    {it.quantity > 1 && <Stepper value={n} max={it.quantity} min={1} onChange={(v) => setSellQty({ ...sellQty, [it.id]: v })} label={it.name} />}
                    <span className="font-mono text-[13px] text-gold">{formatCP(it.offer_cp * n)}</span>
                    <button type="button" className="mc-btn mc-btn-sm" disabled={!canTrade || sell.isPending} onClick={() => sell.mutate(it.id)}>Vender</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stepper({ value, max, min = 0, onChange, label }: { value: number; max: number; min?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-line" role="group" aria-label={`Cantidad de ${label}`}>
      <button type="button" className="grid h-8 w-8 place-items-center text-ink-2 hover:bg-card-2" aria-label="Quitar uno" onClick={() => onChange(Math.max(min, value - 1))}>
        <span className="material-symbols-outlined text-[17px]">{value <= 1 && min === 0 ? 'delete' : 'remove'}</span>
      </button>
      <span className="min-w-[2ch] px-1 text-center font-mono text-[14px]">{value}</span>
      <button type="button" className="grid h-8 w-8 place-items-center text-ink-2 hover:bg-card-2 disabled:opacity-40" aria-label="Añadir uno" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <span className="material-symbols-outlined text-[17px]">add</span>
      </button>
    </div>
  );
}

function CartPanel({ campaignId, shopId, lines, walletCP, sellerName, disabled, blockedBy, onQty, onSent, onError }: {
  campaignId: string | number; shopId: number; lines: { item: ShopItem; qty: number }[]; walletCP: number | null; sellerName?: string;
  disabled: boolean; blockedBy: ShopOffer | null; onQty: (it: ShopItem, n: number) => void; onSent: (msg: string) => void; onError: (msg: string) => void;
}) {
  const list = lines.reduce((sum, l) => sum + l.item.final_price_cp * l.qty, 0);
  const [gp, setGp] = useState<string | null>(null); // null = follow the list price
  const [message, setMessage] = useState('');
  const [skill, setSkill] = useState('');
  const offered = gp === null ? list : gpToCP(Number(gp) || 0);
  const tooPoor = walletCP !== null && offered > walletCP;
  const send = useMutation({
    mutationFn: () => offersApi.make(campaignId, shopId, { lines: lines.map((l) => ({ item_id: l.item.id, qty: l.qty })), offered_cp: offered, message, skill }),
    onSuccess: (r) => { setGp(null); setMessage(''); setSkill(''); onSent(r.message); },
    onError: (e) => onError(errText(e)),
  });

  if (lines.length === 0) return <div className="mc-card p-8 text-center text-muted">Tu carrito está vacío. Añade objetos desde la tienda.</div>;
  return (
    <form className="mc-card flex flex-col gap-4 p-4" onSubmit={(e) => { e.preventDefault(); if (!tooPoor && !blockedBy && !disabled) send.mutate(); }}>
      <ul className="divide-y divide-line">
        {lines.map(({ item, qty }) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{item.name}</div>
              <div className="text-[12.5px] text-muted">{formatCP(item.final_price_cp)} c/u</div>
            </div>
            <Stepper value={qty} max={item.stock === -1 ? 99 : item.stock} onChange={(n) => onQty(item, n)} label={item.name} />
            <span className="w-24 text-right font-mono text-[13.5px]">{formatCP(item.final_price_cp * qty)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-muted">Precio de lista</span>
        <span className="font-mono text-[17px]">{formatCP(list)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">Tu oferta (po)
          <input type="number" min={0} step="0.01" className="h-10 rounded-lg border border-line bg-card-2 px-3 font-mono"
            value={gp ?? String(cpToGP(list))} onChange={(e) => setGp(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">Tirada para convencer (opcional)
          <select className="h-10 rounded-lg border border-line bg-card-2 px-3" value={skill} onChange={(e) => setSkill(e.target.value)}>
            {HAGGLE_SKILLS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">Nota para {sellerName || 'el vendedor'} (opcional)
        <textarea className="min-h-[56px] rounded-lg border border-line bg-card-2 px-3 py-2 text-[14px]" maxLength={500} value={message}
          placeholder="«Es para el templo; volveremos a comprarte…»" onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="text-[12.5px] text-muted">
        Nada se cobra todavía: el pedido llega a {sellerName || 'el vendedor'} y el precio se negocia en la llamada. La tirada, si la eliges, solo la ve el DM.
      </p>
      {tooPoor && <p className="text-[13px] text-bad">No te alcanza ({walletCP !== null ? formatCP(walletCP) : ''}).</p>}
      {blockedBy && <p className="text-[13px] text-warn">Ya tienes un pedido en curso. Espera al vendedor o retíralo para enviar otro.</p>}
      <div>
        <button type="submit" className="mc-btn mc-btn-primary" disabled={disabled || Boolean(blockedBy) || tooPoor || send.isPending}>
          <span className="material-symbols-outlined text-[18px]">handshake</span>
          Enviar pedido · ofrezco {formatCP(offered)}
        </button>
      </div>
    </form>
  );
}

function ActiveOffer({ offer, busy, onAct }: { offer: ShopOffer; busy: boolean; onAct: (a: 'accept' | 'reject' | 'withdraw') => void }) {
  const countered = offer.status === 'countered' && offer.counter_cp !== null;
  const seller = offer.npc_name || 'El vendedor';
  return (
    <div className={`rounded-lg border px-3.5 py-3 text-[13.5px] ${countered ? 'border-accent bg-card-2' : 'border-line bg-card-2'}`} role="status">
      <div className="font-semibold">
        {countered ? `${seller} propone ${formatCP(offer.counter_cp!)}` : `Negociando con ${seller.toLowerCase() === 'el vendedor' ? 'el vendedor' : seller}…`}
      </div>
      <div className="mt-0.5 text-muted">
        {offer.summary} · ofreciste {formatCP(offer.offered_cp)} (lista {formatCP(offer.list_cp)})
        {countered && offer.note ? ` · «${offer.note}»` : ''}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {countered && <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" disabled={busy} onClick={() => onAct('accept')}>Aceptar {formatCP(offer.counter_cp!)}</button>}
        {countered && <button type="button" className="mc-btn mc-btn-sm" disabled={busy} onClick={() => onAct('reject')}>Rechazar</button>}
        <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" disabled={busy} onClick={() => onAct('withdraw')}>Retirar pedido</button>
      </div>
    </div>
  );
}

function ResolvedOffer({ offer }: { offer: ShopOffer }) {
  const text = {
    accepted: `Trato cerrado: ${offer.summary}${offer.agreed_cp !== null ? ` por ${formatCP(offer.agreed_cp)}` : ''}.`,
    rejected: `No hubo trato por ${offer.summary}.`,
    withdrawn: `Retiraste tu pedido (${offer.summary}).`,
  }[offer.status as 'accepted' | 'rejected' | 'withdrawn'];
  if (!text) return null;
  return (
    <div className={`rounded-lg border border-line bg-card-2 px-3.5 py-2.5 text-[13px] ${offer.status === 'accepted' ? 'text-ok' : 'text-muted'}`}>
      {text}{offer.note ? ` «${offer.note}»` : ''}
    </div>
  );
}
