/* Groups catalogue races by base race for the picker (character-appearance.md). */
import type { SRDRace } from '../../types/srd';
import { COMMON_RACES, splitSource } from './races';

export interface RaceGroup { base: string; entries: SRDRace[] }

/** Groups "Elf (PHB)", "Elf (XPHB)"… under "Elf"; common races first, then alphabetical. */
export function groupRaces(races: SRDRace[]): RaceGroup[] {
  const map = new Map<string, RaceGroup>();
  for (const r of races) {
    const base = splitSource(r.name).base;
    const key = base.toLowerCase();
    const g = map.get(key) ?? { base, entries: [] };
    g.entries.push(r);
    map.set(key, g);
  }
  const rank = (b: string) => {
    const i = COMMON_RACES.findIndex((c) => c.toLowerCase() === b.toLowerCase());
    return i === -1 ? COMMON_RACES.length : i;
  };
  return [...map.values()].sort((a, b) => rank(a.base) - rank(b.base) || a.base.localeCompare(b.base));
}

/** The entry chosen by default when a base race is picked: newest core book, then SRD, then first. */
export function preferredEntry(g: RaceGroup): SRDRace {
  const by = (re: RegExp) => g.entries.find((e) => re.test(splitSource(e.name).source));
  return by(/2024|XPHB/i) ?? by(/Player'?s Handbook|PHB/i) ?? g.entries.find((e) => e.is_srd) ?? g.entries[0];
}
