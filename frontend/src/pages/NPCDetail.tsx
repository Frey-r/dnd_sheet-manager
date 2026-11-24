import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { combatApi, npcApi } from '../services/api';
import { getApiError } from '../services/errors';
import { rollExpression, requestRoll } from '../lib/dice';
import { ABILITIES, abilityMod, signed } from '../lib/abilities';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { NPCSheetTabs } from '../components/npc/NPCSheetTabs';
import { NPCPortrait } from '../components/avatar/NPCPortrait';
import type { NPC } from '../types';

type Stats = { ac?: number; hp?: number; speed?: number; str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number };
type Entry = { name: string; desc: string };
type Profile = { type?: string; size?: string; cr?: string; traits?: Entry[]; actions?: Entry[] };
/** The stat-block profile, edited here; name, stats, race, class and look are edited in the NPC creator. */
type Draft = { type: string; size: string; cr: string; traits: string; actions: string };
const PROFILE_KEYS = ['type', 'size', 'cr', 'traits', 'actions'];
const RELATIONS: Record<string, string> = { ally: 'Aliado', enemy: 'Enemigo', neutral: 'Neutral' };
const relationLabel = (value: string) => RELATIONS[value] ?? (value || '—');
const field = 'w-full rounded bg-surface-subtle border border-border-low-contrast px-3 h-10';

// The free-form stats JSON also carries the stat-block profile: type, size, CR and lists of
// traits and actions ({name, desc}). In the editor each entry is one "Nombre: descripción" line.
const SIZES: Record<string, string> = { T: 'Diminuto', S: 'Pequeño', M: 'Mediano', L: 'Grande', H: 'Enorme', G: 'Gargantuesco' };
const entries = (value: unknown): Entry[] => (Array.isArray(value) ? value.filter((entry): entry is Entry => Boolean(entry) && typeof (entry as Entry).name === 'string').map((entry) => ({ name: entry.name, desc: typeof entry.desc === 'string' ? entry.desc : '' })) : []);
const profileOf = (stats: unknown): Profile => {
  const raw = (stats ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : undefined);
  return { type: text(raw.type), size: text(raw.size), cr: text(raw.cr), traits: entries(raw.traits), actions: entries(raw.actions) };
};
const toLines = (list: Entry[] | undefined) => (list ?? []).map((entry) => (entry.desc ? `${entry.name}: ${entry.desc}` : entry.name)).join('\n');
const fromLines = (text: string): Entry[] => text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const at = line.indexOf(':'); return at > 0 ? { name: line.slice(0, at).trim(), desc: line.slice(at + 1).trim() } : { name: line, desc: '' }; });
const toDraft = (npc: NPC): Draft => { const profile = profileOf(npc.stats); return { type: profile.type ?? '', size: profile.size ?? '', cr: profile.cr ?? '', traits: toLines(profile.traits), actions: toLines(profile.actions) }; };
const show = (value: number | undefined) => (value == null ? '—' : value);

