/* Readable text for 5etools spell fields (time, range, duration, school), which are objects. */
import { catalogText, entriesText } from './abilities';

const SCHOOLS: Record<string, string> = {
  A: 'Abjuración', C: 'Conjuración', D: 'Adivinación', E: 'Encantamiento',
  V: 'Evocación', I: 'Ilusión', N: 'Nigromancia', T: 'Transmutación', P: 'Psiónica',
};

const UNITS: Record<string, [string, string]> = {
  action: ['acción', 'acciones'], bonus: ['acción adicional', 'acciones adicionales'],
  reaction: ['reacción', 'reacciones'], round: ['asalto', 'asaltos'], minute: ['minuto', 'minutos'],
  hour: ['hora', 'horas'], day: ['día', 'días'], week: ['semana', 'semanas'], year: ['año', 'años'],
  feet: ['pie', 'pies'], mile: ['milla', 'millas'], miles: ['milla', 'millas'],
};

const unit = (name: unknown, amount: number) => {
  const pair = UNITS[String(name)];
  return pair ? pair[amount === 1 ? 0 : 1] : String(name ?? '');
};

const asObject = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export function spellSchool(code: unknown): string {
  const s = String(code ?? '').trim();
  return SCHOOLS[s.toUpperCase()] ?? s;
}

/** [{ number: 1, unit: "action" }] → "1 acción". */
export function spellTime(value: unknown): string {
  const list = Array.isArray(value) ? value : [value];
  return list.map((t) => {
    const o = asObject(t);
    const n = Number(o.number ?? 1);
    return o.unit ? `${n} ${unit(o.unit, n)}${o.condition ? ` (${catalogText(String(o.condition))})` : ''}` : '';
  }).filter(Boolean).join(' o ');
}

/** { type: "point", distance: { type: "feet", amount: 120 } } → "120 pies"; self/touch/sight. */
export function spellRange(value: unknown): string {
  const o = asObject(value);
  const d = asObject(o.distance);
  const kind = String(d.type ?? '');
  if (kind === 'self') return o.type && o.type !== 'point' ? `Personal (${String(o.type)})` : 'Personal';
  if (kind === 'touch') return 'Toque';
  if (kind === 'sight') return 'A la vista';
  if (kind === 'unlimited') return 'Ilimitado';
  if (d.amount !== undefined) {
    const n = Number(d.amount);
    const base = `${n} ${unit(kind, n)}`;
    return o.type && o.type !== 'point' ? `Personal (${base}, ${String(o.type)})` : base;
  }
  return typeof value === 'string' ? value : '';
}

/** [{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }] → "Concentración, 1 minuto". */
export function spellDuration(value: unknown): string {
  const list = Array.isArray(value) ? value : [value];
  return list.map((entry) => {
    const o = asObject(entry);
    switch (o.type) {
      case 'instant': return 'Instantáneo';
      case 'permanent': return 'Hasta que se disipe';
      case 'special': return 'Especial';
      case 'timed': {
        const d = asObject(o.duration);
        const n = Number(d.amount ?? 1);
        const text = `${n} ${unit(d.type, n)}`;
        return o.concentration ? `Concentración, hasta ${text}` : text;
      }
      default: return typeof entry === 'string' ? entry : '';
    }
  }).filter(Boolean).join(' o ');
}

/** Spell description from its entries, with 5etools {@tags} stripped. */
export function spellDescription(entries: unknown, higher?: unknown): string {
  const main = entriesText(entries);
  const upcast = entriesText(higher);
  return upcast ? `${main}\n\n${upcast}` : main;
}
