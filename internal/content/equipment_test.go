package content

import "testing"

func TestProjectEquipment(t *testing.T) {
	cases := []struct {
		name string
		data map[string]any
		want equipmentProjection
	}{
		{"melee weapon with source", map[string]any{"type": "M|XPHB"}, equipmentProjection{Category: "Weapon", WeaponRange: "Melee"}},
		{"ranged weapon", map[string]any{"type": "R", "range": "80/320"}, equipmentProjection{Category: "Weapon", WeaponRange: "Ranged"}},
		{"light armor", map[string]any{"type": "LA", "ac": float64(11)}, equipmentProjection{Category: "Armor", ArmorCategory: "Light", DexBonus: true}},
		{"medium armor", map[string]any{"type": "MA|XPHB"}, equipmentProjection{Category: "Armor", ArmorCategory: "Medium", DexBonus: true, MaxDexBonus: 2}},
		{"heavy armor strength", map[string]any{"type": "HA", "strength": "15"}, equipmentProjection{Category: "Armor", ArmorCategory: "Heavy", StrMinimum: 15}},
		{"shield", map[string]any{"type": "S"}, equipmentProjection{Category: "Shield", ArmorCategory: "Shield"}},
		{"tool", map[string]any{"type": "AT"}, equipmentProjection{Category: "Tool"}},
		{"mount", map[string]any{"type": "MNT"}, equipmentProjection{Category: "Mount"}},
		{"vehicle", map[string]any{"type": "SHP"}, equipmentProjection{Category: "Vehicle"}},
		{"gear", map[string]any{"type": "G"}, equipmentProjection{Category: "Adventuring Gear"}},
		{"untyped magic weapon", map[string]any{"weapon": true}, equipmentProjection{Category: "Weapon", WeaponRange: "Melee"}},
	}
	for _, c := range cases {
		if got := projectEquipment(c.data); got != c.want {
			t.Errorf("%s: got %+v, want %+v", c.name, got, c.want)
		}
	}
}

func TestWeaponRanges(t *testing.T) {
	if n, l := weaponRanges("20/60"); n != 20 || l != 60 {
		t.Fatalf("got %d/%d", n, l)
	}
	if n, l := weaponRanges(nil); n != 0 || l != 0 {
		t.Fatalf("got %d/%d", n, l)
	}
}

func TestProficiencyByCR(t *testing.T) {
	cases := map[string]int{"1/2": 2, "5": 3, "9": 4, "13": 5, "17": 6, "21": 7, "24": 7, "25": 8, "29": 9, "30": 9}
	for cr, want := range cases {
		if got := proficiency(cr); got != want {
			t.Errorf("CR %s: got %d, want %d", cr, got, want)
		}
	}
}
