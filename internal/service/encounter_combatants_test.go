package service

import (
	"errors"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func i64(v int64) *int64 { return &v }
func intp(v int) *int    { return &v }

func TestAbilityModifier(t *testing.T) {
	for score, want := range map[int]int{1: -5, 6: -2, 8: -1, 9: -1, 10: 0, 11: 0, 12: 1, 15: 2, 20: 5} {
		if got := abilityModifier(score); got != want {
			t.Errorf("abilityModifier(%d)=%d want %d", score, got, want)
		}
	}
}

func TestResolveEncounter(t *testing.T) {
	monsters := map[int64]domain.SRDMonster{
		1: {ID: 1, Name: "Goblin", HP: 7, AC: 15, DEX: 14},
		2: {ID: 2, Name: "Zombie", HP: 22, AC: 8, DEX: 6},
		3: {ID: 3, Name: "Broken", HP: 0, AC: 10, DEX: 10},
	}
	fixed := func() int { return 10 }

	t.Run("server stats win over client values", func(t *testing.T) {
		got, err := ResolveEncounter(5, []EncounterEntry{{
			Combatant: domain.Combatant{Name: "evil", HP: 9999, MaxHP: 9999, Initiative: 99, AC: intp(12)},
			MonsterID: i64(1), Count: 3,
		}}, monsters, fixed)
		if err != nil || len(got) != 3 {
			t.Fatalf("err=%v len=%d", err, len(got))
		}
		for i, c := range got {
			if c.HP != 7 || c.MaxHP != 7 || *c.AC != 15 || *c.SRDMonsterID != 1 || c.CampaignID != 5 || c.IsPlayer {
				t.Errorf("combatant %d: %+v", i, c)
			}
			if c.Initiative != 12 { // 10 + DEX 14 (+2)
				t.Errorf("initiative=%d want 12", c.Initiative)
			}
		}
		if got[0].Name != "Goblin 1" || got[2].Name != "Goblin 3" {
			t.Errorf("names: %q %q", got[0].Name, got[2].Name)
		}
	})
	t.Run("single keeps plain name, negative dex mod, hp floor", func(t *testing.T) {
		got, err := ResolveEncounter(1, []EncounterEntry{{MonsterID: i64(2), Count: 1}, {MonsterID: i64(3), Count: 1}}, monsters, fixed)
		if err != nil {
			t.Fatal(err)
		}
		if got[0].Name != "Zombie" || got[0].Initiative != 8 || got[1].HP != 1 {
			t.Errorf("%+v %+v", got[0], got[1])
		}
	})
	t.Run("same monster in two entries is numbered continuously", func(t *testing.T) {
		got, _ := ResolveEncounter(1, []EncounterEntry{{MonsterID: i64(1), Count: 1}, {MonsterID: i64(1), Count: 1}}, monsters, fixed)
		if got[0].Name != "Goblin 1" || got[1].Name != "Goblin 2" {
			t.Errorf("%q %q", got[0].Name, got[1].Name)
		}
	})
	t.Run("plain combatants pass through without monster link", func(t *testing.T) {
		got, err := ResolveEncounter(7, []EncounterEntry{{Combatant: domain.Combatant{ID: 99, Name: "Bandit", HP: 11, MaxHP: 11, Initiative: 4, SRDMonsterID: i64(1), CharacterID: i64(3)}}}, monsters, fixed)
		if err != nil || got[0].ID != 0 || got[0].CampaignID != 7 || got[0].SRDMonsterID != nil || got[0].CharacterID != nil || got[0].HP != 11 {
			t.Fatalf("%v %+v", err, got)
		}
	})
	t.Run("mixed", func(t *testing.T) {
		got, err := ResolveEncounter(1, []EncounterEntry{{Combatant: domain.Combatant{Name: "NPC", HP: 5, MaxHP: 5}}, {MonsterID: i64(2), Count: 2}}, monsters, fixed)
		if err != nil || len(got) != 3 {
			t.Fatalf("%v %d", err, len(got))
		}
	})

	errCases := []struct {
		name    string
		entries []EncounterEntry
		want    error
	}{
		{"empty", nil, ErrEncounterEmpty},
		{"zero count", []EncounterEntry{{MonsterID: i64(1)}}, ErrEncounterBadCount},
		{"negative count", []EncounterEntry{{MonsterID: i64(1), Count: -2}}, ErrEncounterBadCount},
		{"bad id", []EncounterEntry{{MonsterID: i64(0), Count: 1}}, ErrEncounterBadID},
		{"unknown monster", []EncounterEntry{{MonsterID: i64(42), Count: 1}}, ErrUnknownSRDMonster},
		{"over cap in one entry", []EncounterEntry{{MonsterID: i64(1), Count: 51}}, ErrEncounterBadCount},
		{"over cap across entries", []EncounterEntry{{MonsterID: i64(1), Count: 30}, {MonsterID: i64(2), Count: 21}}, ErrEncounterTooLarge},
		{"nameless plain", []EncounterEntry{{Combatant: domain.Combatant{Name: "  "}}}, ErrEncounterBadEntry},
		{"bad plain ac", []EncounterEntry{{Combatant: domain.Combatant{Name: "x", AC: intp(500)}}}, ErrEncounterBadStats},
	}
	for _, tc := range errCases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := ResolveEncounter(1, tc.entries, monsters, fixed); !errors.Is(err, tc.want) {
				t.Fatalf("err=%v want %v", err, tc.want)
			}
		})
	}
	t.Run("exactly 50 ok", func(t *testing.T) {
		got, err := ResolveEncounter(1, []EncounterEntry{{MonsterID: i64(1), Count: 50}}, monsters, fixed)
		if err != nil || len(got) != 50 {
			t.Fatalf("%v %d", err, len(got))
		}
	})
}
