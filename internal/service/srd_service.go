package service

import (
	"fmt"
	"math"
	"sort"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// SRDService handles D&D 5e SRD rules logic: encounter building, spell planning, loadout analysis.
type SRDService struct {
	repo *repository.SRDRepository
}

// NewSRDService creates a new SRDService.
func NewSRDService(repo *repository.SRDRepository) *SRDService {
	return &SRDService{repo: repo}
}

// ── CR / XP Tables ──────────────────────────────────────────

// CRToXP maps Challenge Rating strings to XP values (SRD 5.1).
var CRToXP = map[string]int{
	"0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
	"1": 200, "2": 450, "3": 700, "4": 1100,
	"5": 1800, "6": 2300, "7": 2900, "8": 3900,
	"9": 5000, "10": 5900, "11": 7200, "12": 8400,
	"13": 10000, "14": 11500, "15": 13000, "16": 15000,
	"17": 18000, "18": 20000, "19": 22000, "20": 25000,
	"21": 33000, "22": 41000, "23": 50000, "24": 62000,
	"25": 75000, "26": 90000, "27": 105000, "28": 120000,
	"29": 135000, "30": 155000,
}

// CRToNumeric converts a CR string to a float64 for comparison.
func CRToNumeric(cr string) float64 {
	switch cr {
	case "0":
		return 0
	case "1/8":
		return 0.125
	case "1/4":
		return 0.25
	case "1/2":
		return 0.5
	default:
		var n float64
		fmt.Sscanf(cr, "%f", &n)
		return n
	}
}

// GetXPForCR returns the XP value for a given CR string.
func GetXPForCR(cr string) int {
	if xp, ok := CRToXP[cr]; ok {
		return xp
	}
	return 0
}

// ── XP Thresholds (DMG p. 82) ───────────────────────────────

// Difficulty levels for encounter building.
type Difficulty string

const (
	DifficultyEasy   Difficulty = "easy"
	DifficultyMedium Difficulty = "medium"
	DifficultyHard   Difficulty = "hard"
	DifficultyDeadly Difficulty = "deadly"
)

// XPThreshold holds XP thresholds for a single character level.
type XPThreshold struct {
	Easy   int
	Medium int
	Hard   int
	Deadly int
}

// XPThresholds maps character level (1-20) to XP thresholds.
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

// ── Encounter Builder ───────────────────────────────────────

// EncounterRequest is the input for encounter building.
type EncounterRequest struct {
	PartySize       int        `json:"party_size" binding:"required,min=1,max=20"`
	PartyLevel      int        `json:"party_level" binding:"required,min=1,max=20"`
	Difficulty      Difficulty `json:"difficulty" binding:"required"`
	MonsterType     string     `json:"monster_type"`
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
	Name  string `json:"name"`
	CR    string `json:"cr"`
	XP    int    `json:"xp"`
	Count int    `json:"count"`
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
	Suggestions      []EncounterSuggestion `json:"suggestions"`
}

// getEncounterMultiplier returns the XP multiplier based on number of monsters.
func getEncounterMultiplier(monsterCount int) float64 {
	if monsterCount <= 1 {
		return 1.0
	}
	if monsterCount == 2 {
		return 1.5
	}
	if monsterCount <= 6 {
		return 2.0
	}
	if monsterCount <= 10 {
		return 2.5
	}
	if monsterCount <= 14 {
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
	if adjustedXP >= budget.Deadly {
		return "deadly"
	}
	if adjustedXP >= budget.Hard {
		return "hard"
	}
	if adjustedXP >= budget.Medium {
		return "medium"
	}
	if adjustedXP >= budget.Easy {
		return "easy"
	}
	return "trivial"
}

// getBudgetForDifficulty returns the target budget for a specific difficulty.
func getBudgetForDifficulty(budget PartyBudget, difficulty Difficulty) int {
	switch difficulty {
	case DifficultyEasy:
		return budget.Easy
	case DifficultyMedium:
		return budget.Medium
	case DifficultyHard:
		return budget.Hard
	case DifficultyDeadly:
		return budget.Deadly
	default:
		return budget.Medium
	}
}

// BuildEncounter generates encounter suggestions based on party parameters.
func (s *SRDService) BuildEncounter(req EncounterRequest) (*EncounterResult, error) {
	budget := calculatePartyBudget(req.PartySize, req.PartyLevel)
	targetBudget := getBudgetForDifficulty(budget, req.Difficulty)

	// Determine CR range for monster search
	crMax := float64(req.PartyLevel + 3)
	if crMax > 30 {
		crMax = 30
	}
	monsters, err := s.repo.GetMonstersByCRRange(0, crMax, req.MonsterType)
	if err != nil {
		return nil, fmt.Errorf("fetch monsters: %w", err)
	}

	var suggestions []EncounterSuggestion

	maxCount := req.MaxMonsterCount
	if maxCount <= 0 {
		maxCount = 10
	}

	// Strategy 1: Single strong monster
	for _, m := range monsters {
		xp := GetXPForCR(m.CR)
		adjusted := int(float64(xp) * getEncounterMultiplier(1))
		if float64(adjusted) >= float64(targetBudget)*0.6 && float64(adjusted) <= float64(targetBudget)*1.2 {
			suggestions = append(suggestions, EncounterSuggestion{
				Monsters: []MonsterSuggestion{
					{Name: m.Name, CR: m.CR, XP: xp, Count: 1},
				},
				TotalXP:          xp,
				AdjustedXP:       adjusted,
				MonsterCount:     1,
				ActualDifficulty: classifyDifficulty(adjusted, budget),
			})
		}
	}

	// Strategy 2: Groups of identical monsters
	for _, groupSize := range []int{2, 3, 4, 5, 6} {
		if groupSize > maxCount {
			break
		}
		multiplier := getEncounterMultiplier(groupSize)
		targetXP := float64(targetBudget) / multiplier / float64(groupSize)

		for _, m := range monsters {
			xp := GetXPForCR(m.CR)
			if math.Abs(float64(xp)-targetXP) <= targetXP*0.5 {
				totalXP := xp * groupSize
				adjustedXP := int(float64(totalXP) * multiplier)
				if float64(adjustedXP) >= float64(targetBudget)*0.7 && float64(adjustedXP) <= float64(targetBudget)*1.3 {
					suggestions = append(suggestions, EncounterSuggestion{
						Monsters: []MonsterSuggestion{
							{Name: m.Name, CR: m.CR, XP: xp, Count: groupSize},
						},
						TotalXP:          totalXP,
						AdjustedXP:       adjustedXP,
						MonsterCount:     groupSize,
						ActualDifficulty: classifyDifficulty(adjustedXP, budget),
					})
				}
			}
		}
	}

	// Sort by proximity to target budget
	sort.Slice(suggestions, func(i, j int) bool {
		distI := math.Abs(float64(suggestions[i].AdjustedXP - targetBudget))
		distJ := math.Abs(float64(suggestions[j].AdjustedXP - targetBudget))
		return distI < distJ
	})

	// Limit to top suggestions
	if len(suggestions) > 10 {
		suggestions = suggestions[:10]
	}

	return &EncounterResult{
		PartyBudget:      budget,
		TargetDifficulty: string(req.Difficulty),
		Suggestions:      suggestions,
	}, nil
}

// ── Loadout Analysis ────────────────────────────────────────

// LoadoutRequest is the input for loadout analysis.
type LoadoutRequest struct {
	EquipmentIDs []int64 `json:"equipment_ids" binding:"required"`
	STRScore     int     `json:"str_score"`
	DEXScore     int     `json:"dex_score"`
}

// LoadoutResult is the response from loadout analysis.
type LoadoutResult struct {
	ACFormula           string   `json:"ac_formula"`
	TotalAC             int      `json:"total_ac"`
	TotalWeight         float64  `json:"total_weight"`
	TotalCost           float64  `json:"total_cost"`
	CarryingCapacity    int      `json:"carrying_capacity"`
	IsEncumbered        bool     `json:"is_encumbered"`
	IsHeavilyEncumbered bool     `json:"is_heavily_encumbered"`
	Warnings            []string `json:"warnings"`
}

// AnalyzeLoadout calculates AC, weight, cost, and encumbrance for a set of equipment.
func (s *SRDService) AnalyzeLoadout(req LoadoutRequest) (*LoadoutResult, error) {
	result := &LoadoutResult{
		Warnings: []string{},
	}

	dexMod := domain.AbilityModifier(req.DEXScore)
	carryCapacity := req.STRScore * 15
	result.CarryingCapacity = carryCapacity

	var wornArmor *domain.SRDEquipment
	hasShield := false

	for _, eqID := range req.EquipmentIDs {
		eq, err := s.repo.GetEquipment(eqID)
		if err != nil {
			continue // skip items not found
		}

		result.TotalWeight += eq.Weight
		result.TotalCost += eq.CostGP

		cat := eq.Category
		if cat == "Shield" || cat == "Shields" {
			hasShield = true
		} else if eq.ACBase != nil && eq.ArmorCategory != "" {
			if wornArmor == nil || (eq.ACBase != nil && *eq.ACBase > *wornArmor.ACBase) {
				wornArmor = eq
			}
		}
	}

	// Calculate AC
	if wornArmor == nil && !hasShield {
		result.ACFormula = fmt.Sprintf("10 + DEX mod (%d)", dexMod)
		result.TotalAC = 10 + dexMod
	} else {
		ac := 10
		formula := "10"

		if wornArmor != nil {
			ac = *wornArmor.ACBase
			formula = fmt.Sprintf("%d", ac)

			if wornArmor.ACDexBonus != nil && *wornArmor.ACDexBonus {
				if wornArmor.ACMaxBonus != nil {
					bonus := dexMod
					if bonus > *wornArmor.ACMaxBonus {
						bonus = *wornArmor.ACMaxBonus
					}
					ac += bonus
					formula += fmt.Sprintf(" + DEX mod (max %d) = %d", *wornArmor.ACMaxBonus, bonus)
				} else {
					ac += dexMod
					formula += fmt.Sprintf(" + DEX mod (%d)", dexMod)
				}
			}

			if wornArmor.StealthDisadvantage {
				result.Warnings = append(result.Warnings, "Armor imposes disadvantage on Stealth checks")
			}
			if wornArmor.StrMinimum != nil && req.STRScore < *wornArmor.StrMinimum {
				result.Warnings = append(result.Warnings,
					fmt.Sprintf("STR %d required for %s (you have %d). Speed reduced by 10 ft.",
						*wornArmor.StrMinimum, wornArmor.Name, req.STRScore))
			}
		}

		if hasShield {
			ac += 2
			formula += " + 2 (shield)"
		}

		result.ACFormula = formula
		result.TotalAC = ac
	}

	// Encumbrance check
	if carryCapacity > 0 {
		if result.TotalWeight > float64(carryCapacity) {
			result.IsEncumbered = true
			result.Warnings = append(result.Warnings, "Encumbered: speed reduced by 10 ft.")
		}
		if result.TotalWeight > float64(carryCapacity*2) {
			result.IsHeavilyEncumbered = true
			result.Warnings = append(result.Warnings, "Heavily encumbered: speed reduced by 20 ft., disadvantage on ability checks, attack rolls, and saving throws")
		}
	}

	return result, nil
}

// ── Passthrough to Repository ───────────────────────────────

func (s *SRDService) SearchMonsters(f domain.MonsterFilters) (*domain.PaginatedResult[domain.MonsterListItem], error) {
	return s.repo.SearchMonsters(f)
}

func (s *SRDService) GetMonster(id int64) (*domain.SRDMonster, error) {
	return s.repo.GetMonster(id)
}

func (s *SRDService) SearchSpells(f domain.SpellFilters) (*domain.PaginatedResult[domain.SpellListItem], error) {
	return s.repo.SearchSpells(f)
}

func (s *SRDService) GetSpell(id int64) (*domain.SRDSpell, error) {
	return s.repo.GetSpell(id)
}

func (s *SRDService) SearchEquipment(f domain.EquipmentFilters) (*domain.PaginatedResult[domain.SRDEquipment], error) {
	return s.repo.SearchEquipment(f)
}

func (s *SRDService) GetEquipment(id int64) (*domain.SRDEquipment, error) {
	return s.repo.GetEquipment(id)
}

func (s *SRDService) SearchMagicItems(f domain.MagicItemFilters) (*domain.PaginatedResult[domain.SRDMagicItem], error) {
	return s.repo.SearchMagicItems(f)
}

func (s *SRDService) GetMagicItem(id int64) (*domain.SRDMagicItem, error) {
	return s.repo.GetMagicItem(id)
}

func (s *SRDService) ListClasses() ([]domain.SRDClass, error) {
	return s.repo.ListClasses()
}

func (s *SRDService) GetClassByName(name string) (*domain.SRDClass, error) {
	return s.repo.GetClassByName(name)
}

func (s *SRDService) ListRaces() ([]domain.SRDRace, error) {
	return s.repo.ListRaces()
}

func (s *SRDService) GetRaceByName(name string) (*domain.SRDRace, error) {
	return s.repo.GetRaceByName(name)
}

func (s *SRDService) ListConditions() ([]domain.SRDCondition, error) {
	return s.repo.ListConditions()
}

func (s *SRDService) SearchRules(f domain.RulesFilters) (*domain.PaginatedResult[domain.SRDRule], error) {
	return s.repo.SearchRules(f)
}
