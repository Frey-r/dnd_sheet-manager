import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, contentApi, itemApi } from '../services/api';
import type { Character, InventoryItem } from '../types';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';

type ContentItem = { id: number; name: string; source: string; is_srd: boolean; data?: Record<string, unknown> };

export function InventoryTab() {
  const { campaignId, characterId = '' } = useParams();
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const inventory = useQuery({ queryKey: ['inventory', characterId], queryFn: () => characterApi.inventory(characterId).then((response) => response.data as InventoryItem[]) });
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((response) => response.data as Character) });
  const results = useQuery({ queryKey: ['content-items', query], enabled: adding, queryFn: () => contentApi.search({ type: 'item', query, limit: 50 }).then((response) => response.data.data as ContentItem[]) });
  const refresh = () => client.invalidateQueries({ queryKey: ['inventory', characterId] });
  const mutation = useMutation({ mutationFn: (action: () => Promise<unknown>) => action(), onSuccess: refresh, onError: (reason) => setError(getApiError(reason)) });
  const add = async (summary: ContentItem) => {
    const detail = await contentApi.get(summary.id);
    const data = detail.data.data as Record<string, unknown>;
    await itemApi.add(characterId, { name: summary.name, item_type: String(data.type || 'gear'), rarity: String(data.rarity || 'common'), weight: Number(data.weight || 0), quantity: 1, description: JSON.stringify(data.entries || data.entry || ''), requires_attunement: Boolean(data.reqAttune), is_tradeable: true });
    setAdding(false);
  };
  const items = inventory.data || [];
  const weight = items.reduce((total, item) => total + item.weight * item.quantity, 0);
  return <div className="min-h-screen flex flex-col">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16">
      <div className="flex items-center gap-3"><Link to={`/campaign/${campaignId}/character/${characterId}`} aria-label="Volver"><span className="material-symbols-outlined text-primary">arrow_back</span></Link><h1 className="font-headline-md font-bold">Inventario</h1></div>
      <button type="button" onClick={() => setAdding(true)} className="bg-primary-container text-on-primary-container rounded-lg px-4 py-2 font-label-bold">Añadir objeto</button>
    </header>
    <nav className="bg-surface border-b border-border-low-contrast px-4 flex gap-4 overflow-x-auto"><Link to={`/campaign/${campaignId}/character/${characterId}`} className="py-3 text-secondary whitespace-nowrap">Stats</Link><Link to={`/campaign/${campaignId}/character/${characterId}/spells`} className="py-3 text-secondary whitespace-nowrap">Spells</Link><span className="py-3 border-b-2 border-primary text-primary font-label-bold">Inventory</span><Link to={`/campaign/${campaignId}/character/${characterId}/bio`} className="py-3 text-secondary">Bio</Link></nav>
    <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-4">
      {error && <ErrorState message={error} />}
      {character.data && <section className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-4 flex justify-between items-center"><span className="font-label-bold">Oro</span><input aria-label="Oro" type="number" min={0} key={character.data.gold} defaultValue={character.data.gold} onBlur={(event) => mutation.mutate(() => characterApi.update(characterId, { gold: Number(event.target.value) }))} className="w-28 rounded bg-surface-subtle border-border-low-contrast" /></section>}
      <section><h2 className="font-label-bold mb-3">Equipo y mochila</h2>
        {inventory.isLoading ? <LoadingState /> : inventory.error ? <ErrorState message="No se pudo cargar el inventario" /> : items.length === 0 ? <p className="text-secondary text-center py-10">Mochila vacía</p> : <div className="space-y-2">{items.map((item) => <article key={item.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
          <div className="flex justify-between gap-3"><div><h3 className="font-label-bold">{item.name}</h3><p className="text-sm text-secondary">{item.item_type} · {item.rarity || 'common'} · {item.weight} lb{item.trade_locked ? ' · Reservado en intercambio' : ''}</p></div><input aria-label={`Cantidad de ${item.name}`} type="number" min={0} defaultValue={item.quantity} disabled={item.trade_locked} onBlur={(event) => { const quantity = Number(event.target.value); if (quantity !== item.quantity) mutation.mutate(() => itemApi.update(characterId, item.id, { quantity })); }} className="w-20 h-9 rounded bg-surface-subtle border-border-low-contrast" /></div>
          <div className="flex flex-wrap gap-2 mt-3"><button type="button" disabled={item.trade_locked} onClick={() => mutation.mutate(() => itemApi.equip(characterId, item.id))} className="px-3 py-1 rounded bg-surface-container text-sm disabled:opacity-50">{item.is_equipped ? 'Desequipar' : 'Equipar'}</button><button type="button" disabled={item.trade_locked} onClick={() => mutation.mutate(() => itemApi.remove(characterId, item.id))} className="px-3 py-1 rounded text-hp-danger text-sm disabled:opacity-50">Eliminar</button></div>
        </article>)}</div>}
      </section>
      <footer className="text-sm text-secondary">Peso total: {weight.toFixed(1)} lb{character.data?.carrying_capacity ? ` / ${character.data.carrying_capacity} lb` : ''}</footer>
    </main>
    {adding && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><section className="bg-surface rounded-xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h2 className="font-headline-md">Catálogo completo de objetos</h2><button type="button" aria-label="Cerrar" onClick={() => setAdding(false)}>×</button></div><input aria-label="Buscar objetos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, cualquier fuente…" className="w-full rounded bg-surface-subtle border-border-low-contrast mb-3" />{results.isLoading ? <LoadingState /> : results.data?.map((item) => <button type="button" key={item.id} disabled={mutation.isPending} onClick={() => mutation.mutate(() => add(item))} className="w-full text-left p-3 border-b border-border-low-contrast hover:bg-surface-container"><span className="font-label-bold">{item.name}</span><span className="ml-2 text-xs text-secondary">{item.source}{item.is_srd ? ' · SRD' : ''}</span></button>)}</section></div>}
  </div>;
}
