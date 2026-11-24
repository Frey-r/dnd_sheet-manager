/* NPC combat sheet (npc-agenda.md §5); the server fills the same defaults (service.DefaultNPCCombat). */
export interface NPCCombat {
  hp: number; max_hp: number; ac: number; speed_ft: number; passive_perception: number; darkvision_ft: number;
  blindsight_ft: number; dex_mod: number; stealth_bonus: number; detects: boolean; size_cells: number;
}

export const DEFAULT_COMBAT: NPCCombat = { hp: 10, max_hp: 10, ac: 10, speed_ft: 30, passive_perception: 10, darkvision_ft: 0, blindsight_ft: 0, dex_mod: 0, stealth_bonus: 0, detects: false, size_cells: 1 };
