/* GM management of shops and their stock (market-bastions.md §3). */
import { useEffect, useState } from 'react';
import { DecimalInput } from '../ui/DecimalInput';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, npcApi } from '../../services/api';
import { vttApi, vttPlayApi } from '../../services/vttApi';
import { searchEquipment, searchMagicItems } from '../../services/srdService';
import { itemCount } from '../../lib/plural';
import {
  ITEM_TYPES, RARITIES, RARITY_PRICE_CP, cpToGP, formatCP, gpToCP, marketApi, rarityLabel, srdCostCP, typeLabel,
  type Availability, type Shop, type ShopInput, type ShopItemInput,
} from '../../services/marketApi';

const field = 'w-full rounded-lg border border-line bg-card-2 px-3 text-[14px] outline-none focus:border-accent';
const label = 'flex flex-col gap-1.5 text-[13px] font-medium';
const errText = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo guardar';

const emptyShop: ShopInput = { name: '', description: '', icon: 'storefront', availability: 'closed', price_pct: 100, buy_rate_pct: 50, buys_types: [], npc_id: null, scene_id: null, object_id: null };

export function ShopManager({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const shops = useQuery({ queryKey: ['shops', campaignId], queryFn: () => marketApi.shops(campaignId) });
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const current = typeof selected === 'number' ? shops.data?.find((s) => s.id === selected) : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-2">
        <button type="button" className="mc-btn mc-btn-primary" onClick={() => setSelected('new')}>
          <span className="material-symbols-outlined text-[18px]">add_business</span>Nueva tienda
        </button>
        {shops.isLoading && <div className="text-muted">Cargando…</div>}
        {shops.data?.length === 0 && <p className="mc-card p-4 text-[13.5px] text-muted">Aún no hay tiendas. Crea una y decide cuándo abre: siempre, nunca o solo en una escena.</p>}
        {shops.data?.map((s) => (
          <button key={s.id} type="button" onClick={() => setSelected(s.id)}
            className={`mc-card flex items-center gap-3 p-3 text-left hover:border-line-strong ${selected === s.id ? 'border-accent' : ''}`}>
            <span className="material-symbols-outlined text-gold">{s.icon || 'storefront'}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{s.name}</span>
              <span className="block truncate text-[12.5px] text-muted">{availabilityText(s)} · {itemCount(s.item_count)}</span>
            </span>
          </button>
        ))}
      </aside>
      <section className="min-w-0">
        {selected === null && <div className="mc-card flex min-h-[200px] items-center justify-center p-8 text-muted">Elige una tienda o crea una nueva.</div>}
        {selected === 'new' && (
          <ShopForm key="new" campaignId={campaignId} initial={emptyShop}
            onSaved={(s) => { void qc.invalidateQueries({ queryKey: ['shops', campaignId] }); setSelected(s.id); }} />
        )}
        {current && (
          <div className="flex flex-col gap-5">
            <ShopForm key={current.id} campaignId={campaignId} shop={current} initial={current}
              onSaved={() => void qc.invalidateQueries({ queryKey: ['shops', campaignId] })}
              onDeleted={() => { void qc.invalidateQueries({ queryKey: ['shops', campaignId] }); setSelected(null); }} />
            <StockEditor campaignId={campaignId} shop={current} />
          </div>
        )}
      </section>
    </div>
  );
}

function availabilityText(s: Shop) {
  if (s.availability === 'open') return 'Abierta';
  if (s.availability === 'closed') return 'Cerrada';
  return s.scene_name ? `En «${s.scene_name}»` : 'Ligada a escena';
}

