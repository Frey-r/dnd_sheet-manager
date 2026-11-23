/* Catalogue fixtures for the character creator tests (contratos/T-5-creador-wow.md):
   Human, Elf with two book entries, Tiefling and Dwarf; Wizard, Fighter and Rogue.
   Names carry the book like the 5etools catalogue does. */
import type { SRDClass, SRDRace } from '../types/srd';

const race = (r: Pick<SRDRace, 'id' | 'name'> & Partial<SRDRace>): SRDRace => ({
  speed: 30, size: 'M', ability_bonuses: {}, traits: [], languages: ['Common'], subraces: [], description: '', is_srd: false, ...r,
});

const klass = (c: Pick<SRDClass, 'id' | 'name' | 'hit_die'> & Partial<SRDClass>): SRDClass => ({
  primary_ability: '', saving_throws: [], armor_proficiencies: [], weapon_proficiencies: [], tool_proficiencies: [],
  skill_choices: { count: 0, options: [] }, starting_equipment: '', spellcasting_ability: '', description: '', is_srd: false, ...c,
});

export const HUMAN = race({ id: 10, name: "Human (Player's Handbook (2024))", source: 'XPHB', is_srd: true, traits: [{ name: 'Resourceful', description: 'Gain Heroic Inspiration after a long rest.' }] });
export const ELF_PHB = race({ id: 11, name: "Elf (Player's Handbook)", source: 'PHB', ability_bonuses: { dex: 2 }, languages: ['Common', 'Elvish'], skill_proficiencies: ['perception'], traits: [{ name: 'Trance', description: 'Meditate deeply for four hours a day.' }] });
export const ELF_2024 = race({ id: 12, name: "Elf (Player's Handbook (2024))", source: 'XPHB', is_srd: true, languages: ['Common', 'Elvish'], traits: [{ name: 'Elven Lineage', description: 'Choose drow, high elf or wood elf.' }] });
export const TIEFLING = race({ id: 13, name: "Tiefling (Player's Handbook)", source: 'PHB', ability_bonuses: { cha: 2, int: 1 }, traits: [{ name: 'Hellish Resistance', description: 'Resistance to fire damage.' }] });
export const DWARF = race({ id: 14, name: "Dwarf (Player's Handbook)", source: 'PHB', speed: 25, ability_bonuses: { con: 2 }, traits: [{ name: 'Dwarven Resilience', description: 'Advantage against poison.' }] });

export const RACES: SRDRace[] = [DWARF, ELF_PHB, HUMAN, TIEFLING, ELF_2024];
export const ELF_ENTRIES = [ELF_PHB, ELF_2024];

export const WIZARD = klass({ id: 21, name: 'Wizard', source: 'PHB', hit_die: 6, primary_ability: 'int', saving_throws: ['int', 'wis'], weapon_proficiencies: ['Daggers', 'Quarterstaffs'], skill_choices: { count: 2, options: ['Arcana', 'History'] }, spellcasting_ability: 'int', is_srd: true });
export const FIGHTER = klass({ id: 22, name: 'Fighter', source: 'PHB', hit_die: 10, primary_ability: 'str', saving_throws: ['str', 'con'], armor_proficiencies: ['Heavy armor'], weapon_proficiencies: ['Martial weapons'] });
export const ROGUE = klass({ id: 23, name: "Rogue (Player's Handbook (2024))", source: 'XPHB', hit_die: 8, primary_ability: 'dex', saving_throws: ['dex', 'int'], tool_proficiencies: ["Thieves' Tools"] });

export const CLASSES: SRDClass[] = [WIZARD, FIGHTER, ROGUE];
