/* GM appraisal: set the value (value_cp) of party items so they can be sold (market-bastions.md §4). */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { bastionApi, type AppraisalItem } from '../../services/bastionApi';
import { campaignApi } from '../../services/api';
import { useCampaign } from '../../lib/useCampaign';
import { cpToGP, formatCP, gpToCP, typeLabel } from '../../services/marketApi';

export function AppraisalPanel({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const key = ['appraisals', campaignId];
  const query = useQuery({ queryKey: key, queryFn: () => bastionApi.appraisals(campaignId) });
  const [onlyPending, setOnlyPending] = useState(true);
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (v: { id: number; cp: number | null }) => bastionApi.appraise(campaignId, v.id, v.cp),
    onSuccess: () => { setError(''); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => setError(getApiError(e)),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={getApiError(query.error, 'No se pudo cargar el inventario del grupo')} onRetry={() => void query.refetch()} />;
  const items = onlyPending ? query.data.filter((i) => i.value_cp === null) : query.data;

  return (
    <section className="mc-card flex flex-col gap-3 p-5" aria-labelledby="apr-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="apr-h" className="font-display text-[18px]">Tasación</h3>
          <p className="text-[13px] text-muted">Un objeto sin valor no se puede vender. Fija aquí cuánto vale.</p>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Solo sin tasar
        </label>
      </div>
      <SalePctSetting campaignId={campaignId} />
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
      {items.length === 0 && <p className="text-[13.5px] text-muted">{onlyPending ? 'No hay objetos sin tasar.' : 'El grupo no tiene objetos.'}</p>}
      <ul className="divide-y divide-line">
        {items.map((it) => <Row key={`${it.id}-${it.value_cp ?? 'x'}`} item={it} busy={save.isPending} onSave={(cp) => save.mutate({ id: it.id, cp })} />)}
      </ul>
    </section>
  );
}

function Row({ item, busy, onSave }: { item: AppraisalItem; busy: boolean; onSave: (cp: number | null) => void }) {
  const [gp, setGp] = useState(item.value_cp === null ? '' : String(cpToGP(item.value_cp)));
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{item.name} <span className="font-mono text-[12.5px] text-muted">×{item.quantity}</span></span>
        <span className="block text-[12.5px] text-muted">{item.character_name} · {typeLabel(item.item_type)}{item.value_cp !== null && ` · ahora ${formatCP(item.value_cp)}`}</span>
      </span>
      <input type="number" min={0} step="0.01" value={gp} placeholder="po" aria-label={`Valor en po de ${item.name}`}
        className="h-9 w-24 rounded-lg border border-line bg-card-2 px-2 font-mono text-[13px]" onChange={(e) => setGp(e.target.value)} />
      <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" disabled={busy || gp === ''} onClick={() => onSave(gpToCP(Number(gp) || 0))}>Tasar</button>
    </li>
  );
}

/** GM setting: share of an item's value paid when Bastion goods are sold (spec §6.5, default 100). */
function SalePctSetting({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const { campaign } = useCampaign(campaignId);
  const current = campaign?.bastion_sale_pct ?? 100;
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(current);
  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100;
  const save = useMutation({
    mutationFn: () => campaignApi.update(campaignId, { bastion_sale_pct: parsed }),
    onSuccess: () => { setDraft(null); void qc.invalidateQueries({ queryKey: ['campaign', campaignId] }); },
  });
  return (
    <form className="flex flex-wrap items-end gap-2 border-b border-line pb-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
      <label className="flex flex-col gap-1 text-[13px]">
        <span>Pago por venta de bienes del bastión (%)</span>
        <input type="number" min={0} max={100} step={1} value={value} onChange={(e) => setDraft(e.target.value)} className="h-10 w-28 rounded-lg border border-line bg-card-2 px-3 font-mono" aria-invalid={!valid} />
      </label>
      <button type="submit" className="mc-btn mc-btn-sm" disabled={!valid || save.isPending || parsed === current}>Guardar</button>
      {!valid && <span className="text-[12px] text-bad">Entre 0 y 100.</span>}
      {save.isError && <span role="alert" className="text-[12px] text-bad">{getApiError(save.error)}</span>}
    </form>
  );
}
