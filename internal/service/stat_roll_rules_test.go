package service

import (
	"math/rand/v2"
	"testing"
)

func TestRollAbilitySet(t *testing.T) {
	rnd := rand.New(rand.NewPCG(7, 7))
	for n := 0; n < 200; n++ {
		dice, totals := RollAbilitySet(rnd)
		for i := range dice {
			if totals[i] < 3 || totals[i] > 18 || totals[i] != BestThree(dice[i]) {
				t.Fatalf("set %d: dice %v total %d", i, dice[i], totals[i])
			}
		}
	}
	if BestThree([4]int{1, 6, 3, 5}) != 14 || BestThree([4]int{2, 2, 2, 2}) != 6 {
		t.Fatal("best three")
	}
}

func TestPermutationAndBonuses(t *testing.T) {
	totals := []int{15, 12, 9, 14, 8, 12}
	if !IsPermutation(totals, [6]int{12, 15, 12, 8, 9, 14}) {
		t.Fatal("valid permutation rejected")
	}
	if IsPermutation(totals, [6]int{15, 15, 9, 14, 8, 12}) {
		t.Fatal("duplicate accepted")
	}
	base := [6]int{15, 14, 13, 12, 10, 8}
	cases := []struct {
		final [6]int
		ok    bool
	}{
		{base, true},
		{[6]int{17, 15, 13, 12, 10, 8}, true},
		{[6]int{16, 15, 14, 12, 10, 8}, true},
		{[6]int{18, 14, 13, 12, 10, 8}, false},
		{[6]int{17, 16, 13, 12, 10, 8}, false},
		{[6]int{14, 14, 13, 12, 10, 8}, false},
	}
	for i, c := range cases {
		if ValidBonuses(base, c.final) != c.ok {
			t.Errorf("case %d: want %v", i, c.ok)
		}
	}
	if ValidBonuses([6]int{19, 10, 10, 10, 10, 10}, [6]int{21, 11, 10, 10, 10, 10}) {
		t.Fatal("above 20 accepted")
	}
}
