/* One Bastion: facilities, orders, construction, hirelings, defenders, warehouse and log
   (market-bastions.md §6). Owners and the GM see it; only the owner gives orders and sells. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/hooks';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { formatCP } from '../../services/marketApi';
import {
  BASIC_BUILD, BASIC_KINDS, ENLARGE, SIZES, bastionApi, orderLabel, sizeLabel,
  type BastionDetail, type BastionSize, type CatalogEntry, type Facility, type FacilityRequest, type WarehouseItem,
} from '../../services/bastionApi';

const field = 'w-full rounded-lg border border-line bg-card-2 px-3 text-[14px] outline-none focus:border-accent';
const label = 'flex flex-col gap-1.5 text-[13px] font-medium';
const kindLabel = (k: string) => BASIC_KINDS.find((b) => b.value === k)?.label ?? k;

type Notice = { ok: boolean; text: string } | null;

export function BastionView({ campaignId, bastionId, isGM }: { campaignId: string; bastionId: number; isGM: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['bastion', campaignId, bastionId];
  const query = useQuery({ queryKey: key, queryFn: () => bastionApi.get(campaignId, bastionId) });
  const [notice, setNotice] = useState<Notice>(null);
  const flash = (n: NonNullable<Notice>) => { setNotice(n); setTimeout(() => setNotice(null), 5000); };
  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ['bastions', campaignId] });
    void qc.invalidateQueries({ queryKey: ['characters', campaignId] });
  };
  const onDetail = (d: BastionDetail, text?: string) => {
    qc.setQueryData(key, d);
    refreshAll();
    if (text) flash({ ok: true, text });
  };
  const onError = (e: unknown) => flash({ ok: false, text: getApiError(e) });

  const addFacility = useMutation({ mutationFn: (r: FacilityRequest) => bastionApi.addFacility(campaignId, bastionId, r), onSuccess: (d) => onDetail(d, 'Instalación registrada'), onError });
  const removeFacility = useMutation({
    mutationFn: (id: number) => bastionApi.deleteFacility(campaignId, id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); refreshAll(); },
    onError,
  });
  const order = useMutation({
    mutationFn: (v: { id: number; order: string; option: string }) => bastionApi.order(campaignId, v.id, v.order, v.option),
    onSuccess: (d) => onDetail(d, 'Orden registrada para el próximo turno'),
    onError,
  });
  const sell = useMutation({
    mutationFn: (v: { id: number; qty: number }) => bastionApi.sell(campaignId, bastionId, v.id, v.qty),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: key }); refreshAll(); flash({ ok: true, text: r.message }); },
    onError,
  });
  const take = useMutation({
    mutationFn: (v: { id: number; qty: number }) => bastionApi.take(campaignId, bastionId, v.id, v.qty),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: key }); refreshAll(); flash({ ok: true, text: r.message }); },
    onError,
  });
  const rename = useMutation({
    mutationFn: (v: { name: string; description: string }) => bastionApi.update(campaignId, bastionId, v),
    onSuccess: (d) => onDetail(d, 'Bastión guardado'),
    onError,
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={getApiError(query.error, 'No se pudo cargar el bastión')} onRetry={() => void query.refetch()} />;

  const { bastion: b, catalog, special_slots: slots, special_used: used } = query.data;
  const isOwner = user?.id === b.owner_user_id;
  const basic = b.facilities.filter((f) => f.kind === 'basic');
  const special = b.facilities.filter((f) => f.kind === 'special');
  const busy = addFacility.isPending || order.isPending || sell.isPending || take.isPending || removeFacility.isPending;

  return (
    <div className="flex flex-col gap-5">
      <HeaderCard name={b.name} description={b.description} owner={b.character_name} level={b.character_level} onSave={(v) => rename.mutate(v)} saving={rename.isPending} />
      {notice && <p role="status" className={`mc-card p-3 text-[13.5px] ${notice.ok ? 'text-ok' : 'text-bad'}`}>{notice.text}</p>}

      <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="basic-h">
        <h3 id="basic-h" className="font-display text-[18px]">Instalaciones básicas</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {basic.map((f) => {
            const next = ENLARGE[f.size];
            const building = b.construction.some((c) => c.facility_id === f.id);
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border border-line bg-card-2 p-3">
                <span className="material-symbols-outlined text-gold">cottage</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.name}</span>
                  <span className="block text-[12.5px] text-muted">{sizeLabel(f.size)} · {SIZES.find((s) => s.value === f.size)?.squares} casillas</span>
                </span>
                {next && (isOwner || isGM) && (
                  <button type="button" className="mc-btn mc-btn-sm" disabled={busy || building}
                    title={`${next.gp.toLocaleString('es')} po · ${next.days} días`}
                    onClick={() => addFacility.mutate({ type: 'enlarge', facility_id: f.id })}>
                    {building ? 'En obras' : `Ampliar a ${sizeLabel(next.to).toLowerCase()}`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {(isOwner || isGM) && <AddBasic busy={busy} isGM={isGM} onAdd={(r) => addFacility.mutate(r)} />}
        {b.construction.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <h4 className="text-[13px] font-semibold text-muted">Obras en curso</h4>
            {b.construction.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 text-[13.5px]">
                <div className="flex justify-between gap-2">
                  <span>{c.kind === 'enlarge' ? `Ampliación a ${sizeLabel(c.target_size).toLowerCase()}` : `${kindLabel(c.basic_kind)} (${sizeLabel(c.target_size).toLowerCase()})`}</span>
                  <span className="font-mono text-muted">{c.days_left} / {c.total_days} días</span>
                </div>
                <progress className="h-1.5 w-full accent-[var(--accent)]" max={c.total_days} value={c.total_days - c.days_left} aria-label="Progreso de la obra" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="special-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="special-h" className="font-display text-[18px]">Instalaciones especiales</h3>
          <span className="text-[13px] text-muted">{used} de {slots} espacios a nivel {b.character_level}</span>
        </div>
        {special.length === 0 && <p className="text-[13.5px] text-muted">Todavía no hay instalaciones especiales.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {special.map((f) => (
            <SpecialCard key={f.id} facility={f} canOrder={isOwner} canRemove={isOwner || isGM} busy={busy}
              onOrder={(o, opt) => order.mutate({ id: f.id, order: o, option: opt })}
              onRemove={() => { if (window.confirm(`¿Eliminar «${f.name}» y sus empleados?`)) removeFacility.mutate(f.id); }} />
          ))}
        </div>
        {(isOwner || isGM) && (
          <AddSpecial catalog={catalog} level={b.character_level} isGM={isGM} full={!isGM && used >= slots} busy={busy}
            onAdd={(id) => addFacility.mutate({ type: 'special', catalog_id: id })} />
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="mc-card flex flex-col gap-2 p-5" aria-labelledby="hire-h">
          <h3 id="hire-h" className="font-display text-[18px]">Empleados ({b.hirelings.length})</h3>
          {b.hirelings.length === 0 ? <p className="text-[13.5px] text-muted">Sin empleados.</p> : (
            <ul className="text-[13.5px] text-ink-2">{b.hirelings.map((h) => <li key={h.id}>{h.name}</li>)}</ul>
          )}
        </section>
        <section className="mc-card flex flex-col gap-2 p-5" aria-labelledby="def-h">
          <h3 id="def-h" className="font-display text-[18px]">Defensores ({b.defenders.length})</h3>
          {b.defenders.length === 0 ? <p className="text-[13.5px] text-muted">Sin defensores. Recluta con una orden.</p> : (
            <ul className="max-h-40 overflow-y-auto text-[13.5px] text-ink-2">{b.defenders.map((d) => <li key={d.id}>{d.name} <span className="text-faint">· {d.source}</span></li>)}</ul>
          )}
        </section>
      </div>

      <Warehouse items={b.warehouse} isOwner={isOwner} busy={busy}
        onSell={(id, qty) => sell.mutate({ id, qty })} onTake={(id, qty) => take.mutate({ id, qty })} />

      <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="log-h">
        <h3 id="log-h" className="font-display text-[18px]">Registro de turnos</h3>
        {b.log.length === 0 && <p className="text-[13.5px] text-muted">Aún no ha pasado ningún turno de bastión.</p>}
        {b.log.map((l) => (
          <div key={l.id} className="rounded-lg border border-line bg-card-2 p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
              <b className="text-ink">Turno {l.turn_number}</b>
              <span>{new Date(l.created_at).toLocaleDateString('es')}</span>
              {l.event_name && <span className="mc-badge">{l.event_name}</span>}
            </div>
            <ul className="list-disc pl-5 text-[13.5px]">{l.entries.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function HeaderCard({ name, description, owner, level, onSave, saving }: {
  name: string; description: string; owner: string; level: number; onSave: (v: { name: string; description: string }) => void; saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name, description });
  if (editing) {
    return (
      <form className="mc-card flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); if (draft.name.trim()) { onSave(draft); setEditing(false); } }}>
        <label className={label}>Nombre
          <input className={`${field} h-10`} value={draft.name} maxLength={160} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className={label}>Descripción
          <textarea className={`${field} min-h-[70px] py-2`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="mc-btn mc-btn-primary" disabled={saving || !draft.name.trim()}>Guardar</button>
          <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      </form>
    );
  }
  return (
    <div className="mc-card flex flex-wrap items-start justify-between gap-3 p-5">
      <div>
        <div className="mc-eyebrow">Bastión de {owner} · nivel {level}</div>
        <h2 className="font-display text-[24px] leading-tight">{name}</h2>
        {description && <p className="mt-1 max-w-prose text-[14px] text-muted">{description}</p>}
      </div>
      <button type="button" className="mc-btn mc-btn-sm" onClick={() => { setDraft({ name, description }); setEditing(true); }}>Editar</button>
    </div>
  );
}

function AddBasic({ busy, isGM, onAdd }: { busy: boolean; isGM: boolean; onAdd: (r: FacilityRequest) => void }) {
  const [kind, setKind] = useState('bedroom');
  const [size, setSize] = useState<BastionSize>('cramped');
  const spec = BASIC_BUILD[size];
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
      <label className={label}>Nueva instalación básica
        <select className={`${field} h-10`} value={kind} onChange={(e) => setKind(e.target.value)}>
          {BASIC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </label>
      <label className={label}>Tamaño
        <select className={`${field} h-10`} value={size} onChange={(e) => setSize(e.target.value as BastionSize)}>
          {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label} ({s.squares} casillas)</option>)}
        </select>
      </label>
      <button type="button" className="mc-btn" disabled={busy} onClick={() => onAdd({ type: 'basic', basic_kind: kind, size })}>
        Construir{isGM ? ' (gratis)' : ` · ${spec.gp.toLocaleString('es')} po`} · {spec.days} días
      </button>
    </div>
  );
}

function AddSpecial({ catalog, level, isGM, full, busy, onAdd }: {
  catalog: CatalogEntry[]; level: number; isGM: boolean; full: boolean; busy: boolean; onAdd: (id: number) => void;
}) {
  const options = catalog.filter((e) => isGM || e.min_level <= level);
  const [id, setId] = useState('');
  const chosen = options.find((e) => String(e.id) === id);
  if (full) return <p className="border-t border-line pt-3 text-[13px] text-muted">No quedan espacios de instalación especial a este nivel.</p>;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className={`${label} min-w-[220px] flex-1`}>Añadir instalación especial
          <select className={`${field} h-10`} value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">— Elige una —</option>
            {options.map((e) => <option key={e.id} value={e.id}>{e.name} (nivel {e.min_level})</option>)}
          </select>
        </label>
        <button type="button" className="mc-btn mc-btn-primary" disabled={busy || !chosen} onClick={() => chosen && onAdd(chosen.id)}>Añadir sin coste</button>
      </div>
      {chosen && (
        <p className="text-[13px] text-muted">
          {chosen.description}{chosen.prerequisite && <> <b className="text-warn">Requisito:</b> {chosen.prerequisite}. El DM lo confirma.</>}
        </p>
      )}
    </div>
  );
}

function SpecialCard({ facility: f, canOrder, canRemove, busy, onOrder, onRemove }: {
  facility: Facility; canOrder: boolean; canRemove: boolean; busy: boolean; onOrder: (order: string, option: string) => void; onRemove: () => void;
}) {
  const [order, setOrder] = useState('maintain');
  const [option, setOption] = useState('');
  const orders = f.orders ?? [];
  const opts = (f.options ?? []).filter((o) => o.order === order);
  const chosen = opts.find((o) => o.id === option);
  const active = f.order_name && f.order_name !== 'maintain' ? f.order_option : null;
  const progressed = active ? f.turns_left < Math.max(active.turns, 1) : false;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line bg-card-2 p-4">
      <header className="flex items-start gap-2">
        <span className="material-symbols-outlined text-gold">domain</span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold">{f.name}</h4>
          <p className="text-[12.5px] text-muted">{sizeLabel(f.size)}{f.description ? ` · ${f.description}` : ''}</p>
        </div>
        {canRemove && <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onRemove} aria-label={`Eliminar ${f.name}`}>
          <span className="material-symbols-outlined text-[18px]">delete</span></button>}
      </header>
      <div className="rounded-md border border-line px-3 py-2 text-[13.5px]">
        {active ? (
          <><b>{orderLabel(f.order_name)}:</b> {active.name} <span className="text-muted">· {f.turns_left} {f.turns_left === 1 ? 'turno' : 'turnos'} restantes</span></>
        ) : f.order_name === 'maintain' ? <b>Mantener</b> : <span className="text-muted">Sin orden (cuenta como Mantener)</span>}
      </div>
      {canOrder && (progressed ? <p className="text-[12.5px] text-muted">La orden está en curso: termina en {f.turns_left} turnos.</p> : (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={label}>Orden
              <select className={`${field} h-9`} value={order} onChange={(e) => { setOrder(e.target.value); setOption(''); }}>
                <option value="maintain">Mantener</option>
                {orders.map((o) => <option key={o} value={o}>{orderLabel(o)}</option>)}
              </select>
            </label>
            {order !== 'maintain' && (
              <label className={label}>Opción
                <select className={`${field} h-9`} value={option} onChange={(e) => setOption(e.target.value)}>
                  <option value="">— Elige —</option>
                  {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {chosen && <p className="text-[12.5px] text-muted">{chosen.description} Coste {formatCP(chosen.cost_cp)} · {chosen.turns} {chosen.turns === 1 ? 'turno' : 'turnos'}.</p>}
          <button type="button" className="mc-btn mc-btn-sm self-start" disabled={busy || (order !== 'maintain' && !chosen)} onClick={() => onOrder(order, option)}>
            {order === 'maintain' ? 'Mantener' : 'Dar orden'}{chosen && chosen.cost_cp > 0 ? ` · ${formatCP(chosen.cost_cp)}` : ''}
          </button>
        </div>
      ))}
    </article>
  );
}

function Warehouse({ items, isOwner, busy, onSell, onTake }: {
  items: WarehouseItem[]; isOwner: boolean; busy: boolean; onSell: (id: number, qty: number) => void; onTake: (id: number, qty: number) => void;
}) {
  const [qtys, setQtys] = useState<Record<number, number>>({});
  return (
    <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="wh-h">
      <h3 id="wh-h" className="font-display text-[18px]">Almacén</h3>
      {items.length === 0 && <p className="text-[13.5px] text-muted">El almacén está vacío. Lo que producen las instalaciones llega aquí.</p>}
      <ul className="divide-y divide-line">
        {items.map((it) => {
          const qty = Math.min(Math.max(qtys[it.id] ?? 1, 1), it.quantity);
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{it.name} <span className="font-mono text-[12.5px] text-muted">×{it.quantity}</span></span>
                <span className="block text-[12.5px] text-muted">{formatCP(it.value_cp)} c/u · {it.source}</span>
              </span>
              {isOwner && (
                <>
                  <input type="number" min={1} max={it.quantity} value={qty} aria-label={`Cantidad de ${it.name}`}
                    className="h-9 w-16 rounded-lg border border-line bg-card-2 px-2 font-mono text-[13px]"
                    onChange={(e) => setQtys({ ...qtys, [it.id]: Number(e.target.value) })} />
                  <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" disabled={busy} onClick={() => onSell(it.id, qty)}>Vender</button>
                  <button type="button" className="mc-btn mc-btn-sm" disabled={busy} onClick={() => onTake(it.id, qty)}>Al inventario</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {isOwner && items.length > 0 && <p className="text-[12.5px] text-faint">Al vender, un comprador al azar se lleva los bienes: casi siempre gente anónima y, a veces, un PNJ de la campaña.</p>}
    </section>
  );
}
