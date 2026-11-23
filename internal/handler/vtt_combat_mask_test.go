package handler

import (
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func TestMaskHiddenCombatants(t *testing.T) {
	combat := &domain.VTTCombat{TurnIndex: 1, Combatants: []domain.VTTCombatant{
		{ID: 1, TokenID: 10, Name: "Lyra", IsPlayer: true},
		{ID: 2, TokenID: 11, Name: "Asesino sombrío", Hidden: true},
		{ID: 3, TokenID: 12, Name: "Goblin"},
	}}
	original := combat.Combatants
	maskHiddenCombatants(combat)

	if len(combat.Combatants) != 3 {
		t.Fatalf("rows must be kept so turn_index stays valid, got %d", len(combat.Combatants))
	}
	hidden := combat.Combatants[1]
	if hidden.Name != hiddenCombatantName || hidden.TokenID != 0 || hidden.ID != 2 {
		t.Fatalf("hidden combatant not masked: %+v", hidden)
	}
	if combat.Combatants[0].Name != "Lyra" || combat.Combatants[2].TokenID != 12 {
		t.Fatalf("visible combatants must not change: %+v", combat.Combatants)
	}
	if original[1].Name != "Asesino sombrío" {
		t.Fatal("masking must not mutate the shared slice")
	}
}
