import { useState } from 'react';
import { spellDescription, spellDuration, spellRange, spellSchool, spellTime } from '../lib/spellFormat';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { characterApi, contentApi } from '../services/api';
import type { Character, Spell, SpellSlot } from '../types';
import { getApiError } from '../services/errors';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import { CharacterTabs } from '../components/character/CharacterTabs';
import { toAbility } from '../lib/abilities';

type ContentSpell = { id: number; name: string; source: string; is_srd: boolean; data?: Record<string, unknown> };
const text = (value: unknown): string => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join(', ') : value == null ? '' : JSON.stringify(value);

export function SpellsTab() {
  const { campaignId, characterId = '' } = useParams();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const spells = useQuery({ queryKey: ['spells', characterId], queryFn: () => characterApi.spells(characterId).then((response) => response.data as Spell[]) });
  const slots = useQuery({ queryKey: ['spell-slots', characterId], queryFn: () => characterApi.spellSlots(characterId).then((response) => response.data as SpellSlot[]) });
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => characterApi.get(characterId).then((response) => response.data as Character) });
  const results = useQuery({ queryKey: ['content-spells', query], enabled: adding, queryFn: () => contentApi.search({ type: 'spell', query, limit: 50 }).then((response) => response.data.data as ContentSpell[]) });
  const mutation = useMutation({ mutationFn: (action: () => Promise<unknown>) => { setError(''); return action(); }, onError: (reason) => setError(getApiError(reason)), onSuccess: () => { void spells.refetch(); void slots.refetch(); void character.refetch(); } });
  const add = async (summary: ContentSpell) => {
    const response = await contentApi.get(summary.id);
    const data = response.data.data as Record<string, unknown>;
    const components = data.components && typeof data.components === 'object' ? Object.keys(data.components).map((key) => key.toUpperCase()).join(',') : '';
    await characterApi.addSpell(characterId, { name: summary.name, level: Number(data.level || 0), school: spellSchool(data.school), casting_time: spellTime(data.time), range: spellRange(data.range), duration: spellDuration(data.duration), description: spellDescription(data.entries, data.entriesHigherLevel), components, damage_type: text(data.damageInflict), prepared: true });
    setAdding(false);
  };
  const cast = (spell: Spell) => mutation.mutate(() => characterApi.castSpell(characterId, spell.id));
  const available = (level: number) => level === 0 || (slots.data || []).some((slot) => slot.level === level && slot.used < slot.total);
  const ability = toAbility(character.data?.spellcasting_ability || '') ?? 'int';
  const score = character.data?.[`${ability}_score` as keyof Character];
  const modifier = Math.floor(((typeof score === 'number' ? score : 10) - 10) / 2);
  const toggle = (id: number) => setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const grouped = [...(spells.data || []).reduce((map, spell) => map.set(spell.level, [...(map.get(spell.level) ?? []), spell]), new Map<number, Spell[]>())].sort(([a], [b]) => a - b);
  const dc = 8 + (character.data?.proficiency_bonus || 2) + Math.floor(modifier);
  return <div className="min-h-screen flex flex-col">
    <header className="sticky top-0 z-40 bg-surface border-b border-border-low-contrast flex justify-between items-center px-4 h-16"><div className="flex items-center gap-3"><Link to={`/campaign/${campaignId}/character/${characterId}`} aria-label="Volver"><span className="material-symbols-outlined text-primary">arrow_back</span></Link><h1 className="font-headline-md font-bold">Conjuros</h1></div><button type="button" onClick={() => setAdding(true)} className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-bold">Añadir conjuro</button></header>
    <CharacterTabs campaignId={campaignId} characterId={characterId} active="spells" />
    <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-5">
      {error && <ErrorState message={error} />}
      <div className="grid grid-cols-2 gap-4"><section className="p-4 border border-border-low-contrast rounded-lg"><span className="text-secondary text-sm">CD de salvación</span><p className="font-stat-number text-2xl">{dc}</p></section><section className="p-4 border border-border-low-contrast rounded-lg"><span className="text-secondary text-sm">Característica</span><p className="font-stat-number text-2xl">{ability.toUpperCase()}</p></section></div>
      <section><div className="flex justify-between mb-3"><h2 className="font-label-bold">Espacios de conjuro</h2><button type="button" onClick={() => mutation.mutate(() => characterApi.longRest(characterId))} className="text-primary text-sm font-label-bold">Descanso largo</button></div>
        {slots.error ? <ErrorState message={getApiError(slots.error, 'No se pudieron cargar los espacios')} onRetry={() => void slots.refetch()} /> : (slots.data || []).length === 0 ? <p className="text-sm text-secondary">Sin espacios de conjuro.</p> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{(slots.data || []).filter((slot) => slot.total > 0).map((slot) => <div key={slot.level} className="p-3 border border-border-low-contrast rounded-lg"><span className="text-xs text-secondary">Nivel {slot.level} · {slot.total - slot.used}/{slot.total}</span><div className="flex flex-wrap gap-1.5 mt-2" role="img" aria-label={`${slot.total - slot.used} de ${slot.total} espacios de nivel ${slot.level} disponibles`}>{Array.from({ length: slot.total }, (_, index) => <span key={index} className={`w-3.5 h-3.5 rounded-full border ${index < slot.total - slot.used ? 'bg-primary border-primary' : 'border-outline'}`} />)}</div></div>)}</div>}</section>
      {spells.error ? <ErrorState message={getApiError(spells.error, 'No se pudieron cargar los conjuros')} onRetry={() => void spells.refetch()} /> : spells.isLoading || slots.isLoading ? <LoadingState /> : (spells.data || []).length === 0 ? <p className="text-secondary text-center py-12">No hay conjuros preparados.</p> : grouped.map(([level, group]) => <section key={level} aria-label={level === 0 ? 'Trucos' : `Conjuros de nivel ${level}`}><h2 className="font-label-bold mb-2">{level === 0 ? 'Trucos' : `Nivel ${level}`} <span className="text-secondary font-normal">({group.length})</span></h2><div className="space-y-3">{group.map((spell) => { const open = expanded.has(spell.id); return <article key={spell.id} className="border border-border-low-contrast rounded-xl p-4 bg-surface"><div className="flex justify-between gap-3"><button type="button" aria-expanded={open} onClick={() => toggle(spell.id)} className="text-left flex-1"><h3 className="font-label-bold">{spell.name}</h3><p className="text-sm text-secondary">{spell.school || 'Sin escuela'}{spell.casting_time ? ` · ${spell.casting_time}` : ''}</p></button><button type="button" disabled={!available(spell.level) || mutation.isPending} onClick={() => cast(spell)} className="bg-primary-container text-on-primary-container rounded-lg px-3 py-2 disabled:opacity-40 self-start">{spell.level === 0 ? 'Usar' : 'Lanzar'}</button></div>{open ? <div className="mt-3 space-y-2 text-sm"><dl className="grid grid-cols-2 gap-x-4 gap-y-1">{([['Alcance', spell.range], ['Duración', spell.duration], ['Componentes', spell.components], ['Daño', spell.damage_type]] as const).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-secondary inline">{label}: </dt><dd className="inline">{value}</dd></div>)}</dl><p className="whitespace-pre-wrap text-on-surface-variant">{spell.description || 'Sin descripción.'}</p></div> : <p className="text-sm text-on-surface-variant line-clamp-2 mt-2">{spell.description}</p>}</article>; })}</div></section>)}
    </main>
    {adding && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><section className="bg-surface rounded-xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h2 className="font-headline-md">Todos los conjuros importados</h2><button type="button" aria-label="Cerrar" onClick={() => setAdding(false)}>×</button></div><input aria-label="Buscar conjuros" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, cualquier fuente…" className="w-full rounded bg-surface-subtle border-border-low-contrast mb-3" />{results.isLoading ? <LoadingState /> : results.data?.map((spell) => <button type="button" key={spell.id} disabled={mutation.isPending} onClick={() => mutation.mutate(() => add(spell))} className="w-full text-left p-3 border-b border-border-low-contrast hover:bg-surface-container"><span className="font-label-bold">{spell.name}</span><span className="ml-2 text-xs text-secondary">{spell.source}{spell.is_srd ? ' · SRD' : ''}</span></button>)}</section></div>}
  </div>;
}
