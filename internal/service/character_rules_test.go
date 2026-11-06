package service

import (
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func TestApplyStartingStatsWizard(t *testing.T) {
	c := &domain.Character{Class: "Mago", Race: "Alto elfo"}
	if err := ApplyStartingStats(c, [6]int{8, 16, 14, 18, 12, 10}); err != nil {
		t.Fatal(err)
	}
	if c.InitiativeBonus != 3 || c.PassivePerception != 11 {
		t.Fatalf("initiative/passive: %d/%d", c.InitiativeBonus, c.PassivePerception)
	}
	if c.MaxHP != 8 || c.CurrentHP != 8 || c.AC != 13 || c.Speed != 30 || c.ProficiencyBonus != 2 || c.SpellcastingAbility != "INT" || c.Level != 1 {
		t.Fatalf("unexpected stats: %+v", c)
	}
}

func TestApplyStartingStatsFighterDwarf(t *testing.T) {
	c := &domain.Character{Class: "Fighter", Race: "Mountain Dwarf"}
	if err := ApplyStartingStats(c, [6]int{16, 12, 16, 8, 10, 8}); err != nil {
		t.Fatal(err)
	}
	if c.MaxHP != 13 || c.AC != 11 || c.Speed != 25 {
		t.Fatalf("unexpected stats: hp=%d ac=%d speed=%d", c.MaxHP, c.AC, c.Speed)
	}
}

func TestApplyStartingStatsDefaultsAndLimits(t *testing.T) {
	c := &domain.Character{Class: "Clase inventada", Race: "Humano"}
	if err := ApplyStartingStats(c, [6]int{}); err != nil {
		t.Fatal(err)
	}
	if c.StrScore != 10 || c.MaxHP != 8 || c.AC != 10 {
		t.Fatalf("defaults not applied: %+v", c)
	}
	low := &domain.Character{Class: "Sorcerer", Race: "Humano"}
	if err := ApplyStartingStats(low, [6]int{10, 10, 3, 10, 10, 10}); err != nil {
		t.Fatal(err)
	}
	if low.MaxHP != 2 {
		t.Fatalf("d6 with CON 3 (-4) should give 2, got %d", low.MaxHP)
	}
	if err := ApplyStartingStats(&domain.Character{Class: "Mago"}, [6]int{21, 10, 10, 10, 10, 10}); err != ErrInvalidAbilityScore {
		t.Fatalf("expected ErrInvalidAbilityScore, got %v", err)
	}
}

func TestClassRuleSlots(t *testing.T) {
	cases := map[string]int{"Wizard": 2, "Clérigo": 2, "Brujo": 1, "Paladín": 0, "Ranger": 0, "Guerrero": 0}
	for class, want := range cases {
		if _, _, got := ClassRule(class); got != want {
			t.Errorf("%s: got %d slots, want %d", class, got, want)
		}
	}
}
