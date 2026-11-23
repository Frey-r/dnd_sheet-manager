package service

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

type fakeCatalog struct {
	classes map[string]*domain.SRDClass
	races   map[string]bool
}

func (f fakeCatalog) GetClassByName(name string) (*domain.SRDClass, error) {
	if c, ok := f.classes[strings.ToLower(name)]; ok {
		return c, nil
	}
	return nil, fmt.Errorf("get class %s: %w", name, sql.ErrNoRows)
}

func (f fakeCatalog) GetRaceByName(name string) (*domain.SRDRace, error) {
	if f.races[strings.ToLower(name)] {
		return &domain.SRDRace{Name: name}, nil
	}
	return nil, fmt.Errorf("get race %s: %w", name, sql.ErrNoRows)
}

func (fakeCatalog) SpellRefByContent(context.Context, int64) (*int64, error)     { return nil, nil }
func (fakeCatalog) EquipmentRefByContent(context.Context, int64) (*int64, error) { return nil, nil }

func testCatalog() fakeCatalog {
	return fakeCatalog{
		classes: map[string]*domain.SRDClass{
			"wizard": {Name: "Wizard", SpellSlots: []domain.SRDClassSpellSlot{
				{ClassLevel: 1, Slot1: 2},
				{ClassLevel: 5, Slot1: 4, Slot2: 3, Slot3: 2},
			}},
			"fighter": {Name: "Fighter"},
		},
		races: map[string]bool{"elf": true},
	}
}

func TestCatalogWarnings(t *testing.T) {
	s := (&CharacterService{}).WithCatalog(testCatalog())
	if w := s.catalogWarnings("Wizard", "Elf (XPHB)"); len(w) != 0 {
		t.Fatalf("versioned race name must match the catalog: %v", w)
	}
	if w := s.catalogWarnings("Wizard", "Elf"); len(w) != 0 {
		t.Fatalf("known class and race must not warn: %v", w)
	}
	w := s.catalogWarnings("Brujo de sangre", "Kender")
	if len(w) != 2 || !strings.Contains(w[0], "Brujo de sangre") || !strings.Contains(w[1], "Kender") {
		t.Fatalf("unexpected warnings: %v", w)
	}
	if w := (&CharacterService{}).catalogWarnings("X", "Y"); w != nil {
		t.Fatalf("no catalog configured must not warn: %v", w)
	}
}

func TestSpellSlotTotalsFromCatalog(t *testing.T) {
	s := (&CharacterService{}).WithCatalog(testCatalog())
	totals, ok := s.spellSlotTotals("Wizard", 5)
	if !ok || totals != [9]int{4, 3, 2} {
		t.Fatalf("wizard 5: got %v %v", totals, ok)
	}
	if _, ok := s.spellSlotTotals("Fighter", 5); ok {
		t.Fatal("martial class without catalog slots must not get slots")
	}
	// Fallback to the fixed level-1 table for classes outside the catalog.
	if totals, ok := s.spellSlotTotals("Mago", 1); !ok || totals[0] != 2 {
		t.Fatalf("fallback level 1: got %v %v", totals, ok)
	}
	if _, ok := s.spellSlotTotals("Mago", 3); ok {
		t.Fatal("fallback only knows level 1")
	}
}

func TestProficiencyBonusForLevel(t *testing.T) {
	for level, want := range map[int]int{0: 2, 1: 2, 4: 2, 5: 3, 8: 3, 9: 4, 13: 5, 17: 6, 20: 6, 25: 6} {
		if got := ProficiencyBonusForLevel(level); got != want {
			t.Errorf("level %d: got %d, want %d", level, got, want)
		}
	}
}

func TestApplyCharacterUpdatesLevelAndCoins(t *testing.T) {
	c := &domain.Character{Level: 1, ProficiencyBonus: 2, MaxHP: 10, CurrentHP: 10}
	level, silver, copper, gold := 5, 7, -3, -1
	applyCharacterUpdates(c, &domain.UpdateCharacterRequest{Level: &level, Silver: &silver, Copper: &copper, Gold: &gold})
	if c.ProficiencyBonus != 3 {
		t.Fatalf("level 5 must give +3, got %d", c.ProficiencyBonus)
	}
	if c.Silver != 7 || c.Copper != 0 || c.Gold != 0 {
		t.Fatalf("coins: gp=%d sp=%d cp=%d", c.Gold, c.Silver, c.Copper)
	}
}