function ShopForm({ campaignId, shop, initial, onSaved, onDeleted }: {
  campaignId: string; shop?: Shop; initial: ShopInput; onSaved: (s: Shop) => void; onDeleted?: () => void;
}) {
  const [draft, setDraft] = useState<ShopInput>(initial);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const npcs = useQuery({ queryKey: ['npcs', campaignId], queryFn: async () => ((await npcApi.list(campaignId)).data ?? []) as { id: number; name: string }[] });
  const scenes = useQuery({ queryKey: ['vtt-scenes', campaignId], queryFn: () => vttApi.scenes(campaignId) });
  const objects = useQuery({
    queryKey: ['vtt-objects', campaignId, draft.scene_id],
    queryFn: () => vttPlayApi.objects(campaignId, draft.scene_id!),
    enabled: Boolean(draft.scene_id),
  });
  const save = useMutation({
    mutationFn: () => (shop ? marketApi.updateShop(campaignId, shop.id, draft) : marketApi.createShop(campaignId, draft)),
    onSuccess: (s) => { setNotice({ ok: true, text: 'Tienda guardada' }); onSaved(s); },
    onError: (e) => setNotice({ ok: false, text: errText(e) }),
  });
  const remove = useMutation({
    mutationFn: () => marketApi.deleteShop(campaignId, shop!.id),
    onSuccess: () => onDeleted?.(),
    onError: (e) => setNotice({ ok: false, text: errText(e) }),
  });
  const set = (patch: ShopInput) => setDraft({ ...draft, ...patch });
  const toggleType = (t: string) => {
    const cur = draft.buys_types ?? [];
    set({ buys_types: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  };
  const needsScene = draft.availability === 'scene' && !draft.scene_id;

  return (
    <form className="mc-card flex flex-col gap-4 p-5" onSubmit={(e) => { e.preventDefault(); if (draft.name?.trim() && !needsScene) save.mutate(); }}>
      <h2 className="font-display text-[20px]">{shop ? 'Tienda' : 'Nueva tienda'}</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <label className={label}>Nombre
          <input className={`${field} h-10`} value={draft.name ?? ''} maxLength={160} placeholder="Herrería de Brom" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className={label}>Icono
          <select className={`${field} h-10`} value={draft.icon ?? 'storefront'} onChange={(e) => set({ icon: e.target.value })}>
            {[['storefront', 'Tienda'], ['hardware', 'Herrería'], ['science', 'Alquimia'], ['auto_stories', 'Libros'], ['local_bar', 'Taberna'], ['diamond', 'Joyería'], ['pets', 'Establo'], ['auto_fix_high', 'Magia']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className={label}>Descripción
        <textarea className={`${field} min-h-[70px] py-2`} value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
      </label>
      <label className={label}>Tendero (PNJ)
        <select className={`${field} h-10`} value={draft.npc_id ?? ''} onChange={(e) => set({ npc_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— Sin tendero —</option>
          {npcs.data?.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </label>

      <div className={label}>Disponibilidad
        <div className="mc-seg self-start" role="group" aria-label="Disponibilidad">
          {([['open', 'Abierta'], ['scene', 'Con su escena'], ['closed', 'Cerrada']] as [Availability, string][]).map(([v, t]) => (
            <button key={v} type="button" aria-pressed={draft.availability === v} onClick={() => set({ availability: v })}>{t}</button>
          ))}
        </div>
        <span className="font-normal text-muted">
          {draft.availability === 'open' && 'Los jugadores pueden comprar en cualquier momento.'}
          {draft.availability === 'closed' && 'Oculta para los jugadores.'}
          {draft.availability === 'scene' && 'Abre solo mientras su escena está activa en la mesa.'}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Escena {draft.availability === 'scene' && <span className="font-normal text-warn">(obligatoria)</span>}
          <select className={`${field} h-10`} value={draft.scene_id ?? ''} onChange={(e) => set({ scene_id: e.target.value ? Number(e.target.value) : null, object_id: null })}>
            <option value="">— Ninguna —</option>
            {scenes.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className={label}>Mostrador en el mapa
          <select className={`${field} h-10`} value={draft.object_id ?? ''} disabled={!draft.scene_id} onChange={(e) => set({ object_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">— Sin mostrador —</option>
            {objects.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <span className="font-normal text-muted">Con mostrador, el jugador debe acercarse e «Interactuar» para comprar. Crea el objeto en la Mesa (herramienta Objeto).</span>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Precios (% del valor)
          <input type="number" min={1} max={1000} className={`${field} h-10`} value={draft.price_pct ?? 100} onChange={(e) => set({ price_pct: Number(e.target.value) })} />
        </label>
        <label className={label}>Compra a los jugadores (% del valor, 0 = no compra)
          <input type="number" min={0} max={100} className={`${field} h-10`} value={draft.buy_rate_pct ?? 50} onChange={(e) => set({ buy_rate_pct: Number(e.target.value) })} />
        </label>
      </div>
      {(draft.buy_rate_pct ?? 0) > 0 && (
        <div className={label}>Qué compra
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TYPES.map((t) => {
              const on = draft.buys_types?.includes(t.value);
              return <button key={t.value} type="button" aria-pressed={on} onClick={() => toggleType(t.value)}
                className={`mc-badge cursor-pointer ${on ? 'border-accent text-accent' : ''}`}>{t.label}</button>;
            })}
          </div>
          <span className="font-normal text-muted">{draft.buys_types?.length ? 'Solo estos tipos.' : 'Sin marcar: compra de todo.'}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button type="submit" className="mc-btn mc-btn-primary" disabled={!draft.name?.trim() || needsScene || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
        {shop && <button type="button" className="mc-btn mc-btn-danger" onClick={() => { if (window.confirm(`¿Eliminar "${shop.name}" y todo su inventario?`)) remove.mutate(); }}>Eliminar</button>}
        {notice && <span role="status" className={`ml-auto text-[13px] ${notice.ok ? 'text-ok' : 'text-bad'}`}>{notice.text}</span>}
      </div>
    </form>
  );
}

const blankItem: ShopItemInput = { name: '', item_type: 'gear', rarity: 'common', price_cp: 0, weight: 0, description: '', stock: 1, attunement_required: false };

function StockEditor({ campaignId, shop }: { campaignId: string; shop: Shop }) {
  const qc = useQueryClient();
  const key = ['shop-items', campaignId, shop.id];
  const data = useQuery({ queryKey: key, queryFn: () => marketApi.items(campaignId, shop.id) });
  const [editing, setEditing] = useState<{ id?: number; draft: ShopItemInput } | null>(null);
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [recipient, setRecipient] = useState(0);
  const flash = (ok: boolean, text: string) => { setNotice({ ok, text }); setTimeout(() => setNotice(null), 3500); };
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['shops', campaignId] }); };
  // GM shortcut (market-bastions.md §3): hand an item to a player character at list price.
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: async () => ((await characterApi.listByCampaign(campaignId)).data ?? []) as { id: number; name: string }[] });
  const give = useMutation({
    mutationFn: (itemId: number) => marketApi.buy(campaignId, shop.id, itemId, 1, recipient),
    onSuccess: (r) => { refresh(); void qc.invalidateQueries({ queryKey: ['inventory'] }); flash(true, r.message); },
    onError: (e) => flash(false, errText(e)),
  });

  const save = useMutation({
    mutationFn: (e: { id?: number; draft: ShopItemInput }) => (e.id ? marketApi.updateItem(campaignId, e.id, e.draft) : marketApi.createItem(campaignId, shop.id, e.draft)),
    onSuccess: () => { refresh(); setEditing(null); flash(true, 'Objeto guardado'); },
    onError: (e) => flash(false, errText(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => marketApi.deleteItem(campaignId, id),
    onSuccess: () => refresh(),
    onError: (e) => flash(false, errText(e)),
  });

  return (
    <div className="mc-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[18px]">Inventario de la tienda</h3>
        <div className="flex gap-2">
          <button type="button" className="mc-btn mc-btn-sm" onClick={() => setEditing({ draft: { ...blankItem } })}>
            <span className="material-symbols-outlined text-[17px]">add</span>Objeto propio
          </button>
        </div>
      </div>
      <CompendiumPicker query={q} setQuery={setQ} onPick={(draft) => save.mutate({ draft })} />
      {(characters.data?.length ?? 0) > 0 && <label className="flex flex-wrap items-center gap-2 text-[13px] text-muted">Entregar a
        <select className="h-9 rounded-lg border border-line bg-card-2 px-2 text-[14px] text-ink" value={recipient} onChange={(e) => setRecipient(Number(e.target.value))}>
          <option value={0}>Elige un personaje</option>
          {characters.data?.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
        </select>
        <span className="text-faint">Se cobra el precio de lista a su bolsa.</span>
      </label>}
      {notice && <span role="status" className={`text-[13px] ${notice.ok ? 'text-ok' : 'text-bad'}`}>{notice.text}</span>}
      {editing && <ItemForm initial={editing.draft} onCancel={() => setEditing(null)} onSave={(d) => save.mutate({ id: editing.id, draft: d })} busy={save.isPending} />}
      {data.data?.items.length === 0 && <p className="text-[13.5px] text-muted">Sin existencias. Añade objetos propios o búscalos en el compendio.</p>}
      <ul className="divide-y divide-line">
        {data.data?.items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{it.name}</div>
              <div className="text-[12.5px] text-muted">{typeLabel(it.item_type)} · {rarityLabel(it.rarity)}</div>
            </div>
            <span className="font-mono text-[13px] text-gold">{formatCP(it.price_cp)}{shop.price_pct !== 100 && <span className="text-faint"> → {formatCP(it.final_price_cp)}</span>}</span>
            <span className={`mc-badge ${it.stock === 0 ? 'text-bad' : ''}`}>{it.stock === -1 ? '∞' : it.stock}</span>
            <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" disabled={!recipient || it.stock === 0 || give.isPending} title={recipient ? undefined : 'Elige primero a quién entregarlo'} onClick={() => give.mutate(it.id)}>Entregar</button>
            <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => setEditing({ id: it.id, draft: { ...it } })}>Editar</button>
            <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm text-bad" aria-label={`Quitar ${it.name}`} onClick={() => remove.mutate(it.id)}>
              <span className="material-symbols-outlined text-[17px]">delete</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemForm({ initial, onSave, onCancel, busy }: { initial: ShopItemInput; onSave: (d: ShopItemInput) => void; onCancel: () => void; busy: boolean }) {
  const [d, setD] = useState<ShopItemInput>(initial);
  const [gp, setGp] = useState(String(cpToGP(initial.price_cp ?? 0)));
  const unlimited = d.stock === -1;
  return (
    <form className="flex flex-col gap-3 rounded-lg border border-line bg-card-2 p-4" onSubmit={(e) => { e.preventDefault(); if (d.name?.trim()) onSave({ ...d, price_cp: gpToCP(Number(gp) || 0) }); }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_150px_150px]">
        <label className={label}>Nombre<input className={`${field} h-9`} value={d.name ?? ''} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
        <label className={label}>Tipo
          <select className={`${field} h-9`} value={d.item_type} onChange={(e) => setD({ ...d, item_type: e.target.value })}>{ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
        <label className={label}>Rareza
          <select className={`${field} h-9`} value={d.rarity} onChange={(e) => setD({ ...d, rarity: e.target.value })}>{RARITIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={label}>Precio (po)<input type="number" min={0} step="0.01" className={`${field} h-9`} value={gp} onChange={(e) => setGp(e.target.value)} /></label>
        <label className={label}>Existencias
          <input type="number" min={0} className={`${field} h-9`} disabled={unlimited} value={unlimited ? '' : d.stock ?? 1} onChange={(e) => setD({ ...d, stock: Math.max(0, Number(e.target.value)) })} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={unlimited} onChange={(e) => setD({ ...d, stock: e.target.checked ? -1 : 1 })} />Sin límite</label>
        <label className={label}>Peso (lb)<DecimalInput min={0} step="0.1" className={`${field} h-9`} value={d.weight ?? 0} onValueChange={(weight) => setD({ ...d, weight })} /></label>
      </div>
      <label className={label}>Descripción<textarea className={`${field} min-h-[60px] py-2`} value={d.description ?? ''} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={Boolean(d.attunement_required)} onChange={(e) => setD({ ...d, attunement_required: e.target.checked })} />Requiere sintonía</label>
      <div className="flex gap-2">
        <button type="submit" className="mc-btn mc-btn-primary mc-btn-sm" disabled={busy || !d.name?.trim()}>Guardar objeto</button>
        <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

interface Pick { key: string; name: string; sub: string; draft: ShopItemInput }

function CompendiumPicker({ query, setQuery, onPick }: { query: string; setQuery: (q: string) => void; onPick: (d: ShopItemInput) => void }) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  const results = useQuery({
    queryKey: ['shop-compendium', debounced],
    enabled: debounced.length >= 2,
    queryFn: async (): Promise<Pick[]> => {
      const [eq, mi] = await Promise.all([searchEquipment({ query: debounced, limit: 8 }), searchMagicItems({ query: debounced, limit: 8 })]);
      const equip: Pick[] = (eq.data ?? []).map((e) => {
        const kind = /weapon|arma/i.test(e.category) ? 'weapon' : /armor|armadura|shield/i.test(e.category) ? 'armor' : /ammun/i.test(e.category) ? 'ammunition' : 'gear';
        const price = srdCostCP(e.cost_gp, e.cost_unit);
        return { key: `e${e.id}`, name: e.name, sub: `${e.category || 'Equipo'} · ${price ? formatCP(price) : 'sin precio'}`,
          draft: { name: e.name, item_type: kind, rarity: 'common', price_cp: price, weight: e.weight || 0, description: (e.description || '').slice(0, 600), srd_ref_id: e.id, srd_kind: 'equipment', stock: 1 } };
      });
      const magic: Pick[] = (mi.data ?? []).map((m) => {
        const rarity = (m.rarity || 'uncommon').toLowerCase().replace(' ', '_');
        const price = RARITY_PRICE_CP[rarity] ?? 0;
        return { key: `m${m.id}`, name: m.name, sub: `Objeto mágico · ${rarityLabel(rarity)} · ${price ? formatCP(price) : 'sin precio'}`,
          draft: { name: m.name, item_type: 'magic_item', rarity, price_cp: price, weight: 0, description: (m.description || '').slice(0, 600), attunement_required: m.requires_attunement, srd_ref_id: m.id, srd_kind: 'magic_item', stock: 1 } };
      });
      return [...equip, ...magic];
    },
  });
  return (
    <div className="flex flex-col gap-2">
      <input className={`${field} h-10`} placeholder="Añadir desde el compendio: escribe «espada», «poción»…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {debounced.length >= 2 && (
        <ul className="max-h-64 overflow-y-auto rounded-lg border border-line">
          {results.isLoading && <li className="p-3 text-[13px] text-muted">Buscando…</li>}
          {results.data?.length === 0 && <li className="p-3 text-[13px] text-muted">Sin resultados.</li>}
          {results.data?.map((r) => (
            <li key={r.key} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
              <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{r.name}</div><div className="truncate text-[12px] text-muted">{r.sub}</div></div>
              <button type="button" className="mc-btn mc-btn-sm" onClick={() => onPick(r.draft)}>Añadir</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

