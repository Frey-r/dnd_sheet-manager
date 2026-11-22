import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { characterApi, combatApi } from '../../services/api';
import { useAuth } from '../../lib/hooks';
import { activeCombatantIndex } from '../../lib/combat';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState, EmptyState } from '../ui/Feedback';
import { HPBar } from '../ui/HPBar';
import { PlayerActions } from './PlayerActions';
import { PixelAvatar } from '../avatar/PixelAvatar';
import type { Character } from '../../types';

type Combatant = { id: number; character_id?: number; srd_monster_id?: number; ac?: number; name: string; initiative: number; hp: number; max_hp: number; is_player: boolean };
type LogEntry = { id: number; actor_id?: number; body: string; created_at: string };
type CombatState = { round: number; turn: number; combatants: Combatant[]; log: LogEntry[] };

export function CombatBoard({ canManage }: { canManage: boolean }) {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [initiative, setInitiative] = useState(10);
  const [maxHP, setMaxHP] = useState(10);
  const [error, setError] = useState('');
  const activeCard = useRef<HTMLElement | null>(null);
  const combat = useQuery({ queryKey: ['combat', campaignId], queryFn: () => combatApi.getState(campaignId).then((response) => response.data as CombatState) });
  const characters = useQuery({ queryKey: ['characters', campaignId], queryFn: () => characterApi.listByCampaign(campaignId).then((response) => response.data as Character[]) });
  const mutation = useMutation({ mutationFn: (operation: () => Promise<unknown>) => operation(), onSuccess: () => { setError(''); void combat.refetch(); void characters.refetch(); }, onError: (reason) => setError(getApiError(reason)) });
  const combatants = combat.data?.combatants || [];
  const activeIndex = activeCombatantIndex(combat.data?.turn, combatants.length);
  const mine = characters.data?.find((character) => character.user_id === user?.id);
  const myCombatant = combatants.find((combatant) => mine && combatant.character_id === mine.id);
  const canEdit = (combatant: Combatant) => canManage || characters.data?.some((character) => character.id === combatant.character_id && character.user_id === user?.id);
  const addPlayer = (character: Character) => mutation.mutate(() => combatApi.addCombatant(campaignId, { name: character.name, character_id: character.id, initiative: character.initiative_bonus + 10, hp: character.current_hp, max_hp: character.max_hp, is_player: true }));

  // El carrusel sigue al combatiente activo.
  useEffect(() => {
    activeCard.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex, combatants.length]);

  const logTone = (entry: LogEntry) => {
    const actor = combatants.find((combatant) => entry.body.includes(combatant.name));
    return actor ? (actor.is_player ? 'border-ok text-ok' : 'border-bad text-bad') : 'border-line text-secondary';
  };

  return <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">{error && <ErrorState message={error} />}
    <div className="flex justify-between items-center gap-3"><div><h1 className="font-headline-lg">Combate</h1><p className="text-secondary">Ronda {combat.data?.round || 0} · {combatants[activeIndex] ? `Turno de ${combatants[activeIndex].name}` : 'Sin turno activo'}</p></div>{canManage && <div className="flex gap-2"><button type="button" onClick={() => mutation.mutate(() => combatApi.nextTurn(campaignId))} disabled={!combatants.length || mutation.isPending} className="bg-primary-container text-on-primary-container rounded-lg px-4 py-2 disabled:opacity-50">Siguiente turno</button><button type="button" onClick={() => mutation.mutate(() => combatApi.reset(campaignId))} className="border rounded-lg px-3 py-2">Reiniciar</button></div>}</div>
    {combat.isLoading ? <LoadingState /> : combat.error ? <ErrorState message="No se pudo cargar el combate" onRetry={() => void combat.refetch()} /> : <div className="grid lg:grid-cols-3 gap-6"><section className="lg:col-span-2 min-w-0 space-y-4" aria-label="Orden de iniciativa">
      {combatants.length > 0 && <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1">{combatants.map((combatant, index) => {
        const active = index === activeIndex;
        return <article key={combatant.id} ref={active ? activeCard : undefined} aria-current={active ? 'true' : undefined} className={`snap-center shrink-0 w-60 p-4 rounded-lg border border-l-4 ${active ? 'border-line-strong border-l-accent bg-accent-soft' : `border-line ${combatant.is_player ? 'border-l-ok' : 'border-l-bad'}`}`}>
          <div className="flex items-start justify-between gap-2"><span className="font-stat-number text-2xl">{combatant.initiative}</span>{active && <span className="mc-badge bg-accent-soft text-accent">Turno actual</span>}{canManage && <button type="button" aria-label={`Eliminar a ${combatant.name}`} onClick={() => mutation.mutate(() => combatApi.removeCombatant(campaignId, combatant.id))} className="text-hp-danger">×</button>}</div>
          <h2 className="font-label-bold mt-1 truncate">{canManage && combatant.srd_monster_id ? <Link to={`/campaign/${campaignId}/gm/bestiary/${combatant.srd_monster_id}`} className="text-primary hover:underline" title="Ver bloque de estadísticas">{combatant.name}</Link> : combatant.name}</h2>
          <p className="text-sm text-secondary">{combatant.is_player ? 'Jugador' : 'Enemigo'} · {combatant.hp}/{combatant.max_hp} PV{combatant.ac != null && <> · CA {combatant.ac}</>}</p>
          <HPBar hp={combatant.hp} max={combatant.max_hp} label={`PV de ${combatant.name}`} className="mt-3" />
          {canEdit(combatant) && <input aria-label={`PV de ${combatant.name}`} type="number" min={0} max={combatant.max_hp} defaultValue={combatant.hp} key={`${combatant.id}-${combatant.hp}`} onBlur={(event) => { const hp = Number(event.target.value); if (hp !== combatant.hp) mutation.mutate(() => combatApi.updateHP(campaignId, combatant.id, { hp })); }} className="mt-3 w-20 rounded bg-surface-subtle border-border-low-contrast" />}
        </article>;
      })}</div>}
      {!combatants.length && <EmptyState title="No hay combatientes" />}
      {!canManage && mine && myCombatant && <PlayerStatusCard character={mine} combatant={myCombatant} />}
      {!canManage && mine && myCombatant && <PlayerActions character={mine} isMyTurn={activeIndex >= 0 && combatants[activeIndex]?.id === myCombatant.id} />}
    </section>
      <aside className="space-y-4">{canManage && <section className="border border-border-low-contrast rounded-lg p-4"><button type="button" onClick={() => setFormOpen(!formOpen)} className="w-full text-left font-label-bold text-primary">+ Añadir combatiente</button>{formOpen && <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(() => combatApi.addCombatant(campaignId, { name, initiative, hp: maxHP, max_hp: maxHP, is_player: false })); setFormOpen(false); }} className="space-y-3 mt-3"><input aria-label="Nombre" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" className="w-full rounded bg-surface-subtle border-border-low-contrast" /><div className="grid grid-cols-2 gap-2"><label className="text-sm">Iniciativa<input type="number" value={initiative} onChange={(event) => setInitiative(Number(event.target.value))} className="w-full rounded bg-surface-subtle border-border-low-contrast" /></label><label className="text-sm">PV máximos<input type="number" min={1} value={maxHP} onChange={(event) => setMaxHP(Number(event.target.value))} className="w-full rounded bg-surface-subtle border-border-low-contrast" /></label></div><button type="submit" className="w-full bg-primary-container rounded py-2">Añadir</button></form>}</section>}
      {canManage && <section className="border border-border-low-contrast rounded-lg p-4"><h2 className="font-label-bold mb-2">Grupo</h2>{characters.data?.filter((character) => !combatants.some((combatant) => combatant.character_id === character.id)).map((character) => <button type="button" key={character.id} onClick={() => addPlayer(character)} className="w-full text-left py-2 border-b border-border-low-contrast">{character.name}<span className="text-secondary text-sm"> · {character.current_hp}/{character.max_hp} PV</span></button>)}</section>}
      <section className="border border-border-low-contrast rounded-lg p-4"><h2 className="font-label-bold mb-2">Registro</h2>{combat.data?.log.length === 0 && <p className="text-sm text-muted">Todavía no hay eventos.</p>}<div className="space-y-2 max-h-72 overflow-y-auto">{combat.data?.log.map((entry) => <p key={entry.id} className={`text-sm border-l-2 pl-2 ${logTone(entry)}`}>{entry.actor_id !== undefined && entry.actor_id === user?.id && <b>Tú: </b>}{entry.body}<span className="text-muted"> · {new Date(entry.created_at).toLocaleTimeString()}</span></p>)}</div></section></aside></div>}
    <Link to={`/campaign/${campaignId}`} className="text-primary font-label-bold">Volver a campaña</Link>
  </main>;
}

