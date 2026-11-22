package domain

import (
	"strings"
	"testing"
)

func TestEncodePhysicalDescriptionRoundTrip(t *testing.T) {
	raw := EncodePhysicalDescription(PhysicalDescription{Age: " 120 ", Height: "1,80 m", Eyes: strings.Repeat("a", 80)})
	pd, err := ParsePhysicalDescription(raw)
	if err != nil {
		t.Fatal(err)
	}
	if pd.Age != "120" || pd.Height != "1,80 m" || len([]rune(pd.Eyes)) != 60 || pd.Hair != "" {
		t.Fatalf("unexpected round trip: %+v", pd)
	}
}
