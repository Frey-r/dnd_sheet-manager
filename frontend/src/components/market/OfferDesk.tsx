/* GM side of haggling: one order at a time in a modal, the rest queued. The price is
   role-played on the call; the GM closes the deal at the agreed price (market-bastions.md §3). */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cpToGP, formatCP, gpToCP, offersApi, type ShopOffer } from '../../services/marketApi';

const errText = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo completar';

export function OfferDesk({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const [minimized, setMinimized] = useState<number | null>(null);
  const offers = useQuery({ queryKey: ['offers', campaignId], queryFn: () => offersApi.list(campaignId), refetchInterval: 6000 });
  const pending = (offers.data?.active ?? []).filter((o) => o.status === 'pending');
  const waiting = (offers.data?.active ?? []).filter((o) => o.status === 'countered').length;
  const current = pending[0];
  if (!current) return null;

  // Minimized: a pill until a newer order reaches the head of the queue.
  if (minimized === current.id) {
    return (
      <button type="button" onClick={() => setMinimized(null)}
        className="mc-btn mc-btn-primary fixed bottom-24 left-1/2 z-50 -translate-x-1/2 shadow-[var(--shadow-3)] md:bottom-6">
        <span className="material-symbols-outlined text-[18px]">handshake</span>
        {pending.length === 1 ? '1 pedido por negociar' : `${pending.length} pedidos por negociar`}
      </button>
    );
  }
  return (
    <OfferModal key={current.id} campaignId={campaignId} offer={current} queued={pending.length - 1} waiting={waiting}
      onMinimize={() => setMinimized(current.id)}
      onResolved={() => {
        void qc.invalidateQueries({ queryKey: ['offers', campaignId] });
        void qc.invalidateQueries({ queryKey: ['shop-items'] });
        void qc.invalidateQueries({ queryKey: ['shops', campaignId] });
      }} />
  );
}

function OfferModal({ campaignId, offer, queued, waiting, onMinimize, onResolved }: {
  campaignId: string; offer: ShopOffer; queued: number; waiting: number; onMinimize: () => void; onResolved: () => void;
}) {
  const [priceGp, setPriceGp] = useState(String(cpToGP(offer.offered_cp)));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const price = gpToCP(Number(priceGp) || 0);
  const act = useMutation({
    mutationFn: (action: 'accept' | 'reject' | 'counter') => offersApi.act(campaignId, offer.id, action, action === 'reject' ? { note } : { price_cp: price, note }),
    onSuccess: () => onResolved(),
    onError: (e) => { setError(errText(e)); onResolved(); },
  });
  const pct = offer.list_cp > 0 ? Math.round((price / offer.list_cp) * 100) : 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Pedido de un jugador">
      <div className="mc-card flex max-h-[92vh] w-full max-w-xl flex-col gap-4 overflow-y-auto p-5 shadow-[var(--shadow-3)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mc-eyebrow">Regateo · {offer.shop_name}{offer.npc_name ? ` · eres ${offer.npc_name}` : ''}</div>
            <h3 className="font-display text-[21px] leading-tight">{offer.character_name} quiere comprar</h3>
          </div>
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onMinimize} title="Responder más tarde">Luego</button>
        </div>

        <ul className="divide-y divide-line rounded-lg border border-line">
          {offer.lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-[14px]">
              <span className="w-8 text-right font-mono text-muted">{l.qty}×</span>
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="font-mono text-[13px] text-muted">{formatCP(l.unit_list_cp * l.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-card-2 p-3">
            <div className="text-[12px] text-muted">Precio de lista</div>
            <div className="font-mono text-[17px]">{formatCP(offer.list_cp)}</div>
          </div>
          <div className="rounded-lg border border-accent bg-card-2 p-3">
            <div className="text-[12px] text-muted">Ofrece de entrada</div>
            <div className="font-mono text-[17px] text-gold">{formatCP(offer.offered_cp)}</div>
          </div>
        </div>

        {offer.message && <blockquote className="border-l-2 border-accent pl-3 text-[14px] italic text-ink-2">«{offer.message}»</blockquote>}
        {offer.skill && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-card-2 px-3 py-2 text-[13.5px]">
            <span className="material-symbols-outlined text-[18px] text-gold">casino</span>
            <span>Tirada de <b className="capitalize">{offer.skill}</b>: <b className="font-mono text-[15px]">{offer.roll_total}</b> <span className="text-muted">({offer.roll_detail})</span></span>
            <span className="ml-auto text-[12px] text-faint">secreta</span>
          </div>
        )}
        <p className="text-[13px] text-muted">Negocien en la llamada. Cuando lleguen a un precio, escríbelo y cierra el trato.</p>

        <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">Precio acordado (po)
            <input type="number" min={0} step="0.01" className="h-10 rounded-lg border border-line bg-card-2 px-3 font-mono" value={priceGp} onChange={(e) => setPriceGp(e.target.value)} />
            <span className="font-normal text-faint">{pct}% del precio de lista</span>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">Lo que dice el vendedor (opcional)
            <input className="h-10 rounded-lg border border-line bg-card-2 px-3" maxLength={300} value={note} placeholder="«Por menos de eso no sale de la forja»" onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-[13px] text-bad">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="mc-btn mc-btn-primary" disabled={act.isPending} onClick={() => act.mutate('accept')}>Cerrar trato por {formatCP(price)}</button>
          <button type="button" className="mc-btn" disabled={act.isPending || price <= 0} onClick={() => act.mutate('counter')} title="El jugador decide en su pantalla">Proponer {formatCP(price)}</button>
          <button type="button" className="mc-btn mc-btn-danger" disabled={act.isPending} onClick={() => act.mutate('reject')}>Rechazar</button>
        </div>
        {(queued > 0 || waiting > 0) && (
          <p className="text-[12.5px] text-faint">
            {queued > 0 && `${queued} en cola`}{queued > 0 && waiting > 0 && ' · '}{waiting > 0 && `${waiting} esperando respuesta del jugador`}
          </p>
        )}
      </div>
    </div>
  );
}
