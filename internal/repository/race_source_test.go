package repository

import "testing"

func TestSplitRaceSource(t *testing.T) {
	cases := map[string][2]string{
		"Elf (PHB)":           {"Elf", "PHB"},
		"Elf":                 {"Elf", ""},
		"Aarakocra (EGTW)":    {"Aarakocra", "EGTW"},
		"  Dwarf (XPHB) ":     {"Dwarf", "XPHB"},
		"Genasi (Air) (EEPC)": {"Genasi (Air)", "EEPC"},
	}
	for in, want := range cases {
		name, source := splitRaceSource(in)
		if name != want[0] || source != want[1] {
			t.Errorf("splitRaceSource(%q) = (%q, %q), want (%q, %q)", in, name, source, want[0], want[1])
		}
	}
}
