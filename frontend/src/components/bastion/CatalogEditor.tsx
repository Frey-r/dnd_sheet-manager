/* GM editor of the campaign's facility catalogue and Bastion events table (market-bastions.md §6.3). */
import { useState } from 'react';
import { DecimalInput } from '../ui/DecimalInput';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { cpToGP, gpToCP } from '../../services/marketApi';
import {
  OPTION_KINDS, ORDERS, SIZES, bastionApi,
  type BastionEvent, type BastionOption, type BastionSize, type CatalogEntry, type CatalogPayload, type OptionKind, type OrderName,
} from '../../services/bastionApi';

const field = 'w-full rounded-lg border border-line bg-card-2 px-3 text-[14px] outline-none focus:border-accent';
const label = 'flex flex-col gap-1.5 text-[13px] font-medium';
const playerOrders = ORDERS.filter((o) => o.value !== 'maintain');

const blankFacility = (): CatalogEntry => ({ id: 0, name: '', min_level: 5, prerequisite: '', size: 'roomy', description: '', hirelings: 1, orders: [], options: [], sort_order: 1000 });
const blankOption = (order: OrderName, n: number): BastionOption => ({ id: `opcion-${n}`, order, name: '', description: '', turns: 1, cost_cp: 0, kind: 'narrative', text: '' });
const blankEvent = (): BastionEvent => ({ id: 0, roll_min: 1, roll_max: 1, name: '', description: '', reward_dice: '', reward_mult_cp: 0 });

