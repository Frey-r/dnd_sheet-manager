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

const ABILITY_LABEL: Record<string, string> = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };

/**
 * Fixed ability bonuses of a catalogue race. 5etools stores them as a list of options
 * ([{ dex: 2, choose: {...} }]); the old SRD seed used a flat object ({ dex: 2 }).
 */
export function raceAbilityBonuses(raw: unknown): Record<string, number> {
  const parsed = parseCatalog<unknown>(raw, {});
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const out: Record<string, number> = {};
  if (first && typeof first === 'object') {
    for (const [key, value] of Object.entries(first as Record<string, unknown>)) {
      if (typeof value === 'number' && ABILITY_LABEL[key]) out[key] = value;
    }
  }
  return out;
}

/** Human-readable bonus list, including "choose" options: ["DES +2", "elige 1 (+1): FUE, CON"]. */
export function raceBonusLabels(raw: unknown): string[] {
  const labels = Object.entries(raceAbilityBonuses(raw)).map(([k, v]) => `${ABILITY_LABEL[k]} ${v > 0 ? '+' : ''}${v}`);
  const parsed = parseCatalog<unknown>(raw, {});
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const choose = first && typeof first === 'object' ? (first as Record<string, unknown>).choose : undefined;
  if (choose && typeof choose === 'object') {
    const c = choose as { from?: unknown[]; count?: number; amount?: number; weighted?: { from?: unknown[]; weights?: number[] } };
    if (Array.isArray(c.from)) {
      const from = c.from.map((a) => ABILITY_LABEL[String(a)] ?? String(a)).join(', ');
      labels.push(`elige ${c.count ?? 1} (+${c.amount ?? 1}): ${from}`);
    } else if (c.weighted && Array.isArray(c.weighted.weights)) {
      labels.push(`reparte ${c.weighted.weights.map((w) => `+${w}`).join(' y ')} entre las que elijas`);
    }
  }
  return labels;
}

/** Plain text of a 5etools "entries" tree (strings, nested entries and list items). */
export function entriesText(value: unknown): string {
  if (typeof value === 'string') return catalogText(value);
  if (Array.isArray(value)) return value.map(entriesText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const parts: string[] = [];
    if (Array.isArray(o.entries)) parts.push(entriesText(o.entries));
    if (Array.isArray(o.items)) parts.push(o.items.map((i) => `• ${entriesText(i)}`).join('\n'));
    if (typeof o.entry === 'string') parts.push(catalogText(o.entry));
    return parts.filter(Boolean).join('\n');
  }
  return '';
}

const SIZE_LABEL: Record<string, string> = { T: 'Diminuto', S: 'Pequeño', M: 'Mediano', L: 'Grande', H: 'Enorme', G: 'Gargantuesco', V: 'Variable' };

/** Catalogue size code ("M") or word ("Medium") as a Spanish label. */
export function sizeLabel(size: string | null | undefined): string {
  const s = (size ?? '').trim();
  if (!s) return '';
  return SIZE_LABEL[s.toUpperCase()] ?? SIZE_LABEL[s.charAt(0).toUpperCase()] ?? s;
}

/** Ability codes ("int", ["str","dex"], '["wis","cha"]') as Spanish short labels: ["INT"], ["FUE","DES"]. */
export function abilityLabels(raw: unknown): string[] {
  const parsed = parseCatalog<unknown>(raw, []);
  const list = Array.isArray(parsed) ? parsed : typeof parsed === 'string' ? [parsed] : [];
  return list.map((x) => {
    const key = String(x).trim().toLowerCase().slice(0, 3);
    return ABILITY_LABEL[key] ?? String(x).toUpperCase();
  }).filter(Boolean);
}
