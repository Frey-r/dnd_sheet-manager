type HPTone = 'ok' | 'warn' | 'bad';

/** Verde > 60 %, ámbar 30-60 %, rojo < 30 % o a 0 PV. */
function hpTone(hp: number, max: number): HPTone {
  if (max <= 0 || hp <= 0) return 'bad';
  const ratio = hp / max;
  return ratio < 0.3 ? 'bad' : ratio < 0.6 ? 'warn' : 'ok';
}

const TONE_CLASS: Record<HPTone, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };

type Props = { hp: number; max: number; label?: string; className?: string; thin?: boolean };

export function HPBar({ hp, max, label = 'Puntos de golpe', className = '', thin = false }: Props) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0, hp)} className={`${thin ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full bg-card-3 ${className}`}>
    <div className={`h-full rounded-full transition-[width] ${TONE_CLASS[hpTone(hp, max)]}`} style={{ width: `${percent}%` }} />
  </div>;
}
