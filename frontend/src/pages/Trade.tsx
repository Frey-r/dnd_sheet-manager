import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, tradeApi } from '../services/api';
import { useAuth } from '../lib/hooks';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import type { Character, InventoryItem } from '../types';

type Offer = { id: number; offeror_character_id: number; recipient_character_id: number; offered_item_ids: string; requested_item_ids: string; offered_gold: number; requested_gold: number; status: string; expires_at: string };
const parseIDs = (value: string): number[] => { try { const ids = JSON.parse(value) as unknown; return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : []; } catch { return []; } };

export function Trade() {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [recipientID, setRecipientID] = useState(0);
  const [offeredGold, setOfferedGold] = useState(0);
  const [requestedGold, setRequestedGold] = useState(0);
  const [offeredItems, setOfferedItems] = useState<number[]>([]);
  const [requestedItems, setRequestedItems] = useState<number[]>([]);
  const [error, setError] = useState('');
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => characterApi.listByCampaign(campaignId).then((response) => response.data as Character[]) });
  const mine = characters.data?.find((character) => character.user_id === user?.id);
  const inventory = useQuery({ queryKey: ['inventory', mine?.id], enabled: Boolean(mine), queryFn: () => characterApi.inventory(mine!.id).then((response) => response.data as InventoryItem[]) });
  const recipientInventory = useQuery({ queryKey: ['inventory', recipientID], enabled: recipientID > 0, queryFn: () => characterApi.inventory(recipientID).then((response) => response.data as InventoryItem[]) });
  const offers = useQuery({ queryKey: ['trades'], queryFn: () => tradeApi.list().then((response) => response.data as Offer[]) });
  const invalidate = () => { void client.invalidateQueries({ queryKey: ['trades'] }); void client.invalidateQueries({ queryKey: ['inventory'] }); void client.invalidateQueries({ queryKey: ['characters'] }); };
  const action = useMutation({ mutationFn: (operation: () => Promise<unknown>) => operation(), onSuccess: () => { setError(''); invalidate(); }, onError: (reason) => setError(getApiError(reason)) });
  const offerData = { recipient_character_id: recipientID, offered_item_ids: offeredItems, offered_gold: offeredGold, requested_item_ids: requestedItems, requested_gold: requestedGold };
  const send = () => { if (mine && recipientID) action.mutate(() => tradeApi.create(mine.id, offerData)); };
  const toggle = (id: number, selected: number[], choose: (ids: number[]) => void) => choose(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  const itemChoices = (items: InventoryItem[] | undefined, selected: number[], choose: (ids: number[]) => void) => <div className="max-h-48 overflow-y-auto space-y-1">{items?.filter((item) => item.is_tradeable && !item.quest_bound && !item.is_equipped && !item.trade_locked).map((item) => <label key={item.id} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id, selected, choose)} />{item.name} ×{item.quantity}</label>)}{items?.length === 0 && <p className="text-secondary text-sm">No hay objetos disponibles.</p>}</div>;
  const characterName = (id: number) => characters.data?.find((character) => character.id === id)?.name || `#${id}`;
  return <div className="min-h-screen"><header className="h-16 px-4 border-b border-border-low-contrast flex items-center gap-3"><Link to={`/campaign/${campaignId}`} aria-label="Volver"><span className="material-symbols-outlined">arrow_back</span></Link><h1 className="font-headline-md font-bold">Intercambios</h1></header>
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">{error && <ErrorState message={error} />}
      {!mine ? <p className="text-secondary">Necesitas un personaje para intercambiar. <Link className="text-primary" to={`/campaign/${campaignId}/character/new`}>Crear personaje</Link></p> : <section className="border border-border-low-contrast rounded-xl p-5 space-y-4"><h2 className="font-headline-md">Nueva oferta de {mine.name}</h2><label className="block font-label-bold">Destinatario<select value={recipientID} onChange={(event) => { setRecipientID(Number(event.target.value)); setRequestedItems([]); }} className="block mt-1 w-full rounded bg-surface-subtle border-border-low-contrast"><option value={0}>Selecciona un personaje</option>{characters.data?.filter((character) => character.id !== mine.id).map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label><div className="grid grid-cols-2 gap-4"><label>Oro ofrecido<input type="number" min={0} max={mine.gold} value={offeredGold} onChange={(event) => setOfferedGold(Math.max(0, Number(event.target.value)))} className="block mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label><label>Oro solicitado<input type="number" min={0} value={requestedGold} onChange={(event) => setRequestedGold(Math.max(0, Number(event.target.value)))} className="block mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label></div><div className="grid md:grid-cols-2 gap-4"><section><h3 className="font-label-bold mb-2">Objetos que ofrezco</h3>{itemChoices(inventory.data, offeredItems, setOfferedItems)}</section><section><h3 className="font-label-bold mb-2">Objetos que solicito</h3>{recipientID ? itemChoices(recipientInventory.data, requestedItems, setRequestedItems) : <p className="text-secondary text-sm">Elige un destinatario.</p>}</section></div><button type="button" onClick={send} disabled={!recipientID || action.isPending || (!offeredGold && !requestedGold && !offeredItems.length && !requestedItems.length)} className="w-full bg-primary-container text-on-primary-container py-3 rounded-lg font-label-bold disabled:opacity-50">Enviar oferta</button></section>}
      <section><h2 className="font-headline-md mb-3">Ofertas</h2>{offers.isLoading ? <LoadingState /> : offers.data?.length === 0 ? <p className="text-secondary">No hay intercambios todavía.</p> : <div className="space-y-3">{offers.data?.map((offer) => <article key={offer.id} className="border border-border-low-contrast rounded-lg p-4"><div className="flex justify-between gap-3"><h3 className="font-label-bold">{characterName(offer.offeror_character_id)} → {characterName(offer.recipient_character_id)}</h3><span className="text-sm capitalize">{offer.status}</span></div><p className="text-sm text-secondary mt-1">Ofrece {offer.offered_gold} po · {parseIDs(offer.offered_item_ids).length} objetos; solicita {offer.requested_gold} po · {parseIDs(offer.requested_item_ids).length} objetos</p>{offer.status === 'pending' && <div className="flex gap-2 mt-3">{offer.recipient_character_id === mine?.id ? <><button type="button" onClick={() => action.mutate(() => tradeApi.accept(offer.id))} className="px-3 py-1 rounded bg-primary-container">Aceptar</button><button type="button" onClick={() => action.mutate(() => tradeApi.reject(offer.id))} className="px-3 py-1 rounded border">Rechazar</button><button type="button" onClick={() => action.mutate(() => tradeApi.counter(offer.id, { ...offerData, recipient_character_id: offer.offeror_character_id }))} className="px-3 py-1 rounded border">Contraofertar</button></> : offer.offeror_character_id === mine?.id && <button type="button" onClick={() => action.mutate(() => tradeApi.cancel(offer.id))} className="px-3 py-1 rounded border">Cancelar</button>}</div>}</article>)}</div>}</section>
    </main></div>;
}
