package content

import (
	"reflect"
	"strings"
	"testing"
)

func TestClassProjectionHelpers(t *testing.T) {
	fighter := decode(t, `{
		"primaryAbility": [{"str": true}, {"dex": true}],
		"startingProficiencies": {
			"armor": ["light", "medium", "heavy", "shield"],
			"weapons": ["simple", "martial"],
			"skills": [{"choose": {"from": ["acrobatics", "athletics", "perception"], "count": 2}}]
		},
		"startingEquipment": {
			"defaultData": [{"A": [{"item": "chain mail|xphb"}]}],
			"entries": ["{@i Choose A, B, or C:} (A) {@item Chain Mail|XPHB}; or (B) 155 GP"]
		}
	}`)
	if got := primaryAbilities(fighter["primaryAbility"]); !reflect.DeepEqual(got, []string{"str", "dex"}) {
		t.Errorf("primaryAbilities = %v, want [str dex]", got)
	}
	if got := proficiencyList(fighter, "armor"); len(got) != 4 {
		t.Errorf("armor = %v, want 4 entries", got)
	}
	if got := proficiencyList(fighter, "tools"); got == nil || len(got) != 0 {
		t.Errorf("tools = %v, want empty non-nil list", got)
	}
	skills := skillChoices(fighter)
	if skills["count"] != 2 || len(skills["options"].([]any)) != 3 {
		t.Errorf("skillChoices = %v, want count 2 with 3 options", skills)
	}
	equipment := startingEquipmentText(fighter["startingEquipment"])
	if !strings.Contains(equipment, "Choose A, B, or C") || strings.Contains(equipment, "chain mail|xphb") {
		t.Errorf("startingEquipmentText = %q: want the readable entries, not defaultData", equipment)
	}

	wizard2014 := decode(t, `{"startingEquipment": {"default": ["(a) a {@item quarterstaff|phb}", "A {@item spellbook|phb}"], "goldAlternative": "{@dice 4d4 × 10}"}}`)
	if got := startingEquipmentText(wizard2014["startingEquipment"]); strings.Count(got, "\n") != 1 {
		t.Errorf("2014 default equipment = %q, want two lines", got)
	}
}
