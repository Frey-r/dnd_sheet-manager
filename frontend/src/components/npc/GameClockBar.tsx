/* In-game clock of the campaign (npc-agenda.md §1): everyone sees it; the GM moves it and re-applies the agenda. */
import { clockLabel, type GameClock } from '../../lib/npc/agenda';

export function GameClockBar({ clock, isGM, onStep, onApply, busy = false }: {
  clock: GameClock; isGM: boolean; onStep: (step: 1 | -1) => void; onApply: () => void; busy?: boolean;
}) {
  const icon = clock.time_of_day === 'noche' ? 'dark_mode' : clock.time_of_day === 'tarde' ? 'wb_twilight' : 'light_mode';
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-1.5 py-1 text-xs text-ink-2 shadow-[var(--shadow-1)]">
      {isGM && (
        <button type="button" aria-label="Retroceder el reloj" disabled={busy} onClick={() => onStep(-1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-card-2 disabled:opacity-50">
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
      )}
      <span className="inline-flex items-center gap-1.5 px-1">
        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">{icon}</span>
        <span>{clockLabel(clock)}</span>
      </span>
      {isGM && (
        <>
          <button type="button" aria-label="Avanzar el reloj" disabled={busy} onClick={() => onStep(1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-card-2 disabled:opacity-50">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
          <button type="button" aria-label="Reaplicar agenda" title="Coloca a cada PNJ donde dice su agenda ahora" disabled={busy} onClick={onApply} className="grid h-6 w-6 place-items-center rounded-full hover:bg-card-2 disabled:opacity-50">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">event_repeat</span>
          </button>
        </>
      )}
    </div>
  );
}
