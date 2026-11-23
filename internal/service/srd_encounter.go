package service

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// ErrInvalidDifficulty is returned when the requested difficulty is not easy|medium|hard|deadly.
var ErrInvalidDifficulty = errors.New("difficulty must be one of: easy, medium, hard, deadly")

// Difficulty levels for encounter building.
type Difficulty string

const (
	DifficultyEasy   Difficulty = "easy"
	DifficultyMedium Difficulty = "medium"
	DifficultyHard   Difficulty = "hard"
	DifficultyDeadly Difficulty = "deadly"
)

// ParseDifficulty normalizes and validates a difficulty string.
func ParseDifficulty(raw string) (Difficulty, error) {
	d := Difficulty(strings.ToLower(strings.TrimSpace(raw)))
	switch d {
	case DifficultyEasy, DifficultyMedium, DifficultyHard, DifficultyDeadly:
		return d, nil
	}
	return "", ErrInvalidDifficulty
}

// XPThreshold holds XP thresholds for a single character level.
type XPThreshold struct {
	Easy   int
	Medium int
	Hard   int
	Deadly int
}

// XPThresholds maps character level (1-20) to XP thresholds (DMG p. 82).
var XPThresholds = map[int]XPThreshold{
	1:  {25, 50, 75, 100},
	2:  {50, 100, 150, 200},
	3:  {75, 150, 225, 400},
	4:  {125, 250, 375, 500},
	5:  {250, 500, 750, 1100},
	6:  {300, 600, 900, 1400},
	7:  {350, 750, 1100, 1700},
	8:  {450, 900, 1400, 2100},
	9:  {550, 1100, 1600, 2400},
	10: {600, 1200, 1900, 2800},
	11: {800, 1600, 2400, 3600},
	12: {1000, 2000, 3000, 4500},
	13: {1100, 2200, 3400, 5100},
	14: {1250, 2500, 3800, 5700},
	15: {1400, 2800, 4300, 6400},
	16: {1600, 3200, 4800, 7200},
	17: {2000, 3900, 5900, 8800},
	18: {2100, 4200, 6300, 9500},
	19: {2400, 4900, 7300, 10900},
	20: {2800, 5700, 8500, 12700},
}

// EncounterRequest is the input for encounter building.
type EncounterRequest struct {
	PartySize       int        `json:"party_size" binding:"required,min=1,max=20"`
	PartyLevel      int        `json:"party_level" binding:"required,min=1,max=20"`
	Difficulty      Difficulty `json:"difficulty" binding:"required"`
	MonsterType     string     `json:"monster_type"`
	Environment     string     `json:"environment"` // optional flavor; SRD tables hold no environment data, so it is echoed only
	MaxMonsterCount int        `json:"max_monster_count"`
}

// PartyBudget holds XP budgets for all difficulty levels.
type PartyBudget struct {
	Easy   int `json:"easy"`
	Medium int `json:"medium"`
	Hard   int `json:"hard"`
	Deadly int `json:"deadly"`
}

// MonsterSuggestion represents a monster with count in an encounter.
type MonsterSuggestion struct {
	MonsterID int64  `json:"monster_id"`
	Name      string `json:"name"`
	CR        string `json:"cr"`
	XP        int    `json:"xp"`
	Count     int    `json:"count"`
}

// EncounterSuggestion represents a single encounter suggestion.
type EncounterSuggestion struct {
	Monsters         []MonsterSuggestion `json:"monsters"`
	TotalXP          int                 `json:"total_xp"`
	AdjustedXP       int                 `json:"adjusted_xp"`
	MonsterCount     int                 `json:"monster_count"`
	ActualDifficulty string              `json:"actual_difficulty"`
}

// EncounterResult is the full response from the encounter builder.
type EncounterResult struct {
	PartyBudget      PartyBudget           `json:"party_budget"`
	TargetDifficulty string                `json:"target_difficulty"`
	Environment      string                `json:"environment,omitempty"`
	Suggestions      []EncounterSuggestion `json:"suggestions"`
	Message          string                `json:"message,omitempty"`
}

// getEncounterMultiplier returns the XP multiplier based on number of monsters.
func getEncounterMultiplier(monsterCount int) float64 {
	switch {
	case monsterCount <= 1:
		return 1.0
	case monsterCount == 2:
		return 1.5
	case monsterCount <= 6:
		return 2.0
	case monsterCount <= 10:
		return 2.5
	case monsterCount <= 14:
		return 3.0
	}
	return 4.0
}

