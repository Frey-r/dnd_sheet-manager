/* «Guardar en la agenda…» (npc-agenda.md §4): records the token's current scene, position and route as the
   NPC's entry for a day and time of day (by default, the current ones). */
import { useState } from 'react';
import { dayLabel, MOMENTS, momentLabel, WEEKDAYS, type DaySpec, type GameClock, type TimeOfDay } from '../../lib/npc/agenda';

export function SaveToAgendaDialog({ tokenName, clock, onSave, onCancel }: {
  tokenName: string; clock: GameClock; onSave: (dia: DaySpec, momento: TimeOfDay) => void; onCancel: () => void;
}) {
  const [dia, setDia] = useState(String(clock.game_day));
  const [momento, setMomento] = useState<TimeOfDay>(clock.time_of_day);
  const options: [string, string][] = [
    [String(clock.game_day), `Solo el día ${clock.game_day} (hoy)`], ['todos', dayLabel('todos')], ['laborables', dayLabel('laborables')],
    ['fin_de_semana', dayLabel('fin_de_semana')], ...WEEKDAYS.map((w) => [w, `Cada ${dayLabel(w).toLowerCase()}`] as [string, string]),
  ];
  return (
    <div role="dialog" aria-modal="true" aria-label={`Agenda de ${tokenName}`} className="mc-card flex w-72 flex-col gap-3 p-4 shadow-[var(--shadow-3)]">
      <div><span className="mc-eyebrow">Agenda de {tokenName}</span>
        <p className="mt-0.5 text-xs text-muted">Guarda dónde está y su rutina actual (escena, posición y ruta).</p></div>
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Día
        <select className="h-9 w-full px-2.5 text-[13.5px]" value={dia} onChange={(e) => setDia(e.target.value)}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></label>
      <label className="flex flex-col gap-1 text-[12.5px] font-medium text-ink-2">Momento
        <select className="h-9 w-full px-2.5 text-[13.5px]" value={momento} onChange={(e) => setMomento(e.target.value as TimeOfDay)}>
          {MOMENTS.map((m) => <option key={m} value={m}>{momentLabel(m)}</option>)}
        </select></label>
      <div className="flex justify-end gap-2">
        <button type="button" className="mc-btn mc-btn-sm" onClick={onCancel}>Cancelar</button>
        <button type="button" className="mc-btn mc-btn-sm mc-btn-primary" onClick={() => onSave(/^\d+$/.test(dia) ? Number(dia) : dia, momento)}>Guardar en la agenda</button>
      </div>
    </div>
  );
}
