import { useQuery } from '@tanstack/react-query';
import { listRaces } from '../services/srdService';
import type { SRDRace } from '../types/srd';
import type { Character } from '../types';
import { parseCatalog } from './abilities';
import { splitSource } from './avatar/races';

const sourceOf = (race: SRDRace) => `${race.source ?? ''} ${splitSource(race.name).source}`.trim();
const isXPHB = (race: SRDRace) => /XPHB|2024/i.test(sourceOf(race));
const isPHB = (race: SRDRace) => !isXPHB(race) && /\bPHB\b|Player'?s Handbook/i.test(sourceOf(race));

/**
 * Catalogue entry for a character's race name: the version stored with the character
 * ("Elf (PHB)") when there is one, else the 2024 book (XPHB), then the 2014 PHB.
 */
export function raceEntryFor(races: SRDRace[], raceName: string): SRDRace | undefined {
  const { base, source } = splitSource(raceName);
  const same = races.filter((race) => splitSource(race.name).base.toLowerCase() === base.toLowerCase());
  const stored = source ? same.find((race) => (race.source ?? '').toLowerCase() === source.toLowerCase() || splitSource(race.name).source.toLowerCase() === source.toLowerCase()) : undefined;
  return stored ?? same.find(isXPHB) ?? same.find(isPHB) ?? same[0];
}

/** characters.race is VARCHAR(50). */
const MAX_RACE_NAME = 50;

/** Race name stored on a new character, keeping the chosen book version: "Elf" + PHB -> "Elf (PHB)". */
export function versionedRaceName(race: SRDRace): string {
  if (splitSource(race.name).source || !race.source || race.source === 'Unknown') return race.name;
  const versioned = `${race.name} (${race.source})`;
  return versioned.length <= MAX_RACE_NAME ? versioned : race.name;
}

/** Fixed skill proficiencies a race grants, lowercased (e.g. ["perception"]). */
export function raceSkillProficiencies(race: SRDRace | undefined): string[] {
  const list = parseCatalog<unknown>(race?.skill_proficiencies, []);
  return Array.isArray(list) ? list.filter((skill): skill is string => typeof skill === 'string').map((skill) => skill.toLowerCase()) : [];
}

/**
 * Passive Perception as stored: the server already adds the racial Perception proficiency
 * (PHB Elf "Keen Senses") at creation, so the sheet shows the same value as the hub and the VTT.
 * `racial` only flags that the race grants it (for the tooltip).
 */
export function usePassivePerception(character: Pick<Character, 'race' | 'passive_perception'> | undefined) {
  const races = useQuery({ queryKey: ['srd-races'], queryFn: async () => (await listRaces()).data ?? [], staleTime: 300_000, enabled: Boolean(character) });
  if (!character) return { value: 0, racial: false };
  const racial = raceSkillProficiencies(raceEntryFor(races.data ?? [], character.race)).includes('perception');
  return { value: character.passive_perception, racial };
}
