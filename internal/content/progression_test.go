package content

import (
	"encoding/json"
	"testing"
)

func decode(t *testing.T, raw string) map[string]any {
	t.Helper()
	var data map[string]any
	if err := json.Unmarshal([]byte(raw), &data); err != nil {
		t.Fatal(err)
	}
	return data
}

func TestClassProgressionFullCaster(t *testing.T) {
	// Shape of 5etools class-wizard.json (XPHB): cantrips + prepared arrays and rowsSpellProgression.
	data := decode(t, `{
		"cantripProgression": [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
		"preparedSpellsProgression": [4,5,6,7,9,10,11,12,14,15,16,16,17,18,19,21,22,23,24,25],
		"classTableGroups": [
			{"colLabels": ["{@filter Cantrips|spells}"], "rows": [[3]]},
			{"title": "Spell Slots per Spell Level", "rowsSpellProgression": [
				[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0]
			]}
		]}`)
	levels := ClassProgression(data)
	if len(levels) != 20 {
		t.Fatalf("got %d levels, want 20", len(levels))
	}
	l5 := levels[4]
	if l5.Level != 5 || l5.CantripsKnown != 4 || l5.SpellsKnown != 9 || l5.Slots != [9]int{4, 3, 2} {
		t.Fatalf("level 5 = %+v", l5)
	}
	if levels[19].CantripsKnown != 5 || levels[19].SpellsKnown != 25 {
		t.Fatalf("level 20 = %+v", levels[19])
	}
}

func TestClassProgressionPactMagic(t *testing.T) {
	// class-warlock.json (PHB): pact slots live in "Spell Slots" / "Slot Level" columns,
	// and the slot level is a 5etools filter tag.
	data := decode(t, `{
		"cantripProgression": [2,2,2,3,3],
		"spellsKnownProgression": [2,3,4,5,6],
		"classTableGroups": [{"colLabels": ["{@filter Cantrips Known|spells}", "{@filter Spells Known|spells}", "Spell Slots", "Slot Level", "Invocations"],
			"rows": [[2,2,1,"{@filter 1st|spells|level=1}",0],[2,3,2,"{@filter 1st|spells|level=1}",2],[2,4,2,"{@filter 2nd|spells|level=2}",2],[3,5,2,"2nd",2],[3,6,2,"{@filter 3rd|spells|level=3|class=Warlock}",3]]}]}`)
	levels := ClassProgression(data)
	if levels == nil {
		t.Fatal("warlock should have a progression")
	}
	if levels[0].Slots != [9]int{1} {
		t.Fatalf("level 1 slots = %v, want one 1st-level slot", levels[0].Slots)
	}
	if levels[4].Slots != [9]int{0, 0, 2} || levels[4].SpellsKnown != 6 || levels[4].CantripsKnown != 3 {
		t.Fatalf("level 5 = %+v, want two 3rd-level pact slots", levels[4])
	}
}

func TestClassProgressionNonCaster(t *testing.T) {
	data := decode(t, `{"classTableGroups": [{"colLabels": ["Second Wind", "Weapon Mastery"], "rows": [["2","3"]]}]}`)
	if levels := ClassProgression(data); levels != nil {
		t.Fatalf("fighter should have no spell progression, got %d levels", len(levels))
	}
}
