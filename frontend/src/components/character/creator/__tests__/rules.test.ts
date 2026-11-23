// @vitest-environment node
/* Creator rules (T-14, complement to the locked NPCCreator tests): what blocks Origen and the NPC stats
   (empty field = suggestion; HP = hit die + CON modifier, never below 1). */
import { describe, expect, it } from 'vitest';
import { COMBAT_STATS, RELATIONS, STAT_KEYS, originProblem, statValues, suggestedStats, type Stats } from '../rules';

const EMPTY = Object.fromEntries(STAT_KEYS.map((key) => [key, ''])) as Stats<string>;

describe('originProblem (T-14)', () => {
  it.each([
    [true, true, ''],
    [true, false, 'Elige una clase.'],
    [false, true, 'Elige una raza.'],
    [false, false, 'Elige una raza y una clase.'],
  ])('raza %s, clase %s → "%s"', (hasRace, hasClass, expected) => {
    expect(originProblem(hasRace, hasClass)).toBe(expected);
  });
});

describe('estadísticas del PNJ (T-14)', () => {
  it('las claves son las seis características y después CA, PG y velocidad', () => {
    expect(STAT_KEYS).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha', 'ac', 'hp', 'speed']);
    expect(COMBAT_STATS.map(([key, , min, max]) => [key, min, max])).toEqual([['ac', 0, 30], ['hp', 1, 999], ['speed', 0, 120]]);
    expect(RELATIONS.map(([value]) => value)).toEqual(['ally', 'neutral', 'enemy']);
  });

  it('sugeridas: 10 en características y CA, la velocidad de la raza y PG = dado + mod. CON por defecto', () => {
    expect(suggestedStats(EMPTY, 8, 25)).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ac: 10, hp: 8, speed: 25 });
  });

  it('los PG sugeridos usan la CON escrita y nunca bajan de 1', () => {
    expect(suggestedStats({ ...EMPTY, con: '14' }, 8, 30).hp).toBe(10);
    expect(suggestedStats({ ...EMPTY, con: '9' }, 4, 30).hp).toBe(3);
    expect(suggestedStats({ ...EMPTY, con: '1' }, 4, 30).hp).toBe(1);
  });

  it('statValues: lo escrito manda; lo vacío toma la sugerencia', () => {
    const draft = { ...EMPTY, str: '8', hp: '0', speed: '20' };
    const suggested = suggestedStats(draft, 6, 30);
    expect(statValues(draft, suggested)).toEqual({ str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ac: 10, hp: 0, speed: 20 });
  });
});
