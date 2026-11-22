package service

import (
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func mon(name, cr string) domain.SRDMonster {
	return domain.SRDMonster{Name: name, CR: cr, XP: GetXPForCR(cr)}
}

var sampleMonsters = []domain.SRDMonster{
	mon("Rat", "0"), mon("Goblin", "1/4"), mon("Wolf", "1/4"), mon("Orc", "1/2"), mon("Ghoul", "1"),
	mon("Ogre", "2"), mon("Wight", "3"), mon("Ettin", "4"), mon("Troll", "5"), mon("Wraith", "5"),
}

func TestParseDifficulty(t *testing.T) {
	tests := []struct {
		in      string
		want    Difficulty
		wantErr bool
	}{
		{"easy", DifficultyEasy, false},
		{"Medium", DifficultyMedium, false},
		{" HARD ", DifficultyHard, false},
		{"deadly", DifficultyDeadly, false},
		{"", "", true},
		{"impossible", "", true},
	}
	for _, tt := range tests {
		got, err := ParseDifficulty(tt.in)
		if (err != nil) != tt.wantErr || got != tt.want {
			t.Errorf("ParseDifficulty(%q) = %q, %v", tt.in, got, err)
		}
	}
}

func TestEncounterMultiplier(t *testing.T) {
	tests := map[int]float64{1: 1, 2: 1.5, 3: 2, 6: 2, 7: 2.5, 10: 2.5, 11: 3, 14: 3, 15: 4, 20: 4}
	for n, want := range tests {
		if got := getEncounterMultiplier(n); got != want {
			t.Errorf("multiplier(%d) = %v, want %v", n, got, want)
		}
	}
}

func TestClassifyDifficulty(t *testing.T) {
	b := calculatePartyBudget(4, 5) // 1000 / 2000 / 3000 / 4400
	tests := []struct {
		adj  int
		want string
	}{{999, "trivial"}, {1000, "easy"}, {1999, "easy"}, {2000, "medium"}, {3000, "hard"}, {4400, "deadly"}}
	for _, tt := range tests {
		if got := classifyDifficulty(tt.adj, b); got != tt.want {
			t.Errorf("classify(%d) = %s, want %s", tt.adj, got, tt.want)
		}
	}
}

func TestBuildEncounterSuggestions(t *testing.T) {
	tests := []struct {
		name      string
		size, lvl int
		diff      Difficulty
		maxCount  int
		monsters  []domain.SRDMonster
		minSugg   int
		strict    bool // all suggestions must satisfy the strict spec windows
	}{
		{"medium level 5 party of 4", 4, 5, DifficultyMedium, 0, sampleMonsters, 3, true},
		{"deadly level 3", 4, 3, DifficultyDeadly, 8, sampleMonsters, 3, false},
		{"easy level 1 solo", 1, 1, DifficultyEasy, 4, sampleMonsters, 1, false},
		{"no monsters", 4, 5, DifficultyMedium, 0, nil, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			budget := calculatePartyBudget(tt.size, tt.lvl)
			target := getBudgetForDifficulty(budget, tt.diff)
			got := buildEncounterSuggestions(tt.monsters, budget, target, tt.maxCount)
			if len(got) < tt.minSugg {
				t.Fatalf("got %d suggestions, want >= %d", len(got), tt.minSugg)
			}
			if len(got) > maxSuggestions {
				t.Fatalf("too many suggestions: %d", len(got))
			}
			maxCount := tt.maxCount
			if maxCount <= 0 {
				maxCount = 10
			}
			for _, s := range got {
				if s.MonsterCount > maxCount {
					t.Errorf("%v exceeds max count %d", s, maxCount)
				}
				want := int(float64(s.TotalXP)*getEncounterMultiplier(s.MonsterCount) + 0.5)
				if s.AdjustedXP != want {
					t.Errorf("adjusted xp %d, want %d", s.AdjustedXP, want)
				}
				if tt.strict {
					in1 := s.MonsterCount == 1 && strategy1Window.contains(s.AdjustedXP, target)
					in2 := s.MonsterCount > 1 && strategy2Window.contains(s.AdjustedXP, target)
					if !in1 && !in2 {
						t.Errorf("suggestion %v outside strict windows for target %d", s, target)
					}
				}
			}
			for i := 1; i < len(got); i++ {
				a, b := got[i-1].AdjustedXP-target, got[i].AdjustedXP-target
				if a < 0 {
					a = -a
				}
				if b < 0 {
					b = -b
				}
				if a > b {
					t.Errorf("suggestions not sorted by proximity to target")
				}
			}
		})
	}
}

