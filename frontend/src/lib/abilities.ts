/* Ability score helpers shared by character creation and the sheet. */

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITIES: [Ability, string, string][] = [
  ['str', 'FUE', 'Fuerza'], ['dex', 'DES', 'Destreza'], ['con', 'CON', 'Constitución'],
  ['int', 'INT', 'Inteligencia'], ['wis', 'SAB', 'Sabiduría'], ['cha', 'CAR', 'Carisma'],
];
export const abilityMod = (s: number) => Math.floor((s - 10) / 2);
export const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export type Method = 'standard' | 'pointbuy' | 'roll' | 'manual';
export interface StatRoll { id: number; dice: number[][]; totals: number[]; status: string }
export type Scores = Record<Ability, number>;

/** Maps catalogue bonus keys ("Strength", "str", "FUE") to abilities. */
export function toAbility(key: string): Ability | null {
  const k = key.toLowerCase();
  if (k.startsWith('str') || k.startsWith('fue')) return 'str';
  if (k.startsWith('dex') || k.startsWith('des')) return 'dex';
  if (k.startsWith('con')) return 'con';
  if (k.startsWith('int')) return 'int';
  if (k.startsWith('wis') || k.startsWith('sab')) return 'wis';
  if (k.startsWith('cha') || k.startsWith('car')) return 'cha';
  return null;
}

/** Suggests increases from a race's catalogue bonuses (only a few races carry them). */
export function suggestedIncreases(bonuses: Record<string, number> | undefined): { plus2: Ability | ''; plus1: Ability | '' } | null {
  if (!bonuses) return null;
  const entries = Object.entries(bonuses).map(([k, v]) => [toAbility(k), v] as const).filter(([a]) => a) as [Ability, number][];
  const two = entries.find(([, v]) => v >= 2)?.[0];
  const one = entries.find(([a, v]) => v === 1 && a !== two)?.[0];
  return two || one ? { plus2: two ?? '', plus1: one ?? '' } : null;
}

/** Catalogue JSON fields may arrive as strings; parse them. */
export function parseCatalog<T>(v: unknown, fallback: T): T {
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return (v ?? fallback) as T;
}

/** Strips 5etools tags: "{@item thieves' tools|PHB}" → "thieves' tools". */
export const stripTags = (s: string) => s.replace(/\{@\w+\s+([^|}]+)[^}]*\}/g, '$1');

/** Renders catalogue list entries (strings or small objects) as text. */
export function catalogList(v: unknown): string[] {
  const list = parseCatalog<unknown[]>(v, []);
  if (!Array.isArray(list)) return [];
  return list.map((x) => {
    if (typeof x === 'string') return stripTags(x);
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      const main = o.proficiency ?? o.name ?? o.choose ?? Object.values(o).find((y) => typeof y === 'string');
      return `${stripTags(String(main ?? ''))}${o.optional ? ' (opcional)' : ''}`;
    }
    return String(x);
  }).filter(Boolean);
}

/** Catalogue descriptions may contain HTML and 5etools tags; render them as plain text. */
export function catalogText(s: string | null | undefined): string {
  if (!s) return '';
  return stripTags(s)
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
