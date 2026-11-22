import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketApi, formatCP, gpToCP, cpToGP, type NPCItem } from '../../services/marketApi';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState } from '../ui/Feedback';

type Draft = { id?: number; name: string; quantity: string; value_gp: string; description: string; location: 'inventory' | 'home'; source: string };
const EMPTY: Draft = { name: '', quantity: '1', value_gp: '', description: '', location: 'inventory', source: '' };
const LOCATIONS: Record<Draft['location'], string> = { inventory: 'Lo lleva encima', home: 'En su casa' };
const field = 'w-full rounded bg-surface-subtle border border-border-low-contrast px-3 h-10';

const toDraft = (item: NPCItem): Draft => ({ id: item.id, name: item.name, quantity: String(item.quantity), value_gp: item.value_cp != null ? String(cpToGP(item.value_cp)) : '', description: item.description, location: item.location, source: item.source });

/** GM view of what an NPC owns: carried items and items kept at home (market-bastions.md §5). */
export function NPCBelongings({ campaignId, npcId }: { campaignId: string; npcId: number }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const key = ['npc-items', campaignId, npcId];
  const items = useQuery({ queryKey: key, queryFn: () => marketApi.npcItems(campaignId, npcId) });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: (value: Draft) => marketApi.saveNpcItem(campaignId, npcId, {
      id: value.id, name: value.name.trim(), quantity: Math.max(1, Number(value.quantity) || 1),
      value_cp: value.value_gp.trim() === '' ? null : gpToCP(Number(value.value_gp)),
      description: value.description, location: value.location, source: value.source.trim(),
    }),
    onSuccess: () => { setDraft(null); void refresh(); },
  });
  const remove = useMutation({ mutationFn: (id: number) => marketApi.deleteNpcItem(campaignId, id), onSuccess: () => void refresh() });

  const list = items.data ?? [];
  return <article className="border border-border-low-contrast rounded-xl p-5 space-y-3" aria-labelledby="npc-belongings-title">
    <div className="flex items-center justify-between gap-3"><h2 id="npc-belongings-title" className="font-headline-md">Pertenencias</h2>{!draft && <button type="button" onClick={() => setDraft(EMPTY)} className="px-3 py-1 rounded border text-sm font-label-bold">Añadir objeto</button>}</div>
    {items.isLoading ? <LoadingState /> : items.error ? <ErrorState message={getApiError(items.error, 'No se pudieron cargar sus pertenencias')} onRetry={() => void items.refetch()} /> : list.length === 0 && !draft ? <p className="text-secondary text-sm">Este PNJ no tiene objetos registrados.</p> : null}
    {(['inventory', 'home'] as const).map((location) => {
      const group = list.filter((item) => item.location === location);
      if (!group.length) return null;
      return <section key={location}><h3 className="font-label-bold text-sm text-secondary mb-1">{LOCATIONS[location]}</h3><ul className="divide-y divide-border-low-contrast">{group.map((item) => <li key={item.id} className="py-2 flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-label-bold">{item.name} ×{item.quantity}</p><p className="text-xs text-secondary">{item.value_cp != null ? formatCP(item.value_cp) : 'Sin tasar'}{item.source ? ` · ${item.source}` : ''}</p>{item.description && <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{item.description}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => setDraft(toDraft(item))} className="px-2 py-1 rounded border text-xs">Editar</button><button type="button" disabled={remove.isPending} onClick={() => { if (window.confirm(`¿Quitar ${item.name}?`)) remove.mutate(item.id); }} className="px-2 py-1 rounded border border-error text-error text-xs disabled:opacity-50">Quitar</button></div></li>)}</ul></section>;
    })}
    {draft && <form className="space-y-3 border-t border-border-low-contrast pt-3" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) save.mutate(draft); }}>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm font-label-bold sm:col-span-2">Nombre<input className={field} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
        <label className="text-sm font-label-bold">Cantidad<input type="number" min={1} className={field} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></label>
        <label className="text-sm font-label-bold">Valor (po)<input type="number" min={0} step="0.01" className={field} value={draft.value_gp} onChange={(event) => setDraft({ ...draft, value_gp: event.target.value })} placeholder="Sin tasar" /></label>
        <label className="text-sm font-label-bold">Ubicación<select className={field} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value as Draft['location'] })}>{Object.entries(LOCATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-label-bold">Procedencia<input className={field} value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="Comprado en…" /></label>
      </div>
      <label className="text-sm font-label-bold block">Descripción<textarea rows={2} className="w-full rounded bg-surface-subtle border border-border-low-contrast p-3" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      {save.error && <ErrorState message={getApiError(save.error, 'No se pudo guardar el objeto')} />}
      <div className="flex gap-3"><button type="submit" disabled={save.isPending || !draft.name.trim()} className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">{save.isPending ? 'Guardando…' : 'Guardar'}</button><button type="button" onClick={() => { setDraft(null); save.reset(); }} className="px-4 py-2 rounded-lg border font-label-bold">Cancelar</button></div>
    </form>}
    {remove.error && <ErrorState message={getApiError(remove.error, 'No se pudo quitar el objeto')} />}
  </article>;
}