/** Player-facing status card for their own combatant (frontend-screens.md §20): avatar, HP/AC and a status chip. */
function PlayerStatusCard({ character, combatant }: { character: Character; combatant: Combatant }) {
  const ratio = combatant.max_hp > 0 ? combatant.hp / combatant.max_hp : 0;
  const status = combatant.hp <= 0 ? { label: 'Caído', tone: 'bg-bad-soft text-bad' } : ratio <= 0.25 ? { label: 'Crítico', tone: 'bg-warn-soft text-warn' } : { label: 'En pie', tone: 'bg-ok-soft text-ok' };
  return <section aria-label="Tu estado" className="flex items-center gap-4 rounded-lg border border-line p-4">
    <PixelAvatar appearance={character.appearance} race={character.race} klass={character.class} crop="bust" scale={3} decorative />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><h2 className="font-label-bold truncate">{character.name}</h2><span className={`mc-badge ${status.tone}`}>{status.label}</span></div>
      <p className="text-sm text-secondary">{combatant.hp}/{combatant.max_hp} PV · CA {combatant.ac ?? character.ac}</p>
      <HPBar hp={combatant.hp} max={combatant.max_hp} label={`Tus PV: ${combatant.hp} de ${combatant.max_hp}`} className="mt-2" />
    </div>
  </section>;
}
