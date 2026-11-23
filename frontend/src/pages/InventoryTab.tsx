import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, contentApi, itemApi } from '../services/api';
import type { Character, InventoryItem } from '../types';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { CharacterTabs } from '../components/character/CharacterTabs';
import { OfficialItem } from '../components/character/OfficialData';
import { catalogItemDescription, catalogItemType, catalogRarity } from '../lib/catalogItem';
import { FoundryAuthorityNotice } from '../components/foundry/FoundryAuthorityNotice';
import { useCampaign } from '../lib/useCampaign';

type ContentItem = { id: number; name: string; source: string; is_srd: boolean; data?: Record<string, unknown> };

const MAX_ATTUNED = 3;
const SLOTS: [string, string][] = [
  ['head', 'Cabeza'], ['neck', 'Cuello'], ['chest', 'Pecho'], ['hands', 'Manos'],
  ['main_hand', 'Mano principal'], ['off_hand', 'Mano secundaria'], ['ring', 'Anillo'], ['feet', 'Pies'],
];
const RARITY: Record<string, { label: string; className: string }> = {
  common: { label: 'Común', className: 'bg-card-3 text-rar-common' },
  uncommon: { label: 'Poco común', className: 'bg-ok-soft text-rar-uncommon' },
  rare: { label: 'Raro', className: 'bg-info-soft text-rar-rare' },
  very_rare: { label: 'Muy raro', className: 'bg-rar-very-rare-soft text-rar-very-rare' },
  legendary: { label: 'Legendario', className: 'bg-gold-soft text-rar-legendary' },
};
const CONSUMABLE = new Set(['potion', 'scroll']);
const rarityOf = (item: InventoryItem) => RARITY[item.rarity || 'common'] ?? RARITY.common;

