package service

import (
	"math/rand/v2"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func darkScene() *domain.VTTScene {
	return &domain.VTTScene{GridSizePx: 70, FeetPerCell: 5, AmbientLight: "dark", Pace: 2,
		Walls: domain.Walls{{X1: 700, Y1: 0, X2: 700, Y2: 2000}}}
}

func TestPointInPolygon(t *testing.T) {
	sq := []domain.Point{{X: 0, Y: 0}, {X: 100, Y: 0}, {X: 100, Y: 100}, {X: 0, Y: 100}}
	if !PointInPolygon(50, 50, sq) || PointInPolygon(150, 50, sq) || PointInPolygon(1, 1, sq[:2]) {
		t.Fatal("point in polygon failed")
	}
}

func TestCanSeeRules(t *testing.T) {
	s := darkScene()
	gnoll := domain.VTTToken{X: 100, Y: 100, DarkvisionFt: 60} // 60 ft = 840 px
	human := domain.VTTToken{X: 100, Y: 100}
	if !CanSee(s, nil, gnoll, 500, 100) {
		t.Error("darkvision should see 400 px away in the dark")
	}
	if CanSee(s, nil, human, 500, 100) {
		t.Error("human should not see in darkness")
	}
	if CanSee(s, nil, gnoll, 800, 100) {
		t.Error("wall should block sight")
	}
	torch := []domain.VTTToken{{X: 500, Y: 120, LightBrightFt: 20, LightDimFt: 20}}
	if !CanSee(s, torch, human, 500, 100) {
		t.Error("target lit by a torch should be visible")
	}
	limited := domain.VTTToken{X: 100, Y: 100, VisionFt: 10, DarkvisionFt: 60}
	if CanSee(s, nil, limited, 500, 100) {
		t.Error("vision range limit ignored")
	}
}

func TestExplorationRate(t *testing.T) {
	s := darkScene() // 14 px per foot, pace ×2
	if got := ExplorationRatePxPerSec(s, 30, false); got != 140 {
		t.Errorf("30 ft at ×2 should be 140 px/s, got %v", got)
	}
	if got := ExplorationRatePxPerSec(s, 30, true); got != 70 {
		t.Errorf("sneaking halves the rate, got %v", got)
	}
	x, y := ClampStep(0, 0, 300, 400, 100)
	if x != 60 || y != 80 {
		t.Errorf("clamp: got %v,%v", x, y)
	}
}

func TestParsers(t *testing.T) {
	if ParsePassivePerception("darkvision 60 ft., passive Perception 13") != 13 || ParsePassivePerception("") != 10 {
		t.Error("passive perception parse")
	}
	if ParseWalkSpeed(`{"walk": "40 ft.", "fly": "80 ft."}`) != 40 || ParseWalkSpeed("") != 30 {
		t.Error("walk speed parse")
	}
	if SkillModifier("Investigación", 10, 10, 10, 16, 10, 10) != 3 || SkillModifier("Sigilo", 10, 14, 10, 10, 10, 10) != 2 {
		t.Error("skill modifier")
	}
}

func TestConditionsAndLoot(t *testing.T) {
	conds := []Condition{{Type: "class", Value: "mago"}, {Type: "has_item", Value: "llave"}, {Type: "passive", Min: 13}}
	if ok, _ := ConditionsMet(conds, "Mago", "Elfo", 14, []string{"llave de la cripta"}); !ok {
		t.Error("conditions should pass")
	}
	if ok, why := ConditionsMet(conds, "Mago", "Elfo", 12, []string{"llave"}); ok || why != "passive" {
		t.Errorf("expected passive failure, got %v %s", ok, why)
	}
	rnd := rand.New(rand.NewPCG(1, 2))
	counts := map[string]int{}
	for i := 0; i < 1000; i++ {
		e, _ := RollLootTable([]LootEntry{{Name: "a", Weight: 9}, {Name: "b", Weight: 1}}, rnd)
		counts[e.Name]++
	}
	if counts["a"] < 800 || counts["b"] < 40 {
		t.Errorf("weights not respected: %v", counts)
	}
	if _, ok := RollLootTable(nil, rnd); ok {
		t.Error("empty table should not roll")
	}
}

func TestAdvanceTurn(t *testing.T) {
	c := &domain.VTTCombat{Round: 1, Combatants: make([]domain.VTTCombatant, 3)}
	AdvanceTurn(c)
	AdvanceTurn(c)
	if !AdvanceTurn(c) || c.Round != 2 || c.TurnIndex != 0 {
		t.Fatalf("round wrap failed: %+v", c)
	}
}
