package service

import (
	"fmt"
	"math"
	"math/rand/v2"
	"regexp"
	"strconv"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// ---------- Geometry & senses (vtt-modes.md §4) ----------

// PointInPolygon uses ray casting; polygons with < 3 points contain nothing.
func PointInPolygon(x, y float64, poly []domain.Point) bool {
	if len(poly) < 3 {
		return false
	}
	inside := false
	for i, j := 0, len(poly)-1; i < len(poly); j, i = i, i+1 {
		a, b := poly[i], poly[j]
		if (a.Y > y) != (b.Y > y) && x < (b.X-a.X)*(y-a.Y)/(b.Y-a.Y)+a.X {
			inside = !inside
		}
	}
	return inside
}

func ftToPx(scene *domain.VTTScene) float64 {
	return float64(scene.GridSizePx) / float64(max(1, scene.FeetPerCell))
}

// sightBlocked reports whether a closed wall blocks the line between two points.
func sightBlocked(scene *domain.VTTScene, x1, y1, x2, y2 float64) bool {
	return MovementBlocked(scene.Walls, x1, y1, x2, y2)
}

// Lit reports whether a point is illuminated (any light reaches it with line of sight).
func Lit(scene *domain.VTTScene, tokens []domain.VTTToken, x, y float64) bool {
	if scene.AmbientLight != "dark" {
		return true
	}
	k := ftToPx(scene)
	check := func(lx, ly float64, radiusFt int) bool {
		return radiusFt > 0 && math.Hypot(x-lx, y-ly) <= float64(radiusFt)*k && !sightBlocked(scene, lx, ly, x, y)
	}
	for _, l := range scene.Lights {
		if check(l.X, l.Y, l.Bright+l.Dim) {
			return true
		}
	}
	for _, t := range tokens {
		if check(t.X, t.Y, t.LightBrightFt+t.LightDimFt) {
			return true
		}
	}
	return false
}

// CanSee applies the 5e vision rules of vtt.md §4 from an observer token to a point.
func CanSee(scene *domain.VTTScene, tokens []domain.VTTToken, observer domain.VTTToken, x, y float64) bool {
	if sightBlocked(scene, observer.X, observer.Y, x, y) {
		return false
	}
	k := ftToPx(scene)
	d := math.Hypot(x-observer.X, y-observer.Y)
	if observer.VisionFt > 0 && d > float64(observer.VisionFt)*k {
		return false
	}
	if d <= float64(observer.BlindsightFt)*k || d <= float64(observer.DarkvisionFt)*k {
		return true
	}
	return Lit(scene, tokens, x, y)
}

// ExplorationRatePxPerSec converts sheet speed into real-time movement (vtt-modes.md §2).
func ExplorationRatePxPerSec(scene *domain.VTTScene, speedFt int, sneaking bool) float64 {
	pace := scene.Pace
	if pace <= 0 {
		pace = 2
	}
	rate := float64(max(5, speedFt)) * ftToPx(scene) / 6 * pace
	if sneaking {
		rate /= 2
	}
	return rate
}

// ClampStep limits a movement from (x0,y0) towards (x,y) to maxDist pixels.
func ClampStep(x0, y0, x, y, maxDist float64) (float64, float64) {
	d := math.Hypot(x-x0, y-y0)
	if d <= maxDist || d == 0 {
		return x, y
	}
	f := maxDist / d
	return x0 + (x-x0)*f, y0 + (y-y0)*f
}

var passiveRe = regexp.MustCompile(`(?i)passive perception\s*(\d+)`)
var firstNumber = regexp.MustCompile(`\d+`)

// ParsePassivePerception reads "passive Perception N" from monster senses (default 10).
func ParsePassivePerception(senses string) int {
	if m := passiveRe.FindStringSubmatch(senses); m != nil {
		if n, err := strconv.Atoi(m[1]); err == nil {
			return n
		}
	}
	return 10
}

// ParseWalkSpeed reads the walking speed from a monster speed field such as {"walk":"30 ft."}.
func ParseWalkSpeed(speed string) int {
	s := speed
	if i := strings.Index(strings.ToLower(s), "walk"); i >= 0 {
		s = s[i:]
	}
	if m := firstNumber.FindString(s); m != "" {
		if n, err := strconv.Atoi(m); err == nil && n > 0 {
			return n
		}
	}
	return 30
}

// AbilityMod is the 5e modifier of a score.
func AbilityMod(score int) int { return abilityMod(score) }

var skillAbility = map[string]string{
	"acrobatics": "dex", "acrobacias": "dex", "sleight of hand": "dex", "juego de manos": "dex", "stealth": "dex", "sigilo": "dex",
	"athletics": "str", "atletismo": "str",
	"arcana": "int", "arcanos": "int", "history": "int", "historia": "int", "investigation": "int", "investigación": "int",
	"nature": "int", "naturaleza": "int", "religion": "int", "religión": "int",
	"animal handling": "wis", "trato con animales": "wis", "insight": "wis", "perspicacia": "wis", "medicine": "wis", "medicina": "wis",
	"perception": "wis", "percepción": "wis", "survival": "wis", "supervivencia": "wis",
	"deception": "cha", "engaño": "cha", "intimidation": "cha", "intimidación": "cha", "performance": "cha", "interpretación": "cha",
	"persuasion": "cha", "persuasión": "cha",
	"str": "str", "fuerza": "str", "dex": "dex", "destreza": "dex", "con": "con", "constitución": "con",
	"int": "int", "inteligencia": "int", "wis": "wis", "sabiduría": "wis", "cha": "cha", "carisma": "cha",
}

// SkillModifier returns the ability modifier behind a skill (proficiency is not stored yet).
func SkillModifier(skill string, str, dex, con, intl, wis, cha int) int {
	switch skillAbility[strings.ToLower(strings.TrimSpace(skill))] {
	case "str":
		return abilityMod(str)
	case "dex":
		return abilityMod(dex)
	case "con":
		return abilityMod(con)
	case "int":
		return abilityMod(intl)
	case "wis":
		return abilityMod(wis)
	case "cha":
		return abilityMod(cha)
	}
	return 0
}

// ---------- Object requirements & loot (vtt-modes.md §3) ----------

// Requirements as stored in vtt_objects.requirements.
type Requirements struct {
	Milestones []int64     `json:"milestones"`
	Conditions []Condition `json:"conditions"`
	Check      *Check      `json:"check"`
}

type Condition struct {
	Type  string `json:"type"` // class | race | has_item | passive
	Value string `json:"value"`
	Min   int    `json:"min"`
}

type Check struct {
	Skill string `json:"skill"`
	DC    int    `json:"dc"`
	Bonus int    `json:"bonus"`
}

// ConditionsMet evaluates the silent conditions; it returns the first failing one.
func ConditionsMet(conds []Condition, class, race string, passive int, items []string) (bool, string) {
	for _, c := range conds {
		v := strings.ToLower(strings.TrimSpace(c.Value))
		switch c.Type {
		case "class":
			if !strings.Contains(strings.ToLower(class), v) {
				return false, "class"
			}
		case "race":
			if !strings.Contains(strings.ToLower(race), v) {
				return false, "race"
			}
		case "has_item":
			found := false
			for _, it := range items {
				if strings.Contains(it, v) {
					found = true
					break
				}
			}
			if !found {
				return false, "has_item"
			}
		case "passive":
			if passive < c.Min {
				return false, "passive"
			}
		}
	}
	return true, ""
}

// LootEntry is one line of fixed loot or of a weighted table.
type LootEntry struct {
	Name   string `json:"name"`
	Qty    int    `json:"qty"`
	Gold   int    `json:"gold"`
	Weight int    `json:"weight"`
}

// RollLootTable picks one weighted entry (weight ≤ 0 counts as 1).
func RollLootTable(entries []LootEntry, rnd *rand.Rand) (LootEntry, bool) {
	total := 0
	for _, e := range entries {
		total += max(1, e.Weight)
	}
	if total == 0 {
		return LootEntry{}, false
	}
	pick := rnd.IntN(total)
	for _, e := range entries {
		pick -= max(1, e.Weight)
		if pick < 0 {
			return e, true
		}
	}
	return entries[len(entries)-1], true
}

// DescribeLoot renders a grant for the player.
func DescribeLoot(gold int, items []LootEntry) string {
	parts := []string{}
	for _, it := range items {
		if it.Name != "" {
			parts = append(parts, fmt.Sprintf("%s ×%d", it.Name, max(1, it.Qty)))
		}
	}
	if gold > 0 {
		parts = append(parts, fmt.Sprintf("%d po", gold))
	}
	if len(parts) == 0 {
		return "nada de valor"
	}
	return strings.Join(parts, ", ")
}

// ---------- Turn order (vtt-modes.md §5) ----------

// AdvanceTurn moves to the next combatant; it reports whether a new round started.
func AdvanceTurn(c *domain.VTTCombat) bool {
	if len(c.Combatants) == 0 {
		return false
	}
	c.TurnIndex++
	if c.TurnIndex >= len(c.Combatants) {
		c.TurnIndex = 0
		c.Round++
		return true
	}
	return false
}
