/* Dice expressions for the shared roller. */
export type Mode = 'normal' | 'adv' | 'dis' | 'secret';

/** Parses "XdY+Z" and rolls it, applying advantage/disadvantage to single d20s. */
export function rollExpression(expr: string, mode: Mode = 'normal'): { total: number; detail: string; nat: number | null } | null {
  const m = expr.replace(/\s/g, '').replace('−', '-').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const n = Number(m[1] || 1), sides = Number(m[2]), mod = Number(m[3] || 0);
  const one = () => 1 + Math.floor(Math.random() * sides);
  let rolls = Array.from({ length: n }, one);
  let note = '';
  if (sides === 20 && n === 1 && (mode === 'adv' || mode === 'dis')) {
    const a = one(), b = one();
    rolls = [mode === 'adv' ? Math.max(a, b) : Math.min(a, b)];
    note = ` (${a} y ${b} · ${mode === 'adv' ? 'ventaja' : 'desventaja'})`;
  }
  const total = rolls.reduce((s, v) => s + v, 0) + mod;
  const modTxt = mod ? (mod > 0 ? `+${mod}` : `−${Math.abs(mod)}`) : '';
  return { total, detail: `${n}d${sides}${modTxt} → [${rolls.join(', ')}]${note}`, nat: sides === 20 && n === 1 ? rolls[0] : null };
}

/** Helper for pages: roll in the shared dice roller. */
export function requestRoll(expr: string, label?: string, secret?: boolean) {
  window.dispatchEvent(new CustomEvent('dice:roll', { detail: { expr, label, secret } }));
}