func TestStrategyWindows(t *testing.T) {
	// target 1000: single window is [600, 1100].
	budget := PartyBudget{Easy: 500, Medium: 1000, Hard: 1500, Deadly: 2000}
	monsters := []domain.SRDMonster{
		{Name: "TooWeak", CR: "x", XP: 0}, // unknown CR and zero xp are ignored
		mon("Wight", "3"),                 // 700: inside [600,1100]
		mon("Ettin", "4"),                 // 1100: inside (inclusive upper bound)
		mon("Troll", "5"),                 // 1800: outside
	}
	got := generateSuggestions(monsters, budget, 1000, 1, 0)
	names := map[string]bool{}
	for _, s := range got {
		if s.MonsterCount != 1 {
			t.Fatalf("maxCount=1 must only yield singles, got %v", s)
		}
		names[s.Monsters[0].Name] = true
	}
	if !names["Wight"] || !names["Ettin"] || names["Troll"] || names["TooWeak"] {
		t.Errorf("unexpected strategy 1 result: %v", names)
	}
}

func TestMixedGroupStrategy(t *testing.T) {
	budget := PartyBudget{Easy: 500, Medium: 1000, Hard: 1500, Deadly: 2000}
	monsters := []domain.SRDMonster{mon("Goblin", "1/4"), mon("Ogre", "2")}
	got := generateSuggestions(monsters, budget, 1000, 6, 0)
	found := false
	for _, s := range got {
		if len(s.Monsters) == 2 {
			found = true
			if s.Monsters[0].Count != 1 || s.Monsters[1].XP >= s.Monsters[0].XP {
				t.Errorf("mixed group must be 1 strong + weaker: %v", s)
			}
			if !strategy3Window.contains(s.AdjustedXP, 1000) {
				t.Errorf("mixed group outside window: %v", s)
			}
		}
	}
	if !found {
		t.Error("expected at least one mixed suggestion")
	}
}

func TestComputeLoadout(t *testing.T) {
	i := func(v int) *int { return &v }
	b := func(v bool) *bool { return &v }
	chain := &domain.SRDEquipment{Name: "Chain Mail", Category: "Armor", ArmorCategory: "Heavy", ACBase: i(16), ACDexBonus: b(false), StrMinimum: i(13), StealthDisadvantage: true, Weight: 55, CostGP: 75}
	scale := &domain.SRDEquipment{Name: "Scale Mail", Category: "Armor", ArmorCategory: "Medium", ACBase: i(14), ACDexBonus: b(true), ACMaxBonus: i(2), Weight: 45}
	leather := &domain.SRDEquipment{Name: "Leather", Category: "Armor", ArmorCategory: "Light", ACBase: i(11), ACDexBonus: b(true), Weight: 10}
	shield := &domain.SRDEquipment{Name: "Shield", Category: "Shield", Weight: 6, CostGP: 10}
	rope := &domain.SRDEquipment{Name: "Rope", Category: "Adventuring Gear", Weight: 10, CostGP: 1}

	tests := []struct {
		name         string
		entries      []loadoutEntry
		str, dex     int
		wantAC       int
		wantWeight   float64
		wantEnc      bool
		wantHeavy    bool
		wantWarnings int
	}{
		{"no gear", nil, 10, 14, 12, 0, false, false, 0},
		{"shield only = 10 + DEX + 2", []loadoutEntry{{shield, 1}}, 10, 14, 14, 6, false, false, 0},
		{"shield only negative dex", []loadoutEntry{{shield, 1}}, 10, 8, 11, 6, false, false, 0},
		{"light + shield", []loadoutEntry{{leather, 1}, {shield, 1}}, 10, 16, 16, 16, false, false, 0},
		{"medium caps dex at 2", []loadoutEntry{{scale, 1}}, 10, 18, 16, 45, false, false, 0},
		{"heavy ignores dex, str ok", []loadoutEntry{{chain, 1}}, 15, 18, 16, 55, false, false, 1},
		{"heavy str too low warns", []loadoutEntry{{chain, 1}}, 10, 10, 16, 55, false, false, 2},
		{"weight x quantity", []loadoutEntry{{rope, 40}}, 10, 10, 10, 400, true, true, 2},
		{"encumbered only", []loadoutEntry{{rope, 16}}, 10, 10, 10, 160, true, false, 1},
		{"quantity 0 counts as 1", []loadoutEntry{{rope, 0}}, 10, 10, 10, 10, false, false, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := computeLoadout(tt.entries, tt.str, tt.dex)
			if r.TotalAC != tt.wantAC {
				t.Errorf("AC = %d (%s), want %d", r.TotalAC, r.ACFormula, tt.wantAC)
			}
			if r.TotalWeight != tt.wantWeight {
				t.Errorf("weight = %v, want %v", r.TotalWeight, tt.wantWeight)
			}
			if r.IsEncumbered != tt.wantEnc || r.IsHeavilyEncumbered != tt.wantHeavy {
				t.Errorf("encumbrance = %v/%v, want %v/%v", r.IsEncumbered, r.IsHeavilyEncumbered, tt.wantEnc, tt.wantHeavy)
			}
			if len(r.Warnings) != tt.wantWarnings {
				t.Errorf("warnings = %v, want %d", r.Warnings, tt.wantWarnings)
			}
		})
	}
}