export function NPCDetail() {
  const { campaignId = '', npcId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initiative, setInitiative] = useState<string>('');
  const npc = useQuery({ queryKey: ['npcs', campaignId, npcId], queryFn: () => npcApi.get(campaignId, npcId).then((response) => response.data) });
  const add = useMutation({
    mutationFn: (data: { hp: number; initiative: number }) => combatApi.addCombatant(campaignId, { name: npc.data?.name, hp: data.hp, max_hp: data.hp, initiative: data.initiative, is_player: false }),
  });
  const save = useMutation({
    // Stats is one JSON document: keep the scores and replace only the profile.
    mutationFn: (value: Draft) => npcApi.update(campaignId, npcId, {
      stats: {
        ...Object.fromEntries(Object.entries(npc.data?.stats ?? {}).filter(([key]) => !PROFILE_KEYS.includes(key))),
        ...(value.type.trim() ? { type: value.type.trim() } : {}), ...(value.size ? { size: value.size } : {}), ...(value.cr.trim() ? { cr: value.cr.trim() } : {}),
        traits: fromLines(value.traits), actions: fromLines(value.actions),
      },
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
  // The combat sheet (npc-agenda.md §5) fills the quick view when the old top-level numbers are missing.
  const combat = ((current.stats ?? {}) as { combat?: { hp?: number; ac?: number; speed_ft?: number } }).combat;
  if (combat) {
    stats.ac ??= combat.ac;
    stats.hp ??= combat.hp;
    stats.speed ??= combat.speed_ft;
  }
  const dexMod = stats.dex != null ? abilityMod(stats.dex) : 0;
  const profile = profileOf(current.stats);
  const tags = [profile.type, profile.size ? SIZES[profile.size] ?? profile.size : undefined, profile.cr ? `VD ${profile.cr}` : undefined].filter(Boolean) as string[];
  // Passive Perception = 10 + WIS modifier (no skill proficiency is recorded for NPCs).
  const passivePerception = stats.wis != null ? 10 + abilityMod(stats.wis) : undefined;
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
        <div className="border border-border-low-contrast rounded-xl p-6 text-center"><NPCPortrait npc={current} crop="full" scale={3} frame="avatar-stage mx-auto grid w-fit place-items-center rounded-xl px-6 py-4" fallbackFrame="w-24 h-24 mx-auto rounded-full overflow-hidden bg-primary-container text-on-primary-container flex items-center justify-center text-4xl" /><h2 className="font-headline-md mt-3">{name}</h2><p className="text-secondary">{role || '—'} · {relationLabel(status)}</p>{tags.length > 0 && <div className="flex flex-wrap justify-center gap-1 mt-2">{tags.map((tag) => <span key={tag} className="mc-badge">{tag}</span>)}</div>}</div>
        <div className="grid grid-cols-2 gap-2">{([['ac', 'CA'], ['hp', 'PV'], ['speed', 'Velocidad']] as const).map(([key, label]) => <div key={key} className="text-center border rounded-lg p-3"><span className="font-stat-number text-2xl">{show(stats[key])}</span><p className="text-xs text-secondary">{label}</p></div>)}<div className="text-center border rounded-lg p-3"><span className="font-stat-number text-2xl">{show(passivePerception)}</span><p className="text-xs text-secondary">Percepción pasiva</p></div></div>
        <div className="grid grid-cols-3 gap-2">{ABILITIES.map(([key, short]) => <div key={key} className="text-center border rounded p-2"><span className="text-xs text-secondary">{short}</span><p className="font-stat-number">{show(stats[key])}</p>{stats[key] != null && <p className="text-xs text-secondary">{signed(abilityMod(stats[key]))}</p>}</div>)}</div>
      </section>
      <section className="md:col-span-2 space-y-4">
        <article className="border border-border-low-contrast rounded-xl p-5"><h2 className="font-headline-md mb-2">Descripción y notas</h2><p className="whitespace-pre-wrap text-on-surface-variant">{description || 'Sin descripción.'}</p></article>
        {draft ? (
          <form className="border border-border-low-contrast rounded-xl p-5 space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(draft); }}>
            <h2 className="font-headline-md">Rasgos y acciones</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm font-label-bold">Tipo<input className={field} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} placeholder="Humanoide" /></label>
              <label className="text-sm font-label-bold">Tamaño<select className={field} value={draft.size} onChange={(event) => setDraft({ ...draft, size: event.target.value })}><option value="">—</option>{Object.entries(SIZES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-label-bold">VD<input className={field} value={draft.cr} onChange={(event) => setDraft({ ...draft, cr: event.target.value })} placeholder="1/2" /></label>
            </div>
            <label className="text-sm font-label-bold block">Rasgos (uno por línea, «Nombre: descripción»)<textarea rows={3} className="w-full rounded bg-surface-subtle border border-border-low-contrast p-3" value={draft.traits} onChange={(event) => setDraft({ ...draft, traits: event.target.value })} /></label>
            <label className="text-sm font-label-bold block">Acciones (una por línea, «Nombre: descripción»)<textarea rows={3} className="w-full rounded bg-surface-subtle border border-border-low-contrast p-3" value={draft.actions} onChange={(event) => setDraft({ ...draft, actions: event.target.value })} /></label>
            {save.error && <ErrorState message={getApiError(save.error, 'No se pudo guardar el NPC')} />}
            <div className="flex gap-3"><button type="submit" disabled={save.isPending} className="flex-1 py-3 rounded-lg bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">{save.isPending ? 'Guardando…' : 'Guardar'}</button><button type="button" onClick={() => { setDraft(null); save.reset(); }} className="flex-1 py-3 rounded-lg border font-label-bold">Cancelar</button></div>
          </form>
        ) : ([['Rasgos', profile.traits], ['Acciones', profile.actions]] as const).map(([title, list]) => list && list.length > 0 && <article key={title} className="border border-border-low-contrast rounded-xl p-5"><h2 className="font-headline-md mb-2">{title}</h2><ul className="space-y-2">{list.map((entry, index) => <li key={`${entry.name}-${index}`}><span className="font-label-bold">{entry.name}.</span> <span className="text-on-surface-variant">{entry.desc}</span></li>)}</ul></article>)}
        <NPCSheetTabs campaignId={campaignId} npc={current} />
        {add.error && <ErrorState message={getApiError(add.error)} />}
        {remove.error && <ErrorState message={getApiError(remove.error, 'No se pudo eliminar el NPC')} />}
        {add.isSuccess && <p role="status" className="text-success-active">NPC añadido al combate con iniciativa {initiative}.</p>}
        {!add.isSuccess && initiative && <p role="status" className="text-on-surface-variant">Iniciativa: {initiative}</p>}
        {stats.dex == null && <p className="text-sm text-secondary">Sin DES registrada: la iniciativa usa modificador +0.</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={addToCombat} disabled={add.isPending} className="flex-1 min-w-40 py-3 rounded-lg bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">Añadir a combate</button>
          <button type="button" onClick={() => { const expr = `1d20${dexMod >= 0 ? '+' : '-'}${Math.abs(dexMod)}`; requestRoll(expr, `Iniciativa de ${name}`); }} className="py-3 px-4 rounded-lg border font-label-bold">Tirar iniciativa (d20{dexMod >= 0 ? '+' : '−'}{Math.abs(dexMod)})</button>
          <Link to={`/campaign/${campaignId}/gm/npcs/${npcId}/edit`} className="py-3 px-4 rounded-lg border font-label-bold">Editar NPC</Link>
          {!draft && <button type="button" onClick={() => setDraft(toDraft(current))} className="py-3 px-4 rounded-lg border font-label-bold">Editar rasgos y acciones</button>}
          <button type="button" onClick={confirmDelete} disabled={remove.isPending} className="py-3 px-4 rounded-lg border border-error text-error font-label-bold disabled:opacity-50">{remove.isPending ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </section>
    </main></div>;
}
