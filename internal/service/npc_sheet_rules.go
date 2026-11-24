package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"

	"dnd-campaign-manager/internal/domain"
)

// DefaultNPCCombat is the sheet of an NPC that never had one (npc-agenda.md §5).
var DefaultNPCCombat = domain.NPCCombat{HP: 10, MaxHP: 10, AC: 10, SpeedFt: 30, PassivePerception: 10, SizeCells: 1}

// npcCombatLimits: field → inclusive [min, max].
var npcCombatLimits = map[string][2]float64{
	"hp": {0, 10000}, "max_hp": {1, 10000}, "ac": {1, 35}, "speed_ft": {0, 300}, "passive_perception": {1, 40},
	"darkvision_ft": {0, 1000}, "blindsight_ft": {0, 1000}, "dex_mod": {-10, 15}, "stealth_bonus": {-10, 30}, "size_cells": {0.5, 10},
}

// NormalizeNPCCombat validates stats.combat and fills the missing fields with the defaults. A missing
// max_hp follows hp. Errors name the offending field.
func NormalizeNPCCombat(raw json.RawMessage) (domain.NPCCombat, error) {
	c := DefaultNPCCombat
	if len(bytes.TrimSpace(raw)) == 0 || string(bytes.TrimSpace(raw)) == "null" {
		return c, nil
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return c, fmt.Errorf("combat must be an object")
	}
	ints := map[string]*int{"hp": &c.HP, "max_hp": &c.MaxHP, "ac": &c.AC, "speed_ft": &c.SpeedFt, "passive_perception": &c.PassivePerception,
		"darkvision_ft": &c.DarkvisionFt, "blindsight_ft": &c.BlindsightFt, "dex_mod": &c.DexMod, "stealth_bonus": &c.StealthBonus}
	for name, value := range fields {
		switch {
		case name == "detects":
			if err := json.Unmarshal(value, &c.Detects); err != nil {
				return c, fmt.Errorf("combat.detects must be true or false")
			}
		case name == "size_cells" || ints[name] != nil:
			var n float64
			if err := json.Unmarshal(value, &n); err != nil {
				return c, fmt.Errorf("combat.%s must be a number", name)
			}
			lim := npcCombatLimits[name]
			if n < lim[0] || n > lim[1] || (name != "size_cells" && n != math.Trunc(n)) {
				return c, fmt.Errorf("combat.%s must be between %g and %g", name, lim[0], lim[1])
			}
			if name == "size_cells" {
				c.SizeCells = n
			} else {
				*ints[name] = int(n)
			}
		default:
			return c, fmt.Errorf("combat.%s is not a combat field", name)
		}
	}
	if _, ok := fields["max_hp"]; !ok {
		c.MaxHP = max(c.HP, 1)
	}
	if c.MaxHP < c.HP {
		return c, fmt.Errorf("combat.max_hp cannot be lower than hp")
	}
	return c, nil
}

// ApplyNPCCombat copies the NPC sheet to a map token (placed by hand or by the agenda).
func ApplyNPCCombat(t *domain.VTTToken, c domain.NPCCombat) {
	t.HP, t.MaxHP, t.AC, t.SpeedFt = c.HP, c.MaxHP, c.AC, c.SpeedFt
	t.PassivePerc, t.DarkvisionFt, t.BlindsightFt = c.PassivePerception, c.DarkvisionFt, c.BlindsightFt
	t.DexMod, t.StealthBonus, t.Detects, t.SizeCells = c.DexMod, c.StealthBonus, c.Detects, c.SizeCells
}

// SplitCoins turns copper into gold, silver and copper coins for a character wallet.
func SplitCoins(cp int64) (int, int, int) {
	return int(cp / 100), int(cp % 100 / 10), int(cp % 10)
}
