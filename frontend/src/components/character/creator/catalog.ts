/* Catalogue helpers for the creator: classes grouped by base name (the catalogue repeats a
   class once per book) and readable book labels for the version selects. */
import type { SRDClass } from '../../../types/srd';
import { splitSource } from '../../../lib/avatar';

export interface ClassGroup { base: string; entries: SRDClass[] }

/** Core classes go first, the rest (sidekicks, playtest, homebrew) after them. */
const CORE = new Set(['artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']);

export function groupClasses(classes: SRDClass[]): ClassGroup[] {
  const map = new Map<string, ClassGroup>();
  for (const c of classes) {
    const base = splitSource(c.name).base;
    const key = base.toLowerCase();
    const g = map.get(key) ?? { base, entries: [] };
    g.entries.push(c);
    map.set(key, g);
  }
  const rank = (g: ClassGroup) => (CORE.has(g.base.toLowerCase()) ? 0 : 1);
  return [...map.values()].sort((a, b) => rank(a) - rank(b) || a.base.localeCompare(b.base));
}

const sourceOf = (e: { name: string; source?: string }) => splitSource(e.name).source || e.source || '';

/** Entry picked when a class tile is chosen: newest core book, then the 2014 one, then SRD. */
export function preferredClass(g: ClassGroup): SRDClass {
  const by = (re: RegExp) => g.entries.find((e) => re.test(sourceOf(e)));
  return by(/2024|XPHB/i) ?? by(/^PHB$|Player'?s Handbook/i) ?? g.entries.find((e) => e.is_srd) ?? g.entries[0];
}

const BOOKS: Record<string, string> = {
  XPHB: "Player's Handbook (2024)",
  PHB: "Player's Handbook (2014)",
  TCE: "Tasha's Cauldron of Everything",
  EFA: 'Eberron: Forge of the Artificer',
  Unknown: 'SRD 5.1',
};

/** Book of a catalogue entry for a version select ("Player's Handbook (2024) · SRD"). */
export function bookLabel(e: { name: string; source?: string; is_srd?: boolean }): string {
  const raw = sourceOf(e);
  const ua = /^UA(?=[A-Z])/.test(raw) ? `UA: ${raw.slice(2).replace(/([a-z])([A-Z])/g, '$1 $2')}` : '';
  const book = BOOKS[raw] ?? (ua || raw || 'Catálogo');
  return e.is_srd && raw !== 'Unknown' ? `${book} · SRD` : book;
}
