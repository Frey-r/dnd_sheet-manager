// SRD Reference Data Types — D&D 5e
// Mirrors the Go domain models for type-safe frontend consumption.

// ── Monsters ────────────────────────────────────────────────

export interface SRDMonster {
  id: number;
  name: string;
  size: string;
  type: string;
  subtype: string;
  alignment: string;
  ac: number;
  ac_type: string;
  hp: number;
  hit_dice: string;
  speed: Record<string, string | number>;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  cr: string;
  xp: number;
  senses: string;
  languages: string;
  traits: MonsterAction[];
  actions: MonsterAction[];
  legendary_actions: MonsterAction[];
  reactions: MonsterAction[];
  resistances: string;
  immunities: string;
  vulnerabilities: string;
  condition_immunities: string;
  saving_throws: Record<string, number>;
  skills: Record<string, number>;
  proficiency_bonus: number;
  is_srd: boolean;
  /** Book code from the 5etools catalog (e.g. "XMM") or "Homebrew". */
  source: string;
  /** Set only for user-made homebrew; imported content is read-only. */
  created_by: number | null;
  is_homebrew: boolean;
}

export interface MonsterAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage_dice?: string;
  damage_type?: string;
}

export interface MonsterListItem {
  id: number;
  name: string;
  size: string;
  type: string;
  cr: string;
  xp: number;
  hp: number;
  ac: number;
  is_srd: boolean;
  source: string;
  is_homebrew: boolean;
}

export interface MonsterFilters {
  query?: string;
  cr?: string;
  cr_min?: number;
  cr_max?: number;
  type?: string;
  size?: string;
  is_srd?: boolean;
  limit?: number;
  offset?: number;
}

// ── Spells ──────────────────────────────────────────────────

export interface SRDSpell {
  id: number;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  components_v: boolean;
  components_s: boolean;
  components_m: boolean;
  material_desc: string;
  description: string;
  higher_levels: string;
  classes: string[];
  damage_type: string;
  area_type: string;
  is_srd: boolean;
}

export interface SpellListItem {
  id: number;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  concentration: boolean;
  ritual: boolean;
  is_srd: boolean;
}

export interface SpellFilters {
  query?: string;
  level?: number;
  school?: string;
  class?: string;
  concentration?: boolean;
  ritual?: boolean;
  damage_type?: string;
  is_srd?: boolean;
  limit?: number;
  offset?: number;
}

// ── Equipment ───────────────────────────────────────────────

export interface SRDEquipment {
  id: number;
  name: string;
  category: string;
  cost_gp: number;
  cost_unit: string;
  weight: number;
  description: string;
  damage_dice: string;
  damage_type: string;
  weapon_category: string;
  weapon_range: string;
  range_normal: number;
  range_long: number;
  properties: string[];
  ac_base: number | null;
  ac_dex_bonus: boolean | null;
  ac_max_bonus: number | null;
  str_minimum: number | null;
  stealth_disadvantage: boolean;
  armor_category: string;
  is_srd: boolean;
}

export interface EquipmentFilters {
  query?: string;
  category?: string;
  weapon_category?: string;
  armor_category?: string;
  is_srd?: boolean;
  limit?: number;
  offset?: number;
}

// ── Magic Items ─────────────────────────────────────────────

export interface SRDMagicItem {
  id: number;
  name: string;
  rarity: string;
  requires_attunement: boolean;
  attunement_desc: string;
  description: string;
  category: string;
  is_srd: boolean;
}

export interface MagicItemFilters {
  query?: string;
  rarity?: string;
  is_srd?: boolean;
  limit?: number;
  offset?: number;
}

// ── Classes ─────────────────────────────────────────────────

export interface SRDClass {
  id: number;
  name: string;
  /** 5etools book code (e.g. "XPHB", "PHB"). */
  source?: string;
  hit_die: number;
  primary_ability: string;
  saving_throws: string[];
  armor_proficiencies: string[];
  weapon_proficiencies: string[];
  tool_proficiencies: string[];
  skill_choices: { count: number; options: string[] };
  starting_equipment: string;
  spellcasting_ability: string;
  description: string;
  is_srd: boolean;
  features?: SRDClassFeature[];
  spell_slots?: SRDClassSpellSlot[];
}

export interface SRDClassFeature {
  id: number;
  class_id: number;
  name: string;
  level: number;
  description: string;
}

export interface SRDClassSpellSlot {
  id: number;
  class_id: number;
  class_level: number;
  cantrips_known: number;
  spells_known: number;
  slot_1: number;
  slot_2: number;
  slot_3: number;
  slot_4: number;
  slot_5: number;
  slot_6: number;
  slot_7: number;
  slot_8: number;
  slot_9: number;
}

// ── Races ───────────────────────────────────────────────────

export interface SRDRace {
  id: number;
  name: string;
  /** 5etools book code (e.g. "XPHB", "PHB"). */
  source?: string;
  speed: number;
  size: string;
  ability_bonuses: Record<string, number>;
  traits: { name: string; description: string }[];
  languages: string[];
  subraces: { name: string; description: string; ability_bonuses?: Record<string, number> }[];
  /** Skills the race always grants (JSON array as sent by the API, e.g. '["perception"]'). */
  skill_proficiencies?: string[] | string;
  description: string;
  is_srd: boolean;
}

// ── Conditions ──────────────────────────────────────────────

export interface SRDCondition {
  id: number;
  name: string;
  description: string;
  effects: string[];
  is_srd: boolean;
}

// ── Rules ───────────────────────────────────────────────────

export interface SRDRule {
  id: number;
  name: string;
  category: string;
  content: string;
  parent_rule_id: number | null;
  is_srd: boolean;
}

export interface RulesFilters {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

// ── Encounter Builder ───────────────────────────────────────

export interface EncounterRequest {
  party_size: number;
  party_level: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  monster_type?: string;
  max_monster_count?: number;
}

export interface PartyBudget {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

export interface MonsterSuggestion {
  monster_id: number;
  name: string;
  cr: string;
  xp: number;
  count: number;
}

export interface EncounterSuggestion {
  monsters: MonsterSuggestion[];
  total_xp: number;
  adjusted_xp: number;
  monster_count: number;
  actual_difficulty: string;
}

export interface EncounterResult {
  party_budget: PartyBudget;
  target_difficulty: string;
  suggestions: EncounterSuggestion[];
}

// ── Loadout Analyzer ────────────────────────────────────────

export interface LoadoutRequest {
  equipment_ids: number[];
  str_score: number;
  dex_score: number;
}

export interface LoadoutResult {
  ac_formula: string;
  total_ac: number;
  total_weight: number;
  total_cost: number;
  carrying_capacity: number;
  is_encumbered: boolean;
  is_heavily_encumbered: boolean;
  warnings: string[];
}

// ── Paginated Results ───────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
