package service

import (
	"fmt"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// LoadoutItem is an equipment reference with a quantity.
type LoadoutItem struct {
	EquipmentID int64 `json:"equipment_id" binding:"required"`
	Quantity    int   `json:"quantity"` // defaults to 1
}

// LoadoutRequest is the input for loadout analysis. Repeating an id in
// equipment_ids counts it again; items allows explicit quantities.
type LoadoutRequest struct {
	EquipmentIDs []int64       `json:"equipment_ids"`
	Items        []LoadoutItem `json:"items"`
	STRScore     int           `json:"str_score"`
	DEXScore     int           `json:"dex_score"`
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

type loadoutEntry struct {
	eq  *domain.SRDEquipment
	qty int
}

// floorMod is the D&D ability modifier floor((score-10)/2), correct for scores below 10.
func floorMod(score int) int {
	d := score - 10
	if d >= 0 {
		return d / 2
	}
	return -((-d + 1) / 2)
}

func isShield(eq *domain.SRDEquipment) bool {
	cat := strings.ToLower(eq.Category)
	return cat == "shield" || cat == "shields" || strings.EqualFold(eq.ArmorCategory, "shield")
}

// computeLoadout is the pure core of loadout analysis.
func computeLoadout(entries []loadoutEntry, strScore, dexScore int) *LoadoutResult {
	result := &LoadoutResult{Warnings: []string{}}
	dexMod := floorMod(dexScore)
	carry := strScore * 15
	result.CarryingCapacity = carry

	var armor *domain.SRDEquipment
	hasShield := false
	for _, e := range entries {
		q := e.qty
		if q <= 0 {
			q = 1
		}
		result.TotalWeight += e.eq.Weight * float64(q)
		result.TotalCost += e.eq.CostGP * float64(q)
		switch {
		case isShield(e.eq):
			hasShield = true
		case e.eq.ACBase != nil && e.eq.ArmorCategory != "":
			if armor == nil || *e.eq.ACBase > *armor.ACBase {
				armor = e.eq
			}
		}
	}

	ac := 10 + dexMod
	formula := fmt.Sprintf("10 + DEX mod (%d)", dexMod)
	if armor != nil {
		ac = *armor.ACBase
		formula = fmt.Sprintf("%d", ac)
		bonus, capped, usesDex := 0, false, false
		switch strings.ToLower(armor.ArmorCategory) {
		case "light":
			bonus, usesDex = dexMod, true
		case "medium":
			bonus, usesDex, capped = dexMod, true, true
			if bonus > 2 {
				bonus = 2
			}
		case "heavy":
			// no DEX bonus
		default:
			if armor.ACDexBonus != nil && *armor.ACDexBonus {
				bonus, usesDex = dexMod, true
				if armor.ACMaxBonus != nil && bonus > *armor.ACMaxBonus {
					bonus, capped = *armor.ACMaxBonus, true
				}
			}
		}
		if usesDex {
			ac += bonus
			if capped {
				formula += fmt.Sprintf(" + DEX mod (max applied) = %d", bonus)
			} else {
				formula += fmt.Sprintf(" + DEX mod (%d)", bonus)
			}
		}
		if armor.StealthDisadvantage {
			result.Warnings = append(result.Warnings, "Armor imposes disadvantage on Stealth checks")
		}
		if armor.StrMinimum != nil && *armor.StrMinimum > 0 && strScore < *armor.StrMinimum {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("STR %d required for %s (you have %d). Speed reduced by 10 ft.", *armor.StrMinimum, armor.Name, strScore))
		}
	}
	if hasShield {
		ac += 2
		formula += " + 2 (shield)"
	}
	result.TotalAC = ac
	result.ACFormula = formula

	if carry > 0 {
		if result.TotalWeight > float64(carry) {
			result.IsEncumbered = true
			result.Warnings = append(result.Warnings, "Encumbered: speed reduced by 10 ft.")
		}
		if result.TotalWeight > float64(carry*2) {
			result.IsHeavilyEncumbered = true
			result.Warnings = append(result.Warnings, "Heavily encumbered: speed reduced by 20 ft., disadvantage on ability checks, attack rolls, and saving throws")
		}
	}
	return result
}

// AnalyzeLoadout calculates AC, weight, cost, and encumbrance for a set of equipment.
func (s *SRDService) AnalyzeLoadout(req LoadoutRequest) (*LoadoutResult, error) {
	qty := map[int64]int{}
	order := []int64{}
	add := func(id int64, q int) {
		if q <= 0 {
			q = 1
		}
		if _, ok := qty[id]; !ok {
			order = append(order, id)
		}
		qty[id] += q
	}
	for _, id := range req.EquipmentIDs {
		add(id, 1)
	}
	for _, it := range req.Items {
		add(it.EquipmentID, it.Quantity)
	}
	entries := make([]loadoutEntry, 0, len(order))
	for _, id := range order {
		eq, err := s.repo.GetEquipment(id)
		if err != nil {
			continue // skip items not found
		}
		entries = append(entries, loadoutEntry{eq: eq, qty: qty[id]})
	}
	return computeLoadout(entries, req.STRScore, req.DEXScore), nil
}
