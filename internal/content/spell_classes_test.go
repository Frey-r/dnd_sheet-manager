package content

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// 5etools v2.x keeps spell class lists in spells/sources.json instead of inside each spell.
func TestLoadMergesSpellClassListsFromSources(t *testing.T) {
	root := t.TempDir()
	spells := filepath.Join(root, "spells")
	if err := os.MkdirAll(spells, 0o755); err != nil {
		t.Fatal(err)
	}
	write := func(name, body string) {
		if err := os.WriteFile(filepath.Join(spells, name), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("spells-xphb.json", `{"spell":[
		{"name":"Fireball","source":"XPHB","level":3},
		{"name":"Wish","source":"XPHB","level":9,"classes":{"fromClassList":[{"name":"Sorcerer","source":"XPHB"}]}}
	]}`)
	write("sources.json", `{"XPHB":{
		"Fireball":{"class":[{"name":"Sorcerer","source":"XPHB"},{"name":"Wizard","source":"XPHB"},{"name":"Wizard","source":"PHB"}],
		            "classVariant":[{"name":"Cleric","source":"XPHB","definedInSource":"XPHB"}]},
		"Wish":{"class":[{"name":"Wizard","source":"XPHB"}]}
	}}`)

	loaded, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]Entity{}
	for _, e := range loaded.Entities {
		byName[e.Name] = e
	}
	if got := classNames(byName["Fireball"].Data["classes"]); !reflect.DeepEqual(got, []string{"Sorcerer", "Wizard", "Cleric"}) {
		t.Fatalf("Fireball classes = %v, want [Sorcerer Wizard Cleric] (deduplicated, variants included)", got)
	}
	// An inline class list is authoritative and is not overwritten.
	if got := classNames(byName["Wish"].Data["classes"]); !reflect.DeepEqual(got, []string{"Sorcerer"}) {
		t.Fatalf("Wish classes = %v, want inline [Sorcerer]", got)
	}
}
