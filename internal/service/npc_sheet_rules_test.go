package service

import (
	"encoding/json"
	"strings"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

// T-24 · contratos/T-24-pnj-hoja-inventario.md — H1 and the coin split.

func TestNormalizeNPCCombatDefaults(t *testing.T) {
	c, err := NormalizeNPCCombat(nil)
	if err != nil {
		t.Fatal(err)
	}
	want := domain.NPCCombat{HP: 10, MaxHP: 10, AC: 10, SpeedFt: 30, PassivePerception: 10, SizeCells: 1}
	if c != want {
		t.Fatalf("defaults = %+v, want %+v", c, want)
	}
	c, err = NormalizeNPCCombat(json.RawMessage(`{"hp": 7}`))
	if err != nil || c.HP != 7 || c.MaxHP != 7 || c.AC != 10 {
		t.Fatalf("partial sheet = %+v, %v (max_hp follows hp when missing)", c, err)
	}
	c, err = NormalizeNPCCombat(json.RawMessage(`{"hp": 22, "max_hp": 30, "ac": 16, "speed_ft": 25, "passive_perception": 12, "darkvision_ft": 60, "blindsight_ft": 10, "dex_mod": -1, "stealth_bonus": 3, "detects": true, "size_cells": 2}`))
	want = domain.NPCCombat{HP: 22, MaxHP: 30, AC: 16, SpeedFt: 25, PassivePerception: 12, DarkvisionFt: 60, BlindsightFt: 10, DexMod: -1, StealthBonus: 3, Detects: true, SizeCells: 2}
	if err != nil || c != want {
		t.Fatalf("full sheet = %+v, %v", c, err)
	}
}

func TestNormalizeNPCCombatErrors(t *testing.T) {
	cases := map[string]string{
		`{"hp": -1}`:                 "hp",
		`{"hp": 10, "max_hp": 5}`:    "max_hp",
		`{"ac": 0}`:                  "ac",
		`{"ac": 40}`:                 "ac",
		`{"speed_ft": -5}`:           "speed_ft",
		`{"speed_ft": 1000}`:         "speed_ft",
		`{"passive_perception": 60}`: "passive_perception",
		`{"darkvision_ft": -1}`:      "darkvision_ft",
		`{"size_cells": 0}`:          "size_cells",
		`{"size_cells": 11}`:         "size_cells",
		`{"dex_mod": 20}`:            "dex_mod",
		`{"hp": "mucho"}`:            "hp",
		`{"detects": "si"}`:          "detects",
		`{"fly": 30}`:                "fly",
		`[1,2]`:                      "combat",
	}
	for in, field := range cases {
		_, err := NormalizeNPCCombat(json.RawMessage(in))
		if err == nil || !strings.Contains(err.Error(), field) {
			t.Errorf("%s: want error naming %q, got %v", in, field, err)
		}
	}
}

// H2: the sheet lands on the token.
func TestApplyNPCCombat(t *testing.T) {
	tok := domain.VTTToken{Kind: "npc", HP: 1, MaxHP: 1, AC: 1, SpeedFt: 5}
	ApplyNPCCombat(&tok, domain.NPCCombat{HP: 22, MaxHP: 30, AC: 16, SpeedFt: 25, PassivePerception: 12, DarkvisionFt: 60, BlindsightFt: 10, DexMod: -1, StealthBonus: 3, Detects: true, SizeCells: 2})
	want := domain.VTTToken{Kind: "npc", HP: 22, MaxHP: 30, AC: 16, SpeedFt: 25, PassivePerc: 12, DarkvisionFt: 60, BlindsightFt: 10, DexMod: -1, StealthBonus: 3, Detects: true, SizeCells: 2}
	if tok.HP != want.HP || tok.MaxHP != want.MaxHP || tok.AC != want.AC || tok.SpeedFt != want.SpeedFt || tok.PassivePerc != want.PassivePerc ||
		tok.DarkvisionFt != want.DarkvisionFt || tok.BlindsightFt != want.BlindsightFt || tok.DexMod != want.DexMod || tok.StealthBonus != want.StealthBonus ||
		tok.Detects != want.Detects || tok.SizeCells != want.SizeCells {
		t.Fatalf("token = %+v", tok)
	}
}

// H7: copper goes into the wallet as gold, silver and copper.
func TestSplitCoins(t *testing.T) {
	cases := []struct {
		cp      int64
		g, s, c int
	}{{0, 0, 0, 0}, {7, 0, 0, 7}, {45, 0, 4, 5}, {1450, 14, 5, 0}, {100, 1, 0, 0}}
	for _, k := range cases {
		g, s, c := SplitCoins(k.cp)
		if g != k.g || s != k.s || c != k.c {
			t.Errorf("SplitCoins(%d) = %d,%d,%d want %d,%d,%d", k.cp, g, s, c, k.g, k.s, k.c)
		}
	}
}
