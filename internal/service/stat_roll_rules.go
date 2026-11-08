package service

import (
	"errors"
	"math/rand/v2"
	"slices"
)

// Ability score generation (openspec/specs/characters.md, "Character Creation").

var (
	ErrRolledScoresMismatch = errors.New("las características no coinciden con tus tiradas")
	ErrInvalidBonuses       = errors.New("las mejoras deben ser +2/+1 o +1/+1/+1 (máximo 20)")
)

// RollAbilitySet rolls six times 4d6 and keeps the best three of each.
func RollAbilitySet(rnd *rand.Rand) (dice [6][4]int, totals [6]int) {
	for i := range dice {
		for j := range dice[i] {
			if rnd != nil {
				dice[i][j] = 1 + rnd.IntN(6)
			} else {
				dice[i][j] = 1 + rand.IntN(6)
			}
		}
		totals[i] = BestThree(dice[i])
	}
	return dice, totals
}

// BestThree sums a 4d6 set dropping the lowest die.
func BestThree(d [4]int) int {
	s := d[:]
	sorted := slices.Clone(s)
	slices.Sort(sorted)
	return sorted[1] + sorted[2] + sorted[3]
}

// IsPermutation reports whether base uses exactly the rolled totals, each once.
func IsPermutation(totals []int, base [6]int) bool {
	if len(totals) != 6 {
		return false
	}
	a := slices.Clone(totals)
	b := base[:]
	bs := slices.Clone(b)
	slices.Sort(a)
	slices.Sort(bs)
	return slices.Equal(a, bs)
}

// ValidBonuses checks the ability score increases applied over base: each +0..+2, total ≤ 3
// (+2/+1 or +1/+1/+1) and no score above 20.
func ValidBonuses(base, final [6]int) bool {
	sum := 0
	for i := range base {
		d := final[i] - base[i]
		if d < 0 || d > 2 || final[i] > 20 {
			return false
		}
		sum += d
	}
	return sum <= 3
}
