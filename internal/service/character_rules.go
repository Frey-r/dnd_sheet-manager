package service

import (
	"errors"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// classRule holds the level-1 facts needed to derive a starting character
// (openspec/specs/characters.md "Character Creation").
type classRule struct {
	hitDie      int
	casting     string // "", "INT", "WIS", "CHA"
	level1Slots int
}

var classRules = map[string]classRule{
	"barbarian": {12, "", 0}, "bárbaro": {12, "", 0}, "barbaro": {12, "", 0},
	"bard": {8, "CHA", 2}, "bardo": {8, "CHA", 2},
	"cleric": {8, "WIS", 2}, "clérigo": {8, "WIS", 2}, "clerigo": {8, "WIS", 2},
	"druid": {8, "WIS", 2}, "druida": {8, "WIS", 2},
	"fighter": {10, "", 0}, "guerrero": {10, "", 0}, "guerrera": {10, "", 0},
	"monk": {8, "", 0}, "monje": {8, "", 0},
	"paladin": {10, "CHA", 0}, "paladín": {10, "CHA", 0},
	"ranger": {10, "WIS", 0}, "explorador": {10, "WIS", 0}, "exploradora": {10, "WIS", 0},
	"rogue": {8, "", 0}, "pícaro": {8, "", 0}, "picaro": {8, "", 0}, "pícara": {8, "", 0},
	"sorcerer": {6, "CHA", 2}, "hechicero": {6, "CHA", 2}, "hechicera": {6, "CHA", 2},
	"warlock": {8, "CHA", 1}, "brujo": {8, "CHA", 1}, "bruja": {8, "CHA", 1},
	"wizard": {6, "INT", 2}, "mago": {6, "INT", 2}, "maga": {6, "INT", 2},
	"artificer": {8, "INT", 2}, "artífice": {8, "INT", 2},
}

// ClassRule returns the rule for a class name (English or Spanish). Homebrew
// classes fall back to a d8 hit die and no spellcasting.
func ClassRule(class string) (hitDie int, casting string, level1Slots int) {
	r, ok := classRules[strings.ToLower(strings.TrimSpace(class))]
	if !ok {
		return 8, "", 0
	}
	return r.hitDie, r.casting, r.level1Slots
}

func abilityMod(score int) int {
	if score >= 10 {
		return (score - 10) / 2
	}
	return -((11 - score) / 2)
}

// RaceSpeed returns the base walking speed (feet) of a 5e race name.
func RaceSpeed(race string) int {
	r := strings.ToLower(race)
	for _, slow := range []string{"dwarf", "enan", "halfling", "mediano", "mediana", "gnome", "gnomo"} {
		if strings.Contains(r, slow) {
			return 25
		}
	}
	return 30
}

// ErrInvalidAbilityScore is returned when a provided score is outside 3–20.
var ErrInvalidAbilityScore = errors.New("ability scores must be between 3 and 20")

// ApplyStartingStats fills a level-1 character from its class, race and scores.
func ApplyStartingStats(c *domain.Character, scores [6]int) error {
	for i := range scores {
		if scores[i] == 0 {
			scores[i] = 10
		}
		if scores[i] < 3 || scores[i] > 20 {
			return ErrInvalidAbilityScore
		}
	}
	c.StrScore, c.DexScore, c.ConScore, c.IntScore, c.WisScore, c.ChaScore = scores[0], scores[1], scores[2], scores[3], scores[4], scores[5]
	hitDie, casting, _ := ClassRule(c.Class)
	c.Level = 1
	c.MaxHP = max(1, hitDie+abilityMod(c.ConScore))
	c.CurrentHP = c.MaxHP
	c.AC = 10 + abilityMod(c.DexScore)
	c.Speed = RaceSpeed(c.Race)
	c.ProficiencyBonus = 2
	c.InitiativeBonus = abilityMod(c.DexScore)
	c.PassivePerception = 10 + abilityMod(c.WisScore)
	// Martial classes have no spellcasting ability (characters.md): leave it empty.
	c.SpellcastingAbility = casting
	return nil
}
