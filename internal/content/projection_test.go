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
