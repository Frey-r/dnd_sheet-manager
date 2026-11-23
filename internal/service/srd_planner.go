package service

import (
	"errors"
	"sort"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// SpellPlanRequest is the input for the spell planner.
type SpellPlanRequest struct {
	ClassName       string `json:"class_name" binding:"required"`
	Level           int    `json:"level" binding:"required,min=1,max=20"`
	AbilityModifier int    `json:"ability_modifier"`
	Focus           string `json:"focus"` // optional: damage | control | healing | utility
}

// SpellPick is a recommended spell.
type SpellPick struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Level         int    `json:"level"`
	School        string `json:"school"`
	Concentration bool   `json:"concentration"`
	Ritual        bool   `json:"ritual"`
}

// SpellPlanResult is a suggested spell loadout.
type SpellPlanResult struct {
	ClassName     string         `json:"class_name"`
	Level         int            `json:"level"`
	Focus         string         `json:"focus,omitempty"`
	SpellSlots    map[string]int `json:"spell_slots"`
	CantripsKnown int            `json:"cantrips_known"`
	SpellsKnown   int            `json:"spells_known"`
	Cantrips      []SpellPick    `json:"cantrips"`
	Spells        []SpellPick    `json:"spells"`
	Message       string         `json:"message,omitempty"`
}

func slotCounts(r domain.SRDClassSpellSlot) [9]int {
	return [9]int{r.Slot1, r.Slot2, r.Slot3, r.Slot4, r.Slot5, r.Slot6, r.Slot7, r.Slot8, r.Slot9}
}

func spellScore(sp domain.SRDSpell, focus string) int {
	text := strings.ToLower(sp.Name + " " + sp.Description)
	score := 0
	switch focus {
	case "damage":
		if sp.DamageType != "" {
			score += 2
		}
	case "control":
		if sp.Concentration && sp.DamageType == "" {
			score += 2
		}
	case "healing":
		if strings.Contains(text, "hit points") && strings.Contains(text, "regain") {
			score += 2
		}
	case "utility":
		if sp.Ritual || sp.DamageType == "" {
			score += 2
		}
	}
	return score
}

func rankSpells(spells []domain.SRDSpell, focus string) []domain.SRDSpell {
	out := append([]domain.SRDSpell(nil), spells...)
	sort.SliceStable(out, func(i, j int) bool {
		si, sj := spellScore(out[i], focus), spellScore(out[j], focus)
		if si != sj {
			return si > sj
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func toPick(sp domain.SRDSpell) SpellPick {
	return SpellPick{ID: sp.ID, Name: sp.Name, Level: sp.Level, School: sp.School, Concentration: sp.Concentration, Ritual: sp.Ritual}
}

// planSpells is the pure planner core: it picks cantrips and distributes leveled spells
// across the available slot levels, highest level first.
func planSpells(spells []domain.SRDSpell, row domain.SRDClassSpellSlot, req SpellPlanRequest, className string) *SpellPlanResult {
	focus := strings.ToLower(strings.TrimSpace(req.Focus))
	slots := slotCounts(row)
	res := &SpellPlanResult{
		ClassName: className, Level: req.Level, Focus: focus,
		SpellSlots: map[string]int{}, CantripsKnown: row.CantripsKnown,
		Cantrips: []SpellPick{}, Spells: []SpellPick{},
	}
	maxLevel := 0
	for i, n := range slots {
		if n > 0 {
			res.SpellSlots[string(rune('1'+i))] = n
			maxLevel = i + 1
		}
	}

	byLevel := map[int][]domain.SRDSpell{}
	for _, sp := range spells {
		byLevel[sp.Level] = append(byLevel[sp.Level], sp)
	}
	for _, sp := range rankSpells(byLevel[0], focus) {
		if len(res.Cantrips) >= row.CantripsKnown {
			break
		}
		res.Cantrips = append(res.Cantrips, toPick(sp))
	}

	budget := row.SpellsKnown
	if budget <= 0 { // prepared casters: level (halved for half-casters) + ability modifier
		lvl := req.Level
		if maxLevel > 0 && maxLevel <= 5 && strings.Contains("paladin ranger", strings.ToLower(className)) {
			lvl = lvl / 2
		}
		budget = lvl + req.AbilityModifier
		if budget < 1 {
			budget = 1
		}
	}
	res.SpellsKnown = budget

	ranked := map[int][]domain.SRDSpell{}
	for l := 1; l <= maxLevel; l++ {
		ranked[l] = rankSpells(byLevel[l], focus)
	}
	idx := map[int]int{}
	for budget > 0 {
		progressed := false
		for l := maxLevel; l >= 1 && budget > 0; l-- {
			if idx[l] < len(ranked[l]) {
				res.Spells = append(res.Spells, toPick(ranked[l][idx[l]]))
				idx[l]++
				budget--
				progressed = true
			}
		}
		if !progressed {
			break
		}
	}
	sort.SliceStable(res.Spells, func(i, j int) bool {
		if res.Spells[i].Level != res.Spells[j].Level {
			return res.Spells[i].Level < res.Spells[j].Level
		}
		return res.Spells[i].Name < res.Spells[j].Name
	})
	return res
}

// PlanSpells suggests a spell loadout for a class and level.
func (s *SRDService) PlanSpells(req SpellPlanRequest) (*SpellPlanResult, error) {
	class, err := s.repo.GetClassByName(strings.TrimSpace(req.ClassName))
	if err != nil {
		return nil, ErrClassNotFound
	}
	var row *domain.SRDClassSpellSlot
	for i := range class.SpellSlots {
		if class.SpellSlots[i].ClassLevel == req.Level {
			row = &class.SpellSlots[i]
			break
		}
	}
	if row == nil {
		return &SpellPlanResult{
			ClassName: class.Name, Level: req.Level, SpellSlots: map[string]int{},
			Cantrips: []SpellPick{}, Spells: []SpellPick{},
			Message: "This class has no spell slot progression at that level.",
		}, nil
	}
	maxLevel := 0
	for i, n := range slotCounts(*row) {
		if n > 0 {
			maxLevel = i + 1
		}
	}
	spells, err := s.repo.GetSpellsForClass(class.Name, maxLevel)
	if err != nil {
		return nil, err
	}
	return planSpells(spells, *row, req, class.Name), nil
}

// ErrClassNotFound is returned by the spell planner for unknown classes.
var ErrClassNotFound = errors.New("class not found")
