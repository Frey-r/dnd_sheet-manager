package content

import "testing"

func TestFirstNumberReadsMonsterArmorClass(t *testing.T) {
	cases := []struct {
		name  string
		value any
		want  int
	}{
		{"object with ac (MM dragon)", []any{map[string]any{"ac": float64(19), "from": []any{"natural armor"}}}, 19},
		{"plain number list", []any{float64(15)}, 15},
		{"object with number", []any{map[string]any{"number": float64(30)}}, 30},
		{"missing", nil, 10},
	}
	for _, c := range cases {
		if got := firstNumber(c.value, 10); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

func TestMonsterTypeParts(t *testing.T) {
	cases := []struct {
		name          string
		value         any
		main, subtype string
	}{
		{"plain", "dragon", "dragon", ""},
		{"tagged", map[string]any{"type": "humanoid", "tags": []any{"goblinoid"}}, "humanoid", "goblinoid"},
		{"tag object", map[string]any{"type": "fiend", "tags": []any{map[string]any{"tag": "demon", "prefix": "x"}}}, "fiend", "demon"},
		{"choose", map[string]any{"type": map[string]any{"choose": []any{"beast", "monstrosity"}}}, "beast or monstrosity", ""},
	}
	for _, c := range cases {
		main, subtype := monsterTypeParts(c.value)
		if main != c.main || subtype != c.subtype {
			t.Errorf("%s: got (%q, %q), want (%q, %q)", c.name, main, subtype, c.main, c.subtype)
		}
	}
}

func TestSizeName(t *testing.T) {
	for code, want := range map[string]string{"T": "Tiny", "S": "Small", "M": "Medium", "L": "Large", "H": "Huge", "G": "Gargantuan", "Medium": "Medium"} {
		if got := sizeName(code); got != want {
			t.Errorf("sizeName(%q) = %q, want %q", code, got, want)
		}
	}
}

func TestSchoolName(t *testing.T) {
	for code, want := range map[string]string{"V": "Evocation", "C": "Conjuration", "a": "Abjuration", "Evocation": "Evocation"} {
		if got := schoolName(code); got != want {
			t.Errorf("schoolName(%q) = %q, want %q", code, got, want)
		}
	}
}

func TestCRXPMatchesTheDMGTable(t *testing.T) {
	cases := map[string]int{"0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "5": 1800, "10": 5900, "17": 18000, "20": 25000, "24": 62000, "30": 155000, "": 10}
	for cr, want := range cases {
		if got := crXP(cr); got != want {
			t.Errorf("crXP(%q) = %d, want %d", cr, got, want)
		}
	}
}

func TestMonsterHP(t *testing.T) {
	cases := []struct {
		name  string
		value any
		want  int
	}{
		{"average", map[string]any{"average": float64(27), "formula": "5d8+5"}, 27},
		{"numeric special (Dum-Dum Goblin)", map[string]any{"special": "7"}, 7},
		{"special with text", map[string]any{"special": "40 + 10 per spell level"}, 40},
		{"non-numeric special", map[string]any{"special": "equal to the summoner's level"}, 1},
		{"missing", nil, 1},
	}
	for _, c := range cases {
		if got := monsterHP(c.value); got != c.want {
			t.Errorf("%s: monsterHP = %d, want %d", c.name, got, c.want)
		}
	}
}
