/* Rules shared by the creators' pages and panels: what blocks Origen, and the NPC stats (an empty
   field shows its suggestion and keeps it; character-appearance.md § NPC creator). */
import { ABILITIES, abilityMod, type Ability } from '../../../lib/abilities';

/** What Origen still needs, or '' when race and class (or "Sin clase") are chosen. */
export function originProblem(hasRace: boolean, hasClass: boolean): string {
  if (hasRace && hasClass) return '';
  if (hasRace) return 'Elige una clase.';
  return hasClass ? 'Elige una raza.' : 'Elige una raza y una clase.';
}

export type StatKey = Ability | 'ac' | 'hp' | 'speed';
export type Stats<T> = Record<StatKey, T>;

export const COMBAT_STATS: [key: StatKey, label: string, min: number, max: number][] = [
  ['ac', 'Clase de armadura', 0, 30],
  ['hp', 'Puntos de golpe', 1, 999],
  ['speed', 'Velocidad', 0, 120],
];
export const STAT_KEYS: StatKey[] = [...ABILITIES.map(([key]) => key), ...COMBAT_STATS.map(([key]) => key)];
const DEFAULT_SCORE = 10;
/** Abilities and AC start at 10 (an unarmoured commoner). */
const BASE = Object.fromEntries(STAT_KEYS.map((key) => [key, DEFAULT_SCORE])) as Stats<number>;

/** The typed value, or the suggestion while the field is empty. */
export function statValues(draft: Stats<string>, suggested: Stats<number>): Stats<number> {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, draft[key] === '' ? suggested[key] : Number(draft[key])])) as Stats<number>;
}

/** Suggestions for the empty fields: 10 for the abilities and AC, the race speed and HP = hit die + CON modifier. */
export function suggestedStats(draft: Stats<string>, hitDie: number, speed: number): Stats<number> {
  const con = draft.con === '' ? DEFAULT_SCORE : Number(draft.con);
  return { ...BASE, hp: Math.max(1, hitDie + abilityMod(con)), speed };
}

export const RELATIONS = [['ally', 'Aliado'], ['neutral', 'Neutral'], ['enemy', 'Enemigo']] as const;
