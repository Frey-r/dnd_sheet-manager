package content

import "strings"

// equipmentProjection holds the srd_equipment columns derived from a 5etools item entry
// (srd-data.md, Equipment): the spec categories instead of the raw 5etools type codes.
type equipmentProjection struct {
	Category      string // Weapon, Armor, Shield, Adventuring Gear, Tool, Mount, Vehicle
	WeaponRange   string // Melee or Ranged (weapons only)
	ArmorCategory string // Light, Medium, Heavy or Shield (armor and shields only)
	DexBonus      bool   // light and medium armor add the DEX modifier
	MaxDexBonus   any    // 2 for medium armor, nil otherwise
	StrMinimum    any    // heavy armor strength requirement, nil when none
}

// itemTypeCode returns the 5etools type code without its source suffix ("M|XPHB" -> "M").
func itemTypeCode(value any) string {
	code, _ := value.(string)
	if i := strings.Index(code, "|"); i >= 0 {
		code = code[:i]
	}
	return strings.ToUpper(strings.TrimSpace(code))
}

// projectEquipment maps a 5etools item entry onto the srd_equipment categories.
func projectEquipment(data map[string]any) equipmentProjection {
	p := equipmentProjection{Category: "Adventuring Gear"}
	switch code := itemTypeCode(data["type"]); code {
	case "M", "R":
		p.Category = "Weapon"
		p.WeaponRange = map[string]string{"M": "Melee", "R": "Ranged"}[code]
	case "LA", "MA", "HA":
		p.Category = "Armor"
		p.ArmorCategory = map[string]string{"LA": "Light", "MA": "Medium", "HA": "Heavy"}[code]
		p.DexBonus = code != "HA"
		if code == "MA" {
			p.MaxDexBonus = 2
		}
	case "S":
		p.Category, p.ArmorCategory = "Shield", "Shield"
	case "AT", "T", "INS", "GS":
		p.Category = "Tool"
	case "MNT", "TAH":
		p.Category = "Mount"
	case "VEH", "SHP", "AIR", "SPC":
		p.Category = "Vehicle"
	default:
		// Items without a type code still flag themselves (e.g. magic weapons with "weapon": true).
		if boolValue(data["weapon"]) {
			p.Category, p.WeaponRange = "Weapon", "Melee"
			if data["range"] != nil {
				p.WeaponRange = "Ranged"
			}
		} else if boolValue(data["armor"]) {
			p.Category = "Armor"
		}
	}
	if p.Category == "Armor" {
		if strength := numberValue(data["strength"]); strength != nil && *strength > 0 {
			p.StrMinimum = *strength
		}
	}
	return p
}

// weaponRanges parses a 5etools range string ("20/60") into its normal and long values.
func weaponRanges(value any) (int, int) {
	text, _ := value.(string)
	normal, long, _ := strings.Cut(text, "/")
	n, l := numberValue(strings.TrimSpace(normal)), numberValue(strings.TrimSpace(long))
	rn, rl := 0, 0
	if n != nil {
		rn = *n
	}
	if l != nil {
		rl = *l
	}
	return rn, rl
}
