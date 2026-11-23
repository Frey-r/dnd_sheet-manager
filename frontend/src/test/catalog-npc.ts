/* Fixtures for the sidekick and NPC creator tests (contratos/T-12-sin-sidekicks-jugadores.md,
   contratos/T-14-npc-creador.md): the three Tasha's sidekick classes (with and without the book in
   the name), Halfling, and campaign NPCs as the API returns them (a new one with race, class and
   appearance; two created before T-13, one with an uploaded portrait and one without). */
import type { SRDClass, SRDRace } from '../types/srd';
import { normalizeAppearance, resolveRaceVisual, type Appearance } from '../lib/avatar';
import { CLASSES, RACES } from './catalog';

const klass = (c: Pick<SRDClass, 'id' | 'name' | 'hit_die'> & Partial<SRDClass>): SRDClass => ({
  primary_ability: '', saving_throws: [], armor_proficiencies: [], weapon_proficiencies: [], tool_proficiencies: [],
  skill_choices: { count: 0, options: [] }, starting_equipment: '', spellcasting_ability: '', description: '', is_srd: false, source: 'TCE', ...c,
});

export const EXPERT_SIDEKICK = klass({ id: 41, name: 'Expert Sidekick', hit_die: 8, primary_ability: 'dex' });
export const SPELLCASTER_SIDEKICK = klass({ id: 42, name: "Spellcaster Sidekick (Tasha's Cauldron of Everything)", hit_die: 8, primary_ability: 'int', spellcasting_ability: 'int' });
export const WARRIOR_SIDEKICK = klass({ id: 43, name: "Warrior Sidekick (Tasha's Cauldron of Everything)", hit_die: 8, primary_ability: 'str', armor_proficiencies: ['Light armor', 'Medium armor', 'Shields'] });
/** Same class without the book in the name (the catalogue lists a class once per book). */
export const WARRIOR_SIDEKICK_PLAIN = klass({ id: 44, name: 'Warrior Sidekick', hit_die: 8, primary_ability: 'str' });

/** One entry per sidekick class: what the NPC creator offers in "Compañeros". */
export const SIDEKICKS: SRDClass[] = [EXPERT_SIDEKICK, SPELLCASTER_SIDEKICK, WARRIOR_SIDEKICK];
export const SIDEKICK_BASES = ['Expert Sidekick', 'Spellcaster Sidekick', 'Warrior Sidekick'] as const;
/** T-5 classes (Wizard, Fighter, Rogue) plus the sidekicks, with and without book. */
export const CLASSES_WITH_SIDEKICKS: SRDClass[] = [...CLASSES, EXPERT_SIDEKICK, SPELLCASTER_SIDEKICK, WARRIOR_SIDEKICK, WARRIOR_SIDEKICK_PLAIN];
/** T-5 classes plus one entry per sidekick (the NPC creator tests). */
export const NPC_CLASSES: SRDClass[] = [...CLASSES, ...SIDEKICKS];

export const HALFLING: SRDRace = {
  id: 15, name: "Halfling (Player's Handbook)", source: 'PHB', speed: 25, size: 'S', ability_bonuses: { dex: 2 },
  traits: [{ name: 'Lucky', description: 'Reroll a 1 on an attack roll, ability check or saving throw.' }],
  languages: ['Common', 'Halfling'], subraces: [], description: '', is_srd: false,
};
export const NPC_RACES: SRDRace[] = [...RACES, HALFLING];
export const HALFLING_VISUAL = resolveRaceVisual(HALFLING.name, HALFLING.size);

/** Stored appearance of Pip: hair style 5 ("Largo", not the Halfling default), slim body. */
export const PIP_APPEARANCE: Appearance = normalizeAppearance(
  { v: 1, body: 1, skin: '#e0ac69', eyes: '#4a8a4a', hair: 5, hairColor: '#a0522d', outfit: 3, outfitColors: ['#7a2e2e', '#d9b26f'], feature: 1 },
  HALFLING_VISUAL,
);

export const PIP_STATS = { str: 8, dex: 16, con: 12, int: 10, wis: 13, cha: 14, ac: 13, hp: 9, speed: 25 };

export type NPCRecord = {
  id: number; campaign_id: number; name: string; role: string; status: string; description: string;
  stats: Record<string, unknown> | null; image_url: string; race: string; class: string; appearance: Appearance | null;
};

/** NPC created with the new creator (race, class and appearance). */
export const NPC_PIP: NPCRecord = {
  id: 5, campaign_id: 7, name: 'Pip', role: 'Cocinero del gremio', status: 'ally', description: 'Sabe todos los rumores del puerto.',
  stats: PIP_STATS, image_url: '', race: HALFLING.name, class: WARRIOR_SIDEKICK.name, appearance: PIP_APPEARANCE,
};
/** NPC created before T-13 with an uploaded portrait: no race, class or appearance. */
export const NPC_PORTRAIT: NPCRecord = {
  id: 3, campaign_id: 7, name: 'Lady Vex', role: 'Espía', status: 'enemy', description: '', stats: { ac: 12, hp: 20 },
  image_url: 'https://cdn.example/vex.png', race: '', class: '', appearance: null,
};
/** NPC created before T-13 without portrait: only the initials remain. */
export const NPC_PLAIN: NPCRecord = {
  id: 2, campaign_id: 7, name: 'Viejo Marlo', role: 'Barquero', status: 'neutral', description: '', stats: {},
  image_url: '', race: '', class: '', appearance: null,
};
export const NPC_LIST: NPCRecord[] = [NPC_PIP, NPC_PORTRAIT, NPC_PLAIN];
