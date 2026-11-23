import { useEffect, useState } from 'react';
import { rollExpression, type Mode } from '../../lib/dice';

interface Roll { label: string; total: number; detail: string; nat: number | null; secret: boolean }

const DICE = [20, 12, 10, 8, 6, 4];

/** Floating quick dice roller (design-system.md §Shell). Pages can trigger it with
 *  window.dispatchEvent(new CustomEvent('dice:roll', { detail: { expr: '1d20+5', label: 'Percepción' } })). */
export function DiceRoller({ isGM }: { isGM: boolean }) {
  const [open, setOpen] = useState(false);
  const [die, setDie] = useState(20);
  const [mod, setMod] = useState(0);
  const [mode, setMode] = useState<Mode>('normal');
  const [log, setLog] = useState<Roll[]>([]);
  const [anim, setAnim] = useState(0);

  const roll = (expr: string, label: string, secret = false) => {
    const r = rollExpression(expr, mode);
    if (!r) return;
    setLog((l) => [{ ...r, label, secret: secret || mode === 'secret' }, ...l].slice(0, 12));
    setAnim((a) => a + 1);
    setOpen(true);
  };

  useEffect(() => {
    const onRoll = (e: Event) => {
      const d = (e as CustomEvent<{ expr: string; label?: string; secret?: boolean }>).detail;
      if (d?.expr) roll(d.expr, d.label || d.expr, d.secret);
    };
    window.addEventListener('dice:roll', onRoll);
    return () => window.removeEventListener('dice:roll', onRoll);
  });

  const last = log[0];
  const modes: [Mode, string][] = [['normal', 'Normal'], ['adv', 'Ventaja'], ['dis', 'Desv.'], ...(isGM ? [['secret', 'Secreta'] as [Mode, string]] : [])];
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Lanzador rápido de dados" title="Tirada rápida"
        className="fixed bottom-[84px] right-4 z-[55] grid h-[52px] w-[52px] place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_14px_30px_-10px_var(--accent-line)] transition-transform hover:-translate-y-0.5 hover:-rotate-6 active:scale-95 md:bottom-6 md:right-6 md:h-14 md:w-14">
        <svg viewBox="0 0 24 24" className="h-[26px] w-[26px] fill-none stroke-current" strokeWidth={1.8} strokeLinejoin="round"><path d="M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3z" /><path d="M12 2.5 7.5 15h9z" /><path d="M3.5 7.3 7.5 15 3.5 16.7M20.5 7.3 16.5 15l4 1.7M7.5 15 12 21.5l4.5-6.5" /></svg>
      </button>
      {open && (
        <section aria-label="Lanzador de dados" className="mc-card fixed bottom-[148px] left-2 right-2 z-[56] overflow-hidden !rounded-2xl shadow-[var(--shadow-3)] md:bottom-[92px] md:left-auto md:right-6 md:w-[344px]">
          <div className="flex items-center justify-between px-3.5 pb-2.5 pt-3"><b className="text-[13px]">Tirada rápida</b>
            <button type="button" onClick={() => setOpen(false)} className="mc-btn mc-btn-ghost mc-btn-sm mc-btn-icon" aria-label="Cerrar"><span className="material-symbols-outlined text-[18px]">close</span></button></div>
          <div key={anim} className="mx-3.5 rounded-xl border border-line bg-bg-elev p-4 text-center">
            <div className="mc-eyebrow">{last ? `${last.label}${last.secret ? ' · solo tú' : ''}` : 'Listo para tirar'}</div>
            <div className={`font-mono text-[52px] font-semibold leading-none tracking-tighter ${last?.nat === 20 ? 'text-ok' : last?.nat === 1 ? 'text-bad' : last ? '' : 'text-faint'}`}>{last ? last.total : '—'}</div>
            <div className="mt-1.5 font-mono text-xs text-muted">{last ? last.detail : 'Elige un dado o toca un atributo'}</div>
          </div>
          <div className="grid grid-cols-6 gap-1.5 px-3.5 pt-3">
            {DICE.map((d) => (
              <button key={d} type="button" onClick={() => setDie(d)} aria-pressed={die === d}
                className={`h-11 rounded-lg border font-mono text-xs font-semibold transition-colors ${die === d ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-card-2 text-ink-2 hover:border-line-strong'}`}>d{d}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
            <span className="text-xs text-muted">Mod.</span>
            <div className="inline-flex h-8 items-center rounded-md border border-line-strong bg-bg-elev">
              <button type="button" className="h-full w-7 text-muted hover:text-ink" onClick={() => setMod((m) => m - 1)} aria-label="Restar">−</button>
              <span className="min-w-8 text-center font-mono text-[13px] font-semibold">{mod >= 0 ? `+${mod}` : mod}</span>
              <button type="button" className="h-full w-7 text-muted hover:text-ink" onClick={() => setMod((m) => m + 1)} aria-label="Sumar">+</button>
            </div>
            <div className="mc-seg ml-auto">{modes.map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div>
          </div>
          <div className="px-3.5 pb-3"><button type="button" className="mc-btn mc-btn-primary w-full" onClick={() => roll(`1d${die}${mod ? (mod > 0 ? `+${mod}` : mod) : ''}`, `1d${die}`)}>Tirar 1d{die}{mod ? (mod > 0 ? `+${mod}` : `−${-mod}`) : ''}</button></div>
          {log.length > 1 && (
            <div className="max-h-28 overflow-auto border-t border-line py-1.5">
              {log.slice(1, 7).map((r, i) => <div key={i} className="flex justify-between px-3.5 py-1 text-xs text-muted"><span>{r.label}{r.secret ? ' · secreta' : ''}</span><b className="font-mono text-ink">{r.total}</b></div>)}
            </div>
          )}
        </section>
      )}
    </>
  );
}
