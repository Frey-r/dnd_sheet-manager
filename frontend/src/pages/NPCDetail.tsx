import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { combatApi, npcApi } from '../services/api';
import { getApiError } from '../services/errors';
import { rollExpression, requestRoll } from '../lib/dice';
import { ABILITIES, abilityMod, signed } from '../lib/abilities';
import { ErrorState, LoadingState } from '../components/ui/Feedback';

type Stats = { ac?: number; hp?: number; speed?: number; str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number };
type NPC = { id: number; name: string; role: string; status: string; description: string; stats: Stats | null; image_url?: string };
type Draft = { name: string; role: string; status: string; description: string; stats: Record<string, string> };
const STAT_KEYS = ['ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const STAT_LABELS: Record<string, string> = { ac: 'CA', hp: 'PV', speed: 'Velocidad' };
const RELATIONS: Record<string, string> = { ally: 'Aliado', enemy: 'Enemigo', neutral: 'Neutral' };
const relationLabel = (value: string) => RELATIONS[value] ?? (value || '—');
const field = 'w-full rounded bg-surface-subtle border border-border-low-contrast px-3 h-10';

const toDraft = (npc: NPC): Draft => ({ name: npc.name, role: npc.role, status: npc.status, description: npc.description, stats: Object.fromEntries(STAT_KEYS.map((key) => [key, npc.stats?.[key] != null ? String(npc.stats[key]) : ''])) });
const show = (value: number | undefined) => (value == null ? '—' : value);

export function NPCDetail() {
  const { campaignId = '', npcId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initiative, setInitiative] = useState<string>('');
  const npc = useQuery({ queryKey: ['npcs', campaignId, npcId], queryFn: () => npcApi.get(campaignId, npcId).then((response) => response.data as NPC) });
  const add = useMutation({
    mutationFn: (data: { hp: number; initiative: number }) => combatApi.addCombatant(campaignId, { name: npc.data?.name, hp: data.hp, max_hp: data.hp, initiative: data.initiative, is_player: false }),
  });
  const save = useMutation({
    mutationFn: (value: Draft) => npcApi.update(campaignId, npcId, {
      name: value.name.trim(), role: value.role.trim(), status: value.status.trim(), description: value.description,
      stats: Object.fromEntries(STAT_KEYS.filter((key) => value.stats[key] !== '' && Number.isFinite(Number(value.stats[key]))).map((key) => [key, Number(value.stats[key])])),
    }),
    onSuccess: () => { setDraft(null); void client.invalidateQueries({ queryKey: ['npcs', campaignId] }); },
  });
  const remove = useMutation({
    mutationFn: () => npcApi.delete(campaignId, npcId),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['npcs', campaignId] }); navigate(`/campaign/${campaignId}/gm/npcs`); },
  });

  if (npc.isLoading) return <LoadingState />;
  if (npc.error || !npc.data) return <div className="p-8"><ErrorState message={npc.error ? getApiError(npc.error, 'No se pudo cargar el NPC') : 'NPC no encontrado'} onRetry={() => void npc.refetch()} /></div>;
  const current = npc.data;
  const { name, role, status, description } = current;
  // Older NPCs may hold "" for stats left blank: treat them as not recorded, not as 0.
  const stats: Stats = Object.fromEntries(Object.entries((current.stats ?? {}) as Record<string, unknown>).filter(([, value]) => value !== '' && value != null && Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)]));
  const dexMod = stats.dex != null ? abilityMod(stats.dex) : 0;
  const rollInitiative = () => {
    const result = rollExpression(`1d20${dexMod >= 0 ? '+' : '-'}${Math.abs(dexMod)}`);
    if (!result) return null;
    setInitiative(`${result.total} (${result.detail})`);
    return result.total;
  };
  const addToCombat = () => {
    const total = rollInitiative();
    if (total == null) return;
    add.mutate({ hp: stats.hp ?? 1, initiative: total });
  };
  const confirmDelete = () => { if (window.confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) remove.mutate(); };

  return <div className="min-h-screen"><header className="h-16 border-b border-border-low-contrast px-4 flex items-center gap-3"><Link to={`/campaign/${campaignId}/gm/npcs`} aria-label="Volver"><span className="material-symbols-outlined">arrow_back</span></Link><h1 className="font-headline-md font-bold">{name}</h1></header>
    <main className="max-w-5xl mx-auto p-4 md:p-8 grid md:grid-cols-3 gap-6">
      <section className="space-y-4">
        <div className="border border-border-low-contrast rounded-xl p-6 text-center">{current.image_url ? <img src={current.image_url} alt={`Retrato de ${name}`} className="w-24 h-24 mx-auto rounded-full object-cover bg-card-3" /> : <div className="w-24 h-24 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-4xl font-bold">{name.charAt(0)}</div>}<h2 className="font-headline-md mt-3">{name}</h2><p className="text-secondary">{role || '—'} · {relationLabel(status)}</p></div>
        <div className="grid grid-cols-3 gap-2">{([['ac', 'CA'], ['hp', 'PV'], ['speed', 'Velocidad']] as const).map(([key, label]) => <div key={key} className="text-center border rounded-lg p-3"><span className="font-stat-number text-2xl">{show(stats[key])}</span><p className="text-xs text-secondary">{label}</p></div>)}</div>
        <div className="grid grid-cols-3 gap-2">{ABILITIES.map(([key, short]) => <div key={key} className="text-center border rounded p-2"><span className="text-xs text-secondary">{short}</span><p className="font-stat-number">{show(stats[key])}</p>{stats[key] != null && <p className="text-xs text-secondary">{signed(abilityMod(stats[key]))}</p>}</div>)}</div>
      </section>
      <section className="md:col-span-2 space-y-4">
        {draft ? (
          <form className="border border-border-low-contrast rounded-xl p-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) save.mutate(draft); }}>
            <h2 className="font-headline-md">Editar NPC</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm font-label-bold">Nombre<input className={field} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
              <label className="text-sm font-label-bold">Rol<input className={field} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} /></label>
              <label className="text-sm font-label-bold">Relación<select className={field} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{Object.entries(RELATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}{!RELATIONS[draft.status] && draft.status && <option value={draft.status}>{draft.status}</option>}</select></label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">{STAT_KEYS.map((key) => <label key={key} className="text-sm font-label-bold">{STAT_LABELS[key] ?? ABILITIES.find(([ability]) => ability === key)?.[1]}<input type="number" min={0} className={field} value={draft.stats[key]} onChange={(event) => setDraft({ ...draft, stats: { ...draft.stats, [key]: event.target.value } })} /></label>)}</div>
            <label className="text-sm font-label-bold block">Descripción y notas<textarea rows={6} className="w-full rounded bg-surface-subtle border border-border-low-contrast p-3" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            {save.error && <ErrorState message={getApiError(save.error, 'No se pudo guardar el NPC')} />}
            <div className="flex gap-3"><button type="submit" disabled={save.isPending || !draft.name.trim()} className="flex-1 py-3 rounded-lg bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">{save.isPending ? 'Guardando…' : 'Guardar'}</button><button type="button" onClick={() => { setDraft(null); save.reset(); }} className="flex-1 py-3 rounded-lg border font-label-bold">Cancelar</button></div>
          </form>
        ) : (
          <article className="border border-border-low-contrast rounded-xl p-5"><h2 className="font-headline-md mb-2">Descripción y notas</h2><p className="whitespace-pre-wrap text-on-surface-variant">{description || 'Sin descripción.'}</p></article>
        )}
        {add.error && <ErrorState message={getApiError(add.error)} />}
        {remove.error && <ErrorState message={getApiError(remove.error, 'No se pudo eliminar el NPC')} />}
        {add.isSuccess && <p role="status" className="text-success-active">NPC añadido al combate con iniciativa {initiative}.</p>}
        {!add.isSuccess && initiative && <p role="status" className="text-on-surface-variant">Iniciativa: {initiative}</p>}
        {stats.dex == null && <p className="text-sm text-secondary">Sin DES registrada: la iniciativa usa modificador +0.</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={addToCombat} disabled={add.isPending} className="flex-1 min-w-40 py-3 rounded-lg bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">Añadir a combate</button>
          <button type="button" onClick={() => { const expr = `1d20${dexMod >= 0 ? '+' : '-'}${Math.abs(dexMod)}`; requestRoll(expr, `Iniciativa de ${name}`); }} className="py-3 px-4 rounded-lg border font-label-bold">Tirar iniciativa (d20{dexMod >= 0 ? '+' : '−'}{Math.abs(dexMod)})</button>
          {!draft && <button type="button" onClick={() => setDraft(toDraft(current))} className="py-3 px-4 rounded-lg border font-label-bold">Editar</button>}
          <button type="button" onClick={confirmDelete} disabled={remove.isPending} className="py-3 px-4 rounded-lg border border-error text-error font-label-bold disabled:opacity-50">{remove.isPending ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </section>
    </main></div>;
}
