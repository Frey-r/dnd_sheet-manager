/* The 18 skills of 5e and their modifiers (ability modifier + proficiency when the race grants it). */
import { useQuery } from '@tanstack/react-query';
import { listRaces } from '../services/srdService';
import type { Character } from '../types';
import { abilityMod, type Ability } from './abilities';
import { raceEntryFor, raceSkillProficiencies } from './raceSkills';

/** [catalogue key, Spanish label, ability]. */
export const SKILLS: [string, string, Ability][] = [
  ['acrobatics', 'Acrobacias', 'dex'], ['animal handling', 'Trato con animales', 'wis'], ['arcana', 'Arcanos', 'int'],
  ['athletics', 'Atletismo', 'str'], ['deception', 'Engaño', 'cha'], ['history', 'Historia', 'int'],
  ['insight', 'Perspicacia', 'wis'], ['intimidation', 'Intimidación', 'cha'], ['investigation', 'Investigación', 'int'],
  ['medicine', 'Medicina', 'wis'], ['nature', 'Naturaleza', 'int'], ['perception', 'Percepción', 'wis'],
  ['performance', 'Interpretación', 'cha'], ['persuasion', 'Persuasión', 'cha'], ['religion', 'Religión', 'int'],
  ['sleight of hand', 'Juego de manos', 'dex'], ['stealth', 'Sigilo', 'dex'], ['survival', 'Supervivencia', 'wis'],
];

export interface SkillRow { key: string; label: string; ability: Ability; mod: number; proficient: boolean }

type Scored = Pick<Character, 'str_score' | 'dex_score' | 'con_score' | 'int_score' | 'wis_score' | 'cha_score' | 'proficiency_bonus'>;

export const scoreOf = (character: Scored, ability: Ability) => ({
  str: character.str_score, dex: character.dex_score, con: character.con_score, int: character.int_score, wis: character.wis_score, cha: character.cha_score,
})[ability];

/** Skill modifiers of a character given the skills it is proficient in (lowercase keys). */
export function skillRows(character: Scored, proficient: string[]): SkillRow[] {
  const bonus = character.proficiency_bonus || 2;
  return SKILLS.map(([key, label, ability]) => {
    const has = proficient.includes(key);
    return { key, label, ability, proficient: has, mod: abilityMod(scoreOf(character, ability)) + (has ? bonus : 0) };
  });
}

/** Passive score of a skill: 10 + its modifier. */
export const passiveOf = (rows: SkillRow[], key: string) => 10 + (rows.find((row) => row.key === key)?.mod ?? 0);

/** Skills the character's catalogue race grants (class and background choices are not stored). */
export function useSkillRows(character: (Scored & Pick<Character, 'race'>) | undefined): SkillRow[] {
  const races = useQuery({ queryKey: ['srd-races'], queryFn: async () => (await listRaces()).data ?? [], staleTime: 300_000, enabled: Boolean(character) });
  if (!character) return [];
  return skillRows(character, raceSkillProficiencies(raceEntryFor(races.data ?? [], character.race)));
}
