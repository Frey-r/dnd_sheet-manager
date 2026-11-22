package service

import (
	"encoding/json"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func TestCatalogValueCP(t *testing.T) {
	cases := []struct {
		name string
		data string
		want *int64
	}{
		{"longsword 15 gp", `{"value": 1500}`, ptr64(1500)},
		{"fractional rounds", `{"value": 2.6}`, ptr64(3)},
		{"no value", `{"rarity": "rare"}`, nil},
		{"zero value", `{"value": 0}`, nil},
		{"negative value", `{"value": -5}`, nil},
		{"non numeric value", `{"value": "priceless"}`, nil},
		{"empty data", ``, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CatalogValueCP(json.RawMessage(tc.data))
			switch {
			case tc.want == nil && got != nil:
				t.Fatalf("want nil, got %d", *got)
			case tc.want != nil && (got == nil || *got != *tc.want):
				t.Fatalf("want %d, got %v", *tc.want, got)
			}
		})
	}
}

func ptr64(v int64) *int64 { return &v }

func TestApplyCharacterUpdatesClampsHP(t *testing.T) {
	cases := []struct {
		name              string
		cur, temp, max    int
		wantCur, wantTemp int
	}{
		{"over max", 30, 0, 20, 20, 0},
		{"negative current", -4, 0, 20, 0, 0},
		{"negative temp", 10, -3, 20, 10, 0},
		{"in range", 12, 5, 20, 12, 5},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := &domain.Character{MaxHP: 20, CurrentHP: 20}
			applyCharacterUpdates(c, &domain.UpdateCharacterRequest{CurrentHP: &tc.cur, TempHP: &tc.temp, MaxHP: &tc.max})
			if c.CurrentHP != tc.wantCur || c.TempHP != tc.wantTemp {
				t.Fatalf("got hp=%d temp=%d, want %d/%d", c.CurrentHP, c.TempHP, tc.wantCur, tc.wantTemp)
			}
		})
	}
}
