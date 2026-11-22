import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, tradeApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import type { Character, InventoryItem } from '../types';
import { itemCount } from '../lib/plural';

type Offer = { id: number; campaign_id: number; offeror_character_id: number; recipient_character_id: number; offered_item_ids: string; requested_item_ids: string; offered_gold: number; requested_gold: number; status: string; expires_at: string };
const parseIDs = (value: string): number[] => { try { const ids = JSON.parse(value) as unknown; return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : []; } catch { return []; } };

const STATUS: Record<string, { label: string; dot: string }> = {
  pending: { label: 'Pendiente', dot: 'bg-warn' },
  accepted: { label: 'Aceptada', dot: 'bg-ok' },
  rejected: { label: 'Rechazada', dot: 'bg-bad' },
  cancelled: { label: 'Cancelada', dot: 'bg-faint' },
  expired: { label: 'Expirada', dot: 'bg-faint' },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS[status] ?? { label: status, dot: 'bg-faint' };
  return <span className="mc-badge inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${info.dot}`} />{info.label}</span>;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function remaining(expiresAt: string, now: number) {
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'Expirada';
  const minutes = Math.floor(ms / 60000);
  if (minutes >= 60 * 24) return `Expira en ${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
  if (minutes >= 60) return `Expira en ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `Expira en ${minutes} min ${Math.floor((ms % 60000) / 1000)} s`;
}

