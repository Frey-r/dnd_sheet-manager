package foundry

import (
	"encoding/json"
	"reflect"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func TestBuildClassDocExportsSavingThrows(t *testing.T) {
	doc := BuildClassDoc(domain.SRDClass{Name: "Fighter", HitDie: 10, SavingThrows: `["Strength","Constitution"]`, IsSRD: true})
	system := doc.Body["system"].(map[string]interface{})
	if got := system["saves"]; !reflect.DeepEqual(got, []string{"str", "con"}) {
		t.Fatalf("saves = %#v", got)
	}
	if adv := system["advancement"].([]interface{}); len(adv) != 0 {
		t.Fatal("classes must stay descriptive, without advancement")
	}
	empty := BuildClassDoc(domain.SRDClass{Name: "Raro", SavingThrows: "not json"}).Body["system"].(map[string]interface{})
	if got := empty["saves"]; !reflect.DeepEqual(got, []string{}) {
		t.Fatalf("invalid saves should export as empty list, got %#v", got)
	}
}

func TestIsSRDDocumentReadsHomebrewOrigin(t *testing.T) {
	cases := map[string]bool{
		`{"source":{"custom":"Homebrew"}}`:  false,
		`{"source":{"custom":"homebrew "}}`: false,
		`{"source":{"custom":"SRD 5.1"}}`:   true,
		`{"source":{"book":"PHB"}}`:         true,
		`{}`:                                true,
	}
	for system, want := range cases {
		if got := IsSRDDocument(&Document{System: json.RawMessage(system)}); got != want {
			t.Errorf("IsSRDDocument(%s) = %v, want %v", system, got, want)
		}
	}
	// Round trip: what the export marks as homebrew is imported as homebrew.
	exported := BuildClassDoc(domain.SRDClass{Name: "Caballero rúnico", IsSRD: false})
	raw, _ := json.Marshal(exported.Body["system"])
	if IsSRDDocument(&Document{System: raw}) {
		t.Fatal("exported homebrew must import with is_srd=false")
	}
}