// calculatePartyBudget computes XP budgets for all difficulties.
func calculatePartyBudget(partySize, partyLevel int) PartyBudget {
	t := XPThresholds[partyLevel]
	return PartyBudget{
		Easy:   t.Easy * partySize,
		Medium: t.Medium * partySize,
		Hard:   t.Hard * partySize,
		Deadly: t.Deadly * partySize,
	}
}

// classifyDifficulty determines the difficulty label for an adjusted XP value.
func classifyDifficulty(adjustedXP int, budget PartyBudget) string {
	switch {
	case adjustedXP >= budget.Deadly:
		return "deadly"
	case adjustedXP >= budget.Hard:
		return "hard"
	case adjustedXP >= budget.Medium:
		return "medium"
	case adjustedXP >= budget.Easy:
		return "easy"
	}
	return "trivial"
}

// getBudgetForDifficulty returns the target budget for a specific difficulty.
func getBudgetForDifficulty(budget PartyBudget, difficulty Difficulty) int {
	switch difficulty {
	case DifficultyEasy:
		return budget.Easy
	case DifficultyHard:
		return budget.Hard
	case DifficultyDeadly:
		return budget.Deadly
	}
	return budget.Medium
}

func monsterXP(m domain.SRDMonster) int {
	if xp := GetXPForCR(m.CR); xp > 0 {
		return xp
	}
	return m.XP
}

// window holds inclusive adjusted-XP bounds as fractions of the budget.
type window struct{ lo, hi float64 }

func (w window) contains(adjusted, target int) bool {
	return float64(adjusted) >= float64(target)*w.lo && float64(adjusted) <= float64(target)*w.hi
}

// widen expands a window symmetrically (used only when too few suggestions are found).
func (w window) widen(delta float64) window {
	lo := w.lo - delta
	if lo < 0.05 {
		lo = 0.05
	}
	return window{lo, w.hi + delta}
}

// Spec windows (openspec/specs/encounter-builder.md).
var (
	strategy1Window = window{0.6, 1.1}
	strategy2Window = window{0.8, 1.2}
	strategy3Window = window{0.8, 1.2}
)

const (
	minSuggestions = 3
	maxSuggestions = 10
)

func newSuggestion(budget PartyBudget, groups ...MonsterSuggestion) EncounterSuggestion {
	total, count := 0, 0
	for _, g := range groups {
		total += g.XP * g.Count
		count += g.Count
	}
	adjusted := int(math.Round(float64(total) * getEncounterMultiplier(count)))
	return EncounterSuggestion{
		Monsters:         groups,
		TotalXP:          total,
		AdjustedXP:       adjusted,
		MonsterCount:     count,
		ActualDifficulty: classifyDifficulty(adjusted, budget),
	}
}

func suggestionKey(s EncounterSuggestion) string {
	parts := make([]string, len(s.Monsters))
	for i, m := range s.Monsters {
		parts[i] = fmt.Sprintf("%s*%d", m.Name, m.Count)
	}
	return strings.Join(parts, "+")
}