export function Trade() {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const now = useNow(1000);
  const [recipientID, setRecipientID] = useState(0);
  const [offeredGold, setOfferedGold] = useState(0);
  const [requestedGold, setRequestedGold] = useState(0);
  const [askGold, setAskGold] = useState(false);
  const [offeredItems, setOfferedItems] = useState<number[]>([]);
  const [requestedItems, setRequestedItems] = useState<number[]>([]);
  const [error, setError] = useState('');
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => characterApi.listByCampaign(campaignId).then((response) => response.data as Character[]) });
  const mine = characters.data?.find((character) => character.user_id === user?.id);
  const inventory = useQuery({ queryKey: ['inventory', mine?.id], enabled: Boolean(mine), queryFn: () => characterApi.inventory(mine!.id).then((response) => response.data as InventoryItem[]) });
  const recipientInventory = useQuery({ queryKey: ['inventory', recipientID], enabled: recipientID > 0, queryFn: () => characterApi.inventory(recipientID).then((response) => response.data as InventoryItem[]) });
  const offers = useQuery({ queryKey: ['trades'], queryFn: () => tradeApi.list().then((response) => response.data as Offer[]) });
  const campaignOffers = (offers.data ?? []).filter((offer) => String(offer.campaign_id) === campaignId);
  const invalidate = () => { void client.invalidateQueries({ queryKey: ['trades'] }); void client.invalidateQueries({ queryKey: ['inventory'] }); void client.invalidateQueries({ queryKey: ['characters'] }); };
  const action = useMutation({ mutationFn: (operation: () => Promise<unknown>) => operation(), onSuccess: () => { setError(''); invalidate(); }, onError: (reason) => setError(getApiError(reason)) });
  const offerData = { recipient_character_id: recipientID, offered_item_ids: offeredItems, offered_gold: offeredGold, requested_item_ids: requestedItems, requested_gold: askGold ? requestedGold : 0 };
  const send = () => {
    if (!mine || !recipientID) return;
    action.mutate(async () => {
      await tradeApi.create(mine.id, offerData);
      setOfferedItems([]); setRequestedItems([]); setOfferedGold(0); setRequestedGold(0); setAskGold(false);
    });
  };
  const toggle = (id: number, selected: number[], choose: (ids: number[]) => void) => choose(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  const itemChoices = (items: InventoryItem[] | undefined, selected: number[], choose: (ids: number[]) => void) => <div className="max-h-48 overflow-y-auto space-y-1">{items?.filter((item) => item.is_tradeable && !item.quest_bound && !item.is_equipped && !item.trade_locked).map((item) => <label key={item.id} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id, selected, choose)} />{item.name} ×{item.quantity}</label>)}{items?.length === 0 && <p className="text-secondary text-sm">No hay objetos disponibles.</p>}</div>;
  const characterName = (id: number) => characters.data?.find((character) => character.id === id)?.name || `#${id}`;
  const recipient = characters.data?.find((character) => character.id === recipientID);
  const inputClass = 'block mt-1 w-full rounded bg-surface-subtle border-border-low-contrast disabled:opacity-60';

  return <div className="min-h-screen"><header className="h-16 px-4 border-b border-border-low-contrast flex items-center gap-3"><Link to={`/campaign/${campaignId}`} aria-label="Volver"><span className="material-symbols-outlined">arrow_back</span></Link><h1 className="font-headline-md font-bold">Intercambios</h1></header>
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">{error && <ErrorState message={error} />}
      {characters.isLoading ? <LoadingState /> : !mine ? <p className="text-secondary">Necesitas un personaje para intercambiar. <Link className="text-primary" to={`/campaign/${campaignId}/character/new`}>Crear personaje</Link></p> : <section className="border border-border-low-contrast rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-headline-md">Nueva oferta</h2><StatusBadge status="pending" /></div>
        <div className="grid md:grid-cols-2 gap-4">
          <section aria-label="Tu oferta" className="rounded-lg border border-line p-4 space-y-3">
            <div><span className="mc-eyebrow">Ofreces</span><h3 className="font-label-bold">{mine.name}</h3><p className="text-xs text-muted">Nivel {mine.level} · {mine.gold} po disponibles</p></div>
            <label className="block text-sm font-label-bold">Oro ofrecido<input type="number" min={0} max={mine.gold} value={offeredGold} onChange={(event) => setOfferedGold(Math.min(mine.gold, Math.max(0, Number(event.target.value))))} className={inputClass} /></label>
            <div><h4 className="font-label-bold text-sm mb-1">Tus objetos</h4>{itemChoices(inventory.data, offeredItems, setOfferedItems)}</div>
          </section>
          <section aria-label="Oferta del destinatario" className="rounded-lg border border-line p-4 space-y-3">
            <label className="block text-sm font-label-bold">Destinatario<select value={recipientID} onChange={(event) => { setRecipientID(Number(event.target.value)); setRequestedItems([]); }} className={inputClass}><option value={0}>Selecciona un personaje</option>{characters.data?.filter((character) => character.id !== mine.id).map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
            {recipient && <p className="text-xs text-muted">Nivel {recipient.level}</p>}
            <label className="block text-sm font-label-bold">Oro solicitado<input type="number" min={0} disabled={!askGold} value={askGold ? requestedGold : 0} onChange={(event) => setRequestedGold(Math.max(0, Number(event.target.value)))} className={inputClass} /></label>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={askGold} onChange={(event) => setAskGold(event.target.checked)} />Solicitar oro al destinatario</label>
            <div><h4 className="font-label-bold text-sm mb-1">{recipient ? `Objetos de ${recipient.name}` : 'Objetos solicitados'}</h4>{recipientID ? itemChoices(recipientInventory.data, requestedItems, setRequestedItems) : <p className="text-secondary text-sm">Elige un destinatario.</p>}</div>
          </section>
        </div>
        <div className="flex justify-end"><button type="button" onClick={send} disabled={!recipientID || action.isPending || (!offeredGold && !(askGold && requestedGold) && !offeredItems.length && !requestedItems.length)} className="bg-primary-container text-on-primary-container px-6 py-3 rounded-lg font-label-bold disabled:opacity-50">Enviar oferta</button></div>
      </section>}
      <section><h2 className="font-headline-md mb-3">Ofertas</h2>{offers.isLoading ? <LoadingState /> : offers.error ? <ErrorState message="No se pudieron cargar los intercambios" onRetry={() => void offers.refetch()} /> : campaignOffers.length === 0 ? <p className="text-secondary">No hay intercambios todavía en esta campaña.</p> : <div className="space-y-3">{campaignOffers.map((offer) => <article key={offer.id} className="border border-border-low-contrast rounded-lg p-4"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-label-bold">{characterName(offer.offeror_character_id)} → {characterName(offer.recipient_character_id)}</h3><StatusBadge status={offer.status} /></div><p className="text-sm text-secondary mt-1">Ofrece {offer.offered_gold} po · {itemCount(parseIDs(offer.offered_item_ids).length)}; solicita {offer.requested_gold} po · {itemCount(parseIDs(offer.requested_item_ids).length)}</p>{offer.status === 'pending' && <p className="text-xs text-warn mt-1" aria-live="off">{remaining(offer.expires_at, now)}</p>}{offer.status === 'pending' && <div className="flex gap-2 mt-3">{offer.recipient_character_id === mine?.id ? <><button type="button" onClick={() => action.mutate(() => tradeApi.accept(offer.id))} className="px-3 py-1 rounded bg-primary-container">Aceptar</button><button type="button" onClick={() => action.mutate(() => tradeApi.reject(offer.id))} className="px-3 py-1 rounded border">Rechazar</button><button type="button" onClick={() => action.mutate(() => tradeApi.counter(offer.id, { ...offerData, recipient_character_id: offer.offeror_character_id }))} className="px-3 py-1 rounded border">Contraofertar</button></> : offer.offeror_character_id === mine?.id && <button type="button" onClick={() => action.mutate(() => tradeApi.cancel(offer.id))} className="px-3 py-1 rounded border">Cancelar</button>}</div>}</article>)}</div>}</section>
    </main></div>;
}