func TestFloorMod(t *testing.T) {
	tests := map[int]int{1: -5, 8: -1, 9: -1, 10: 0, 11: 0, 12: 1, 15: 2, 20: 5}
	for score, want := range tests {
		if got := floorMod(score); got != want {
			t.Errorf("floorMod(%d) = %d, want %d", score, got, want)
		}
	}
}

func TestParseJSONFieldNullOnFailure(t *testing.T) {
	tests := []struct {
		in      string
		wantNil bool
	}{{"", true}, {"not json", true}, {"{bad", true}, {"[]", false}, {`{"walk":"30 ft."}`, false}}
	for _, tt := range tests {
		if got := parseJSONField(tt.in); (got == nil) != tt.wantNil {
			t.Errorf("parseJSONField(%q) = %v", tt.in, got)
		}
	}
}

func TestHomebrewValidation(t *testing.T) {
	valid := HomebrewMonsterRequest{Name: "Test", Size: "medium", Type: "Beast", AC: 12, HP: 10,
		STR: 10, DEX: 10, CON: 10, INT: 2, WIS: 10, CHA: 5, CR: "1/2"}
	m, err := valid.ToMonster()
	if err != nil {
		t.Fatal(err)
	}
	if m.IsSRD || m.XP != 100 || m.Size != "Medium" || m.Type != "beast" || m.ProficiencyBonus != 2 {
		t.Errorf("unexpected monster: %+v", m)
	}
	mutate := map[string]func(r *HomebrewMonsterRequest){
		"no name":      func(r *HomebrewMonsterRequest) { r.Name = " " },
		"bad size":     func(r *HomebrewMonsterRequest) { r.Size = "Colossal" },
		"bad type":     func(r *HomebrewMonsterRequest) { r.Type = "robot" },
		"bad cr":       func(r *HomebrewMonsterRequest) { r.CR = "31" },
		"zero hp":      func(r *HomebrewMonsterRequest) { r.HP = 0 },
		"ability low":  func(r *HomebrewMonsterRequest) { r.STR = 0 },
		"ability high": func(r *HomebrewMonsterRequest) { r.CHA = 31 },
		"traits obj":   func(r *HomebrewMonsterRequest) { r.Traits = []byte(`{"a":1}`) },
		"speed array":  func(r *HomebrewMonsterRequest) { r.Speed = []byte(`[1]`) },
	}
	for name, f := range mutate {
		r := valid
		f(&r)
		if _, err := r.ToMonster(); err == nil {
			t.Errorf("%s: expected validation error", name)
		}
	}
}