// generateSuggestions runs the three strategies, optionally widening the spec windows.
// monsters must be sorted by XP ascending.
func generateSuggestions(monsters []domain.SRDMonster, budget PartyBudget, target, maxCount int, widen float64) []EncounterSuggestion {
	var out []EncounterSuggestion
	w1, w2, w3 := strategy1Window.widen(widen), strategy2Window.widen(widen), strategy3Window.widen(widen)
	if widen == 0 {
		w1, w2, w3 = strategy1Window, strategy2Window, strategy3Window
	}

	// Strategy 1: one strong monster whose XP is within the window.
	for _, m := range monsters {
		xp := monsterXP(m)
		if xp > 0 && w1.contains(xp, target) {
			out = append(out, newSuggestion(budget, MonsterSuggestion{MonsterID: m.ID, Name: m.Name, CR: m.CR, XP: xp, Count: 1}))
		}
	}

	// Strategy 2: identical groups of 2..6, monsters with XP closest to budget/multiplier/size.
	usable := make([]domain.SRDMonster, 0, len(monsters))
	for _, m := range monsters {
		if monsterXP(m) > 0 {
			usable = append(usable, m)
		}
	}
	for size := 2; size <= 6 && size <= maxCount; size++ {
		targetXP := float64(target) / getEncounterMultiplier(size) / float64(size)
		cands := append([]domain.SRDMonster(nil), usable...)
		sort.SliceStable(cands, func(i, j int) bool {
			return math.Abs(float64(monsterXP(cands[i]))-targetXP) < math.Abs(float64(monsterXP(cands[j]))-targetXP)
		})
		taken := 0
		for _, m := range cands {
			s := newSuggestion(budget, MonsterSuggestion{MonsterID: m.ID, Name: m.Name, CR: m.CR, XP: monsterXP(m), Count: size})
			if w2.contains(s.AdjustedXP, target) {
				out = append(out, s)
				if taken++; taken >= 2 {
					break
				}
			}
		}
	}

	// Strategy 3: one strong monster + N weaker monsters (identical weak type).
	if maxCount >= 2 {
		strong := make([]domain.SRDMonster, 0)
		for _, m := range usable {
			if float64(monsterXP(m)) <= float64(target) {
				strong = append(strong, m)
			}
		}
		half := float64(target) * 0.5
		sort.SliceStable(strong, func(i, j int) bool {
			return math.Abs(float64(monsterXP(strong[i]))-half) < math.Abs(float64(monsterXP(strong[j]))-half)
		})
		if len(strong) > 8 {
			strong = strong[:8]
		}
		for _, st := range strong {
			sxp := monsterXP(st)
			seen := map[int]bool{}
			weakTried := 0
			for i := len(usable) - 1; i >= 0 && weakTried < 12; i-- { // strongest weaklings first
				w := usable[i]
				wxp := monsterXP(w)
				if wxp*2 > sxp || w.Name == st.Name || seen[wxp] {
					continue
				}
				seen[wxp] = true
				weakTried++
				for n := 1; n+1 <= maxCount; n++ {
					s := newSuggestion(budget,
						MonsterSuggestion{MonsterID: st.ID, Name: st.Name, CR: st.CR, XP: sxp, Count: 1},
						MonsterSuggestion{MonsterID: w.ID, Name: w.Name, CR: w.CR, XP: wxp, Count: n})
					if float64(s.AdjustedXP) > float64(target)*w3.hi {
						break
					}
					if w3.contains(s.AdjustedXP, target) {
						out = append(out, s)
					}
				}
			}
		}
	}
	return out
}

// buildEncounterSuggestions is the pure encounter-generation core.
func buildEncounterSuggestions(monsters []domain.SRDMonster, budget PartyBudget, target, maxCount int) []EncounterSuggestion {
	if maxCount <= 0 {
		maxCount = 10
	}
	sorted := append([]domain.SRDMonster(nil), monsters...)
	sort.SliceStable(sorted, func(i, j int) bool { return monsterXP(sorted[i]) < monsterXP(sorted[j]) })

	var all []EncounterSuggestion
	seen := map[string]bool{}
	collect := func(in []EncounterSuggestion) {
		for _, s := range in {
			if k := suggestionKey(s); !seen[k] {
				seen[k] = true
				all = append(all, s)
			}
		}
	}
	collect(generateSuggestions(sorted, budget, target, maxCount, 0))
	// Only widen the spec windows when strict windows yield fewer than 3 results.
	for _, delta := range []float64{0.2, 0.4} {
		if len(all) >= minSuggestions {
			break
		}
		collect(generateSuggestions(sorted, budget, target, maxCount, delta))
	}

	sort.SliceStable(all, func(i, j int) bool {
		di := math.Abs(float64(all[i].AdjustedXP - target))
		dj := math.Abs(float64(all[j].AdjustedXP - target))
		if di != dj {
			return di < dj
		}
		return all[i].MonsterCount < all[j].MonsterCount
	})
	if len(all) > maxSuggestions {
		all = all[:maxSuggestions]
	}
	return all
}

// BuildEncounter generates encounter suggestions based on party parameters.
func (s *SRDService) BuildEncounter(req EncounterRequest) (*EncounterResult, error) {
	diff, err := ParseDifficulty(string(req.Difficulty))
	if err != nil {
		return nil, err
	}
	budget := calculatePartyBudget(req.PartySize, req.PartyLevel)
	target := getBudgetForDifficulty(budget, diff)

	crMax := math.Min(float64(req.PartyLevel+3), 30)
	monsters, err := s.repo.GetMonstersByCRRange(0, crMax, req.MonsterType)
	if err != nil {
		return nil, fmt.Errorf("fetch monsters: %w", err)
	}

	suggestions := buildEncounterSuggestions(monsters, budget, target, req.MaxMonsterCount)
	if suggestions == nil {
		suggestions = []EncounterSuggestion{}
	}
	res := &EncounterResult{
		PartyBudget:      budget,
		TargetDifficulty: string(diff),
		Environment:      strings.TrimSpace(req.Environment),
		Suggestions:      suggestions,
	}
	if len(suggestions) == 0 {
		res.Message = "No monsters match the given constraints (party level, monster type, max monster count); try relaxing them."
	}
	return res, nil
}