export function CatalogEditor({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['bastion-catalog', campaignId], queryFn: () => bastionApi.catalog(campaignId) });
  const [draft, setDraft] = useState<CatalogPayload | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useMutation({
    mutationFn: (p: CatalogPayload) => bastionApi.saveCatalog(campaignId, p),
    onSuccess: (p) => {
      setDraft(p); setNotice({ ok: true, text: 'Catálogo guardado' });
      void qc.invalidateQueries({ queryKey: ['bastion-catalog', campaignId] });
      void qc.invalidateQueries({ queryKey: ['bastions', campaignId] });
      void qc.invalidateQueries({ queryKey: ['bastion', campaignId] });
    },
    onError: (e) => setNotice({ ok: false, text: getApiError(e) }),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={getApiError(query.error, 'No se pudo cargar el catálogo')} onRetry={() => void query.refetch()} />;
  const data = draft ?? query.data;
  const setFacility = (i: number, patch: Partial<CatalogEntry>) => setDraft({ ...data, facilities: data.facilities.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const setEvent = (i: number, patch: Partial<BastionEvent>) => setDraft({ ...data, events: data.events.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  return (
    <div className="flex flex-col gap-5">
      <div className="mc-card flex flex-wrap items-center gap-3 p-4">
        <p className="min-w-[240px] flex-1 text-[13.5px] text-muted">Corrige, amplía o inventa instalaciones y eventos. Los cambios afectan a las instalaciones que ya existen en los bastiones de esta campaña.</p>
        {notice && <span role="status" className={`text-[13px] ${notice.ok ? 'text-ok' : 'text-bad'}`}>{notice.text}</span>}
        <button type="button" className="mc-btn mc-btn-primary" disabled={!draft || save.isPending} onClick={() => draft && save.mutate(draft)}>{save.isPending ? 'Guardando…' : 'Guardar catálogo'}</button>
      </div>

      <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="cat-h">
        <div className="flex items-center justify-between">
          <h3 id="cat-h" className="font-display text-[18px]">Instalaciones especiales</h3>
          <button type="button" className="mc-btn mc-btn-sm" onClick={() => { setDraft({ ...data, facilities: [...data.facilities, blankFacility()] }); setOpen(data.facilities.length); }}>Nueva instalación</button>
        </div>
        <ul className="flex flex-col gap-2">
          {data.facilities.map((f, i) => (
            <li key={`${f.id}-${i}`} className="rounded-lg border border-line bg-card-2">
              <button type="button" aria-expanded={open === i} className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(open === i ? null : i)}>
                <span className="min-w-0 flex-1 truncate font-semibold">{f.name || 'Sin nombre'}</span>
                <span className="text-[12.5px] text-muted">nivel {f.min_level} · {f.orders.map((o) => ORDERS.find((x) => x.value === o)?.label ?? o).join(', ') || 'sin órdenes'}</span>
                <span className="material-symbols-outlined text-[18px]">{open === i ? 'expand_less' : 'expand_more'}</span>
              </button>
              {open === i && (
                <FacilityForm facility={f} onChange={(p) => setFacility(i, p)}
                  onRemove={() => { if (window.confirm(`¿Quitar «${f.name || 'esta instalación'}» del catálogo?`)) { setDraft({ ...data, facilities: data.facilities.filter((_, j) => j !== i) }); setOpen(null); } }} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="ev-h">
        <div className="flex items-center justify-between">
          <h3 id="ev-h" className="font-display text-[18px]">Tabla de eventos (d100)</h3>
          <button type="button" className="mc-btn mc-btn-sm" onClick={() => setDraft({ ...data, events: [...data.events, blankEvent()] })}>Nuevo evento</button>
        </div>
        <ul className="flex flex-col gap-3">
          {data.events.map((ev, i) => (
            <li key={`${ev.id}-${i}`} className="grid gap-2 rounded-lg border border-line bg-card-2 p-3 sm:grid-cols-[70px_70px_1fr_auto]">
              <label className={label}>Desde
                <input type="number" min={1} max={100} className={`${field} h-9 font-mono`} value={ev.roll_min} onChange={(e) => setEvent(i, { roll_min: Number(e.target.value) })} />
              </label>
              <label className={label}>Hasta
                <input type="number" min={1} max={100} className={`${field} h-9 font-mono`} value={ev.roll_max} onChange={(e) => setEvent(i, { roll_max: Number(e.target.value) })} />
              </label>
              <label className={label}>Nombre
                <input className={`${field} h-9`} value={ev.name} onChange={(e) => setEvent(i, { name: e.target.value })} />
              </label>
              <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm self-end" aria-label={`Quitar ${ev.name || 'evento'}`}
                onClick={() => setDraft({ ...data, events: data.events.filter((_, j) => j !== i) })}><span className="material-symbols-outlined text-[18px]">delete</span></button>
              <label className={`${label} sm:col-span-4`}>Descripción
                <input className={`${field} h-9`} value={ev.description} onChange={(e) => setEvent(i, { description: e.target.value })} />
              </label>
              <label className={label}>Dados de recompensa
                <input className={`${field} h-9 font-mono`} placeholder="4d6" value={ev.reward_dice} onChange={(e) => setEvent(i, { reward_dice: e.target.value })} />
              </label>
              <label className={`${label} sm:col-span-2`}>Valor por punto (po)
                <DecimalInput min={0} step="0.01" className={`${field} h-9 font-mono`} value={cpToGP(ev.reward_mult_cp)} onValueChange={(gp) => setEvent(i, { reward_mult_cp: gpToCP(gp) })} />
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FacilityForm({ facility: f, onChange, onRemove }: { facility: CatalogEntry; onChange: (p: Partial<CatalogEntry>) => void; onRemove: () => void }) {
  const toggleOrder = (o: OrderName) => onChange({ orders: f.orders.includes(o) ? f.orders.filter((x) => x !== o) : [...f.orders, o] });
  const setOption = (i: number, patch: Partial<BastionOption>) => onChange({ options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <div className="flex flex-col gap-4 border-t border-line p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_100px_140px_100px]">
        <label className={label}>Nombre
          <input className={`${field} h-10`} value={f.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className={label}>Nivel mín.
          <input type="number" min={1} max={20} className={`${field} h-10 font-mono`} value={f.min_level} onChange={(e) => onChange({ min_level: Number(e.target.value) })} />
        </label>
        <label className={label}>Tamaño
          <select className={`${field} h-10`} value={f.size} onChange={(e) => onChange({ size: e.target.value as BastionSize })}>
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className={label}>Empleados
          <input type="number" min={0} max={20} className={`${field} h-10 font-mono`} value={f.hirelings} onChange={(e) => onChange({ hirelings: Number(e.target.value) })} />
        </label>
      </div>
      <label className={label}>Requisito (lo confirma el DM)
        <input className={`${field} h-10`} value={f.prerequisite} onChange={(e) => onChange({ prerequisite: e.target.value })} />
      </label>
      <label className={label}>Descripción
        <textarea className={`${field} min-h-[60px] py-2`} value={f.description} onChange={(e) => onChange({ description: e.target.value })} />
      </label>
      <div className={label}>Órdenes que admite
        <div className="flex flex-wrap gap-1.5">
          {playerOrders.map((o) => {
            const on = f.orders.includes(o.value);
            return <button key={o.value} type="button" aria-pressed={on} onClick={() => toggleOrder(o.value)} className={`mc-badge cursor-pointer ${on ? 'border-accent text-accent' : ''}`}>{o.label}</button>;
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold">Opciones de orden</h4>
          <button type="button" className="mc-btn mc-btn-sm" disabled={f.orders.length === 0} onClick={() => onChange({ options: [...f.options, blankOption(f.orders[0], f.options.length + 1)] })}>Añadir opción</button>
        </div>
        {f.orders.length === 0 && <p className="text-[12.5px] text-muted">Marca primero las órdenes que admite.</p>}
        {f.options.map((o, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-4">
            <label className={label}>Id
              <input className={`${field} h-9 font-mono`} value={o.id} onChange={(e) => setOption(i, { id: e.target.value })} />
            </label>
            <label className={label}>Orden
              <select className={`${field} h-9`} value={o.order} onChange={(e) => setOption(i, { order: e.target.value as OrderName })}>
                {f.orders.map((x) => <option key={x} value={x}>{ORDERS.find((y) => y.value === x)?.label ?? x}</option>)}
              </select>
            </label>
            <label className={`${label} sm:col-span-2`}>Nombre
              <input className={`${field} h-9`} value={o.name} onChange={(e) => setOption(i, { name: e.target.value })} />
            </label>
            <label className={`${label} sm:col-span-4`}>Descripción
              <input className={`${field} h-9`} value={o.description} onChange={(e) => setOption(i, { description: e.target.value })} />
            </label>
            <label className={label}>Turnos
              <input type="number" min={1} max={52} className={`${field} h-9 font-mono`} value={o.turns} onChange={(e) => setOption(i, { turns: Number(e.target.value) })} />
            </label>
            <label className={label}>Coste (po)
              <DecimalInput min={0} step="0.01" className={`${field} h-9 font-mono`} value={cpToGP(o.cost_cp)} onValueChange={(gp) => setOption(i, { cost_cp: gpToCP(gp) })} />
            </label>
            <label className={`${label} sm:col-span-2`}>Resultado
              <select className={`${field} h-9`} value={o.kind} onChange={(e) => setOption(i, { kind: e.target.value as OptionKind })}>
                {OPTION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </label>
            <OptionResult option={o} onChange={(p) => setOption(i, p)} />
            <button type="button" className="mc-btn mc-btn-danger mc-btn-sm self-end sm:col-span-4 sm:justify-self-start" onClick={() => onChange({ options: f.options.filter((_, j) => j !== i) })}>Quitar opción</button>
          </div>
        ))}
      </div>
      <button type="button" className="mc-btn mc-btn-danger self-start" onClick={onRemove}>Quitar instalación del catálogo</button>
    </div>
  );
}

function OptionResult({ option: o, onChange }: { option: BastionOption; onChange: (p: Partial<BastionOption>) => void }) {
  if (o.kind === 'item') {
    return (
      <>
        <label className={`${label} sm:col-span-2`}>Objeto
          <input className={`${field} h-9`} value={o.item_name ?? ''} onChange={(e) => onChange({ item_name: e.target.value })} />
        </label>
        <label className={label}>Cantidad
          <input type="number" min={1} className={`${field} h-9 font-mono`} value={o.qty ?? 1} onChange={(e) => onChange({ qty: Number(e.target.value) })} />
        </label>
        <label className={label}>Valor c/u (po)
          <DecimalInput min={0} step="0.01" className={`${field} h-9 font-mono`} value={cpToGP(o.value_cp ?? 0)} onValueChange={(gp) => onChange({ value_cp: gpToCP(gp) })} />
        </label>
        <label className={label}>Tipo
          <input className={`${field} h-9`} placeholder="potion, gear…" value={o.item_type ?? ''} onChange={(e) => onChange({ item_type: e.target.value })} />
        </label>
        <label className={label}>Rareza
          <input className={`${field} h-9`} placeholder="common" value={o.rarity ?? ''} onChange={(e) => onChange({ rarity: e.target.value })} />
        </label>
      </>
    );
  }
  if (o.kind === 'gold') {
    return (
      <>
        <label className={label}>Dados
          <input className={`${field} h-9 font-mono`} placeholder="1d6" value={o.gold_dice ?? ''} onChange={(e) => onChange({ gold_dice: e.target.value })} />
        </label>
        <label className={`${label} sm:col-span-2`}>Oro por punto (po)
          <DecimalInput min={0} step="0.01" className={`${field} h-9 font-mono`} value={cpToGP(o.gold_mult_cp ?? 0)} onValueChange={(gp) => onChange({ gold_mult_cp: gpToCP(gp) })} />
        </label>
      </>
    );
  }
  if (o.kind === 'defender') {
    return (
      <label className={label}>Defensores
        <input type="number" min={1} className={`${field} h-9 font-mono`} value={o.defenders ?? 1} onChange={(e) => onChange({ defenders: Number(e.target.value) })} />
      </label>
    );
  }
  return (
    <label className={`${label} sm:col-span-4`}>Texto del resultado
      <input className={`${field} h-9`} value={o.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
    </label>
  );
}
