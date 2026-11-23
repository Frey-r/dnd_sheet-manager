import { useState } from 'react';
import type { Character } from '../../types';

type Props = { character: Character; pending: boolean; onChange: (hp: { current_hp: number; temp_hp: number }) => void };

/** Hit point tracker: damage (temp HP first), healing and temp HP entry. */
export function HpPanel({ character, pending, onChange }: Props) {
  const [amount, setAmount] = useState('');
  const [temp, setTemp] = useState('');
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  const percent = character.max_hp > 0 ? Math.max(0, Math.min((character.current_hp / character.max_hp) * 100, 100)) : 0;

  const damage = () => {
    if (value <= 0) return;
    const absorbed = Math.min(character.temp_hp, value);
    onChange({ current_hp: Math.max(0, character.current_hp - (value - absorbed)), temp_hp: character.temp_hp - absorbed });
    setAmount('');
  };
  const heal = () => {
    if (value <= 0) return;
    onChange({ current_hp: Math.min(character.max_hp, character.current_hp + value), temp_hp: character.temp_hp });
    setAmount('');
  };
  const setTempHP = () => {
    const next = Math.max(0, Math.floor(Number(temp) || 0));
    onChange({ current_hp: character.current_hp, temp_hp: next });
    setTemp('');
  };

  return (
    <section className="bg-surface border border-border-low-contrast rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex justify-between items-end">
        <div>
          <span className="font-label-bold text-on-surface-variant uppercase tracking-wider">Puntos de golpe</span>
          <div className="flex items-baseline gap-1">
            <span className="font-stat-number text-on-surface">{character.current_hp}</span>
            <span className="font-body-lg text-secondary">/ {character.max_hp > 0 ? character.max_hp : '—'}</span>
            {character.temp_hp > 0 && <span className="ml-2 font-label-bold text-primary">+{character.temp_hp} temp.</span>}
          </div>
        </div>
      </div>
      <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden border border-border-low-contrast" role="progressbar" aria-valuemin={0} aria-valuemax={character.max_hp} aria-valuenow={character.current_hp} aria-label="Puntos de golpe">
        <div className={`h-full rounded-full ${percent < 30 ? 'bg-hp-danger' : percent < 60 ? 'bg-gm-amber' : 'bg-success-active'}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input type="number" min={0} inputMode="numeric" aria-label="Cantidad de daño o curación" placeholder="Cantidad" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-10 w-24 px-3" />
        <button type="button" disabled={pending || value <= 0 || character.current_hp <= 0 && character.temp_hp <= 0} onClick={damage} className="px-4 h-10 rounded bg-surface-container font-label-bold disabled:opacity-50">Daño</button>
        <button type="button" disabled={pending || value <= 0 || character.max_hp <= 0 || character.current_hp >= character.max_hp} onClick={heal} className="px-4 h-10 rounded bg-primary-container text-on-primary-container font-label-bold disabled:opacity-50">Curar</button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input type="number" min={0} inputMode="numeric" aria-label="PV temporales" placeholder="PV temporales" value={temp} onChange={(event) => setTemp(event.target.value)} className="h-10 w-32 px-3" />
        <button type="button" disabled={pending || temp === ''} onClick={setTempHP} className="px-4 h-10 rounded border border-border-low-contrast font-label-bold disabled:opacity-50">Fijar PV temp.</button>
      </div>
    </section>
  );
}
