import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { characterApi, itemApi } from '../../services/api';
import { requestRoll } from '../../lib/dice';
import { getApiError } from '../../services/errors';
import { ErrorState, LoadingState } from '../ui/Feedback';
import type { Character, InventoryItem, Spell } from '../../types';

type Tab = 'attacks' | 'spells' | 'items' | 'actions';
const TABS: [Tab, string][] = [['attacks', 'Ataques'], ['spells', 'Hechizos'], ['items', 'Objetos'], ['actions', 'Acciones']];
const STANDARD_ACTIONS: [string, string][] = [
  ['Correr', 'Duplicas tu velocidad este turno.'],
  ['Destrabarse', 'Tu movimiento no provoca ataques de oportunidad este turno.'],
  ['Esquivar', 'Los ataques contra ti tienen desventaja y tienes ventaja en salvaciones de Destreza.'],
  ['Ayudar', 'Das ventaja a un aliado en su próxima prueba o ataque.'],
  ['Esconderse', 'Haz una prueba de Sigilo para ocultarte.'],
  ['Preparar', 'Elige un desencadenante y una acción para usar como reacción.'],
];

export function PlayerActions({ character, isMyTurn }: { character: Character; isMyTurn: boolean }) {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('attacks');
  const [error, setError] = useState('');
  const inventory = useQuery({ queryKey: ['inventory', character.id], queryFn: () => characterApi.inventory(character.id).then((response) => response.data as InventoryItem[]) });
  const spells = useQuery({ queryKey: ['spells', character.id], enabled: tab === 'spells', queryFn: () => characterApi.spells(character.id).then((response) => response.data as Spell[]) });
  const act = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => { setError(''); void client.invalidateQueries({ queryKey: ['inventory', character.id] }); void client.invalidateQueries({ queryKey: ['spell-slots', character.id] }); },
    onError: (reason) => setError(getApiError(reason)),
  });
  const items = inventory.data ?? [];
  const weapons = items.filter((item) => item.item_type === 'weapon');
  const consumables = items.filter((item) => (item.item_type === 'potion' || item.item_type === 'scroll') && item.quantity > 0);
  const use = (item: InventoryItem) => act.mutate(() => item.quantity <= 1 ? itemApi.remove(character.id, item.id) : itemApi.update(character.id, item.id, { quantity: item.quantity - 1 }));
  const row = 'flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0 text-sm';
  const button = 'px-3 py-1 rounded bg-primary-container text-on-primary-container text-sm disabled:opacity-50';

  return <section aria-label="Acciones del jugador" className="mc-card p-4 space-y-3">
    <div className="flex items-center justify-between"><h2 className="font-label-bold">Tus acciones · {character.name}</h2>{isMyTurn && <span className="mc-badge bg-accent-soft text-accent">Es tu turno</span>}</div>
    <div className="mc-seg" role="tablist" aria-label="Tipo de acción">{TABS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {error && <ErrorState message={error} />}
    {tab === 'attacks' && (inventory.isLoading ? <LoadingState /> : weapons.length === 0 ? <p className="text-sm text-muted">No llevas armas en el inventario.</p> : weapons.map((weapon) => <div key={weapon.id} className={row}><span>{weapon.name}{weapon.is_equipped ? '' : ' (guardada)'}</span><button type="button" className={button} onClick={() => requestRoll('1d20', `Ataque con ${weapon.name}`)}>Tirar ataque</button></div>))}
    {tab === 'spells' && (spells.isLoading ? <LoadingState /> : spells.error ? <ErrorState message="No se pudieron cargar los hechizos" /> : (spells.data ?? []).length === 0 ? <p className="text-sm text-muted">No tienes hechizos.</p> : spells.data?.map((spell) => <div key={spell.id} className={row}><span>{spell.name}<span className="ml-2 text-xs text-muted">{spell.level === 0 ? 'Truco' : `Nivel ${spell.level}`}</span></span>{spell.level === 0 ? <span className="text-xs text-muted">Sin gasto</span> : <button type="button" disabled={act.isPending} className={button} onClick={() => act.mutate(() => characterApi.castSpell(character.id, spell.id))}>Lanzar</button>}</div>))}
    {tab === 'items' && (inventory.isLoading ? <LoadingState /> : consumables.length === 0 ? <p className="text-sm text-muted">No tienes pociones ni pergaminos.</p> : consumables.map((item) => <div key={item.id} className={row}><span>{item.name} ×{item.quantity}</span><button type="button" disabled={act.isPending || item.trade_locked} className={button} onClick={() => use(item)}>Usar</button></div>))}
    {tab === 'actions' && STANDARD_ACTIONS.map(([name, text]) => <div key={name} className={row}><span><b>{name}</b><span className="block text-xs text-muted">{text}</span></span></div>)}
  </section>;
}