export function InventoryTab() {
  const { campaignId, characterId = '' } = useParams();
  const { isFoundry } = useCampaign(campaignId);
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [official, setOfficial] = useState<Record<number, boolean>>({});
  const inventory = useQuery({ queryKey: ['inventory', characterId], queryFn: () => characterApi.inventory(characterId).then((response) => response.data as InventoryItem[]) });
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((response) => response.data as Character) });
  const results = useQuery({ queryKey: ['content-items', query], enabled: adding, queryFn: () => contentApi.search({ type: 'item', query, limit: 50 }).then((response) => response.data.data as ContentItem[]) });
  const refresh = () => client.invalidateQueries({ queryKey: ['inventory', characterId] });
  const mutation = useMutation({ mutationFn: (action: () => Promise<unknown>) => action(), onSuccess: () => { setError(''); void client.invalidateQueries({ queryKey: ['character', characterId] }); return refresh(); }, onError: (reason) => setError(getApiError(reason)) });
  const add = async (summary: ContentItem) => {
    const detail = await contentApi.get(summary.id);
    const data = detail.data.data as Record<string, unknown>;
    await itemApi.add(characterId, { name: summary.name, item_type: catalogItemType(data), rarity: catalogRarity(data.rarity), weight: Number(data.weight || 0), quantity: 1, description: catalogItemDescription(data), requires_attunement: Boolean(data.reqAttune), is_tradeable: true, content_id: summary.id });
    setAdding(false);
  };
  const use = (item: InventoryItem) => mutation.mutate(() => item.quantity <= 1 ? itemApi.remove(characterId, item.id) : itemApi.update(characterId, item.id, { quantity: item.quantity - 1 }));
  const items = inventory.data || [];
  const weight = items.reduce((total, item) => total + item.weight * item.quantity, 0);
  const capacity = character.data?.carrying_capacity ?? 0;
  const weightRatio = capacity > 0 ? weight / capacity : 0;
  const weightTone = weightRatio > 1 ? 'bg-bad' : weightRatio > 0.66 ? 'bg-warn' : 'bg-ok';
  const equipped = items.filter((item) => item.is_equipped);
  const attunable = items.filter((item) => item.requires_attunement);
  const attunedCount = items.filter((item) => item.is_attuned).length;
  const slotted = (slot: string) => equipped.find((item) => item.slot_type === slot);

  const itemCard = (item: InventoryItem) => {
    const rarity = rarityOf(item);
    return <article key={item.id} className="bg-surface-container-lowest border border-border-low-contrast rounded-lg p-4">
      <div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="font-label-bold flex flex-wrap items-center gap-2">{item.name}<span className={`mc-badge ${rarity.className}`}>{rarity.label}</span>{item.is_attuned && <span className="mc-badge bg-info-soft text-info">Sintonizado</span>}</h3><p className="text-sm text-secondary">{item.item_type} · {item.weight} lb{item.trade_locked ? ' · Reservado en intercambio' : ''}</p>{item.description && <p className="text-xs text-on-surface-variant whitespace-pre-line line-clamp-3 mt-1">{item.description}</p>}{item.srd_ref_id ? <details className="mt-1 text-xs" onToggle={(event) => { const open = event.currentTarget.open; setOfficial((previous) => ({ ...previous, [item.id]: open })); }}><summary className="cursor-pointer text-primary">Datos oficiales</summary>{official[item.id] && <OfficialItem id={item.srd_ref_id} />}</details> : null}</div><input aria-label={`Cantidad de ${item.name}`} type="number" min={0} defaultValue={item.quantity} disabled={item.trade_locked} onBlur={(event) => { const quantity = Number(event.target.value); if (quantity !== item.quantity) mutation.mutate(() => itemApi.update(characterId, item.id, { quantity })); }} className="w-20 h-9 rounded bg-surface-subtle border-border-low-contrast" /></div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {CONSUMABLE.has(item.item_type) && <button type="button" disabled={item.trade_locked || mutation.isPending} onClick={() => use(item)} className="px-3 py-1 rounded bg-primary-container text-on-primary-container text-sm disabled:opacity-50">Usar</button>}
        <button type="button" disabled={item.trade_locked} onClick={() => mutation.mutate(() => itemApi.equip(characterId, item.id))} className="px-3 py-1 rounded bg-surface-container text-sm disabled:opacity-50">{item.is_equipped ? 'Desequipar' : 'Equipar'}</button>
        {item.is_equipped && <select aria-label={`Ranura de ${item.name}`} value={item.slot_type || ''} onChange={(event) => mutation.mutate(() => itemApi.update(characterId, item.id, { slot_type: event.target.value }))} className="h-8 rounded bg-surface-subtle border-border-low-contrast text-sm"><option value="">Sin ranura</option>{SLOTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
        <button type="button" disabled={item.trade_locked} onClick={() => mutation.mutate(() => itemApi.remove(characterId, item.id))} className="px-3 py-1 rounded text-hp-danger text-sm disabled:opacity-50">Eliminar</button>
      </div>
    </article>;
  };

  return <div className="min-h-screen flex flex-col">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16">
      <div className="flex items-center gap-3"><Link to={`/campaign/${campaignId}/character/${characterId}`} aria-label="Volver"><span className="material-symbols-outlined text-primary">arrow_back</span></Link><h1 className="font-headline-md font-bold">Inventario</h1></div>
      <button type="button" onClick={() => setAdding(true)} className="bg-primary-container text-on-primary-container rounded-lg px-4 py-2 font-label-bold">Añadir objeto</button>
    </header>
    <CharacterTabs campaignId={campaignId} characterId={characterId} active="inventory" />
    <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-6">
      {error && <ErrorState message={error} />}
      <FoundryAuthorityNotice isFoundry={isFoundry} />
      {character.data && <section aria-label="Monedas" className="bg-surface-container-lowest border border-border-low-contrast rounded-xl p-4 grid grid-cols-3 gap-3">{([['gold', 'Oro (po)'], ['silver', 'Plata (pp)'], ['copper', 'Cobre (pc)']] as const).map(([coin, label]) => { const amount = character.data?.[coin] ?? 0; return <label key={coin} className="text-sm font-label-bold">{label}<input aria-label={label} type="number" min={0} key={`${coin}-${amount}`} defaultValue={amount} onBlur={(event) => { const value = Math.max(0, Math.floor(Number(event.target.value) || 0)); if (value !== amount) mutation.mutate(() => characterApi.update(characterId, { [coin]: value })); }} className="block mt-1 w-full rounded bg-surface-subtle border-border-low-contrast" /></label>; })}</section>}
      {inventory.isLoading ? <LoadingState /> : inventory.error ? <ErrorState message="No se pudo cargar el inventario" onRetry={() => void inventory.refetch()} /> : <>
        <section aria-label="Equipo"><h2 className="font-label-bold mb-3">Equipo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{SLOTS.map(([slot, label]) => { const item = slotted(slot); return <div key={slot} className={`rounded-lg border p-2 min-h-[72px] ${item ? 'border-accent-line bg-accent-soft' : 'border-dashed border-line'}`}><span className="block text-[11px] uppercase tracking-wide text-muted">{label}</span>{item ? <><span className="block text-sm font-semibold truncate">{item.name}</span><span className={`mc-badge ${rarityOf(item).className}`}>{rarityOf(item).label}</span></> : <span className="block text-xs text-faint mt-1">Vacío</span>}</div>; })}</div>
        </section>
        <section aria-label="Sintonización"><h2 className="font-label-bold mb-3">Objetos sintonizados <span className={attunedCount >= MAX_ATTUNED ? 'text-warn' : 'text-muted'}>({attunedCount}/{MAX_ATTUNED})</span></h2>
          {attunable.length === 0 ? <p className="text-sm text-secondary">Ningún objeto requiere sintonización.</p> : <div className="space-y-2">{attunable.map((item) => <label key={item.id} className="flex items-center gap-3 rounded-lg border border-line p-3 text-sm"><input type="checkbox" checked={item.is_attuned} disabled={item.trade_locked || (!item.is_attuned && attunedCount >= MAX_ATTUNED)} onChange={() => mutation.mutate(() => itemApi.update(characterId, item.id, { is_attuned: !item.is_attuned }))} /><span className="grow">{item.name}</span><span className={`mc-badge ${rarityOf(item).className}`}>{rarityOf(item).label}</span></label>)}</div>}
          {attunedCount >= MAX_ATTUNED && <p className="mt-2 text-xs text-warn">Has alcanzado el máximo de {MAX_ATTUNED} objetos sintonizados.</p>}
        </section>
        <section><h2 className="font-label-bold mb-3">Mochila</h2>
          {items.length === 0 ? <p className="text-secondary text-center py-10">Mochila vacía</p> : <div className="space-y-2">{items.map(itemCard)}</div>}
        </section>
      </>}
    </main>
    <footer className="sticky bottom-0 z-30 border-t border-border-low-contrast bg-surface px-4 py-3">
      <div className="max-w-3xl mx-auto"><div className="flex justify-between text-sm mb-1"><span className="text-secondary">Peso</span><span className={weightRatio > 1 ? 'text-bad font-semibold' : ''}>{weight.toFixed(1)}{capacity ? ` / ${capacity}` : ''} lb</span></div>
        <div role="progressbar" aria-label="Peso transportado" aria-valuemin={0} aria-valuemax={capacity || undefined} aria-valuenow={Math.round(weight)} className="h-2 rounded-full bg-card-3 overflow-hidden"><div className={`h-full rounded-full transition-[width] ${weightTone}`} style={{ width: `${Math.min(100, weightRatio * 100)}%` }} /></div></div>
    </footer>
    {adding && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><section className="bg-surface rounded-xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h2 className="font-headline-md">Catálogo completo de objetos</h2><button type="button" aria-label="Cerrar" onClick={() => setAdding(false)}>×</button></div><input aria-label="Buscar objetos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, cualquier fuente…" className="w-full rounded bg-surface-subtle border-border-low-contrast mb-3" />{results.isLoading ? <LoadingState /> : results.data?.map((item) => <button type="button" key={item.id} disabled={mutation.isPending} onClick={() => mutation.mutate(() => add(item))} className="w-full text-left p-3 border-b border-border-low-contrast hover:bg-surface-container"><span className="font-label-bold">{item.name}</span><span className="ml-2 text-xs text-secondary">{item.source}{item.is_srd ? ' · SRD' : ''}</span></button>)}</section></div>}
  </div>;
}
