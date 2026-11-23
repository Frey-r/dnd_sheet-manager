package service

import (
	"encoding/json"
	"strings"
	"testing"
)

const validAppearance = `{"v":1,"body":0,"skin":"#c68642","eyes":"#3b6ea5","hair":3,"hairColor":"#2b1a10","outfit":5,"outfitColors":["#7a2e2e","#d9b26f"],"feature":1}`

func TestValidateAppearance(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		wantNil bool
		wantErr bool
	}{
		{name: "valid", raw: validAppearance},
		{name: "empty means none", raw: "", wantNil: true},
		{name: "null means none", raw: "null", wantNil: true},
		{name: "wrong version", raw: strings.Replace(validAppearance, `"v":1`, `"v":2`, 1), wantErr: true},
		{name: "body out of range", raw: strings.Replace(validAppearance, `"body":0`, `"body":2`, 1), wantErr: true},
		{name: "hair out of range", raw: strings.Replace(validAppearance, `"hair":3`, `"hair":12`, 1), wantErr: true},
		{name: "negative outfit", raw: strings.Replace(validAppearance, `"outfit":5`, `"outfit":-1`, 1), wantErr: true},
		{name: "outfit out of range", raw: strings.Replace(validAppearance, `"outfit":5`, `"outfit":10`, 1), wantErr: true},
		{name: "last hair style (chibi set)", raw: strings.Replace(validAppearance, `"hair":3`, `"hair":11`, 1)},
		{name: "last outfit (chibi set)", raw: strings.Replace(validAppearance, `"outfit":5`, `"outfit":9`, 1)},
		{name: "pre-redesign ids stay valid", raw: strings.Replace(strings.Replace(validAppearance, `"hair":3`, `"hair":8`, 1), `"outfit":5`, `"outfit":7`, 1)},
		{name: "feature out of range", raw: strings.Replace(validAppearance, `"feature":1`, `"feature":4`, 1), wantErr: true},
		{name: "bad colour", raw: strings.Replace(validAppearance, `#c68642`, `red`, 1), wantErr: true},
		{name: "short colour", raw: strings.Replace(validAppearance, `#3b6ea5`, `#3b6`, 1), wantErr: true},
		{name: "unknown key", raw: strings.Replace(validAppearance, `"feature":1`, `"feature":1,"x":1`, 1), wantErr: true},
		{name: "not an object", raw: `[1,2]`, wantErr: true},
		{name: "trailing data", raw: validAppearance + `{}`, wantErr: true},
		{name: "too large", raw: `{"v":1,"skin":"` + strings.Repeat("a", 1100) + `"}`, wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ValidateAppearance([]byte(tc.raw))
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %s", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.wantNil {
				if got != nil {
					t.Fatalf("expected nil, got %s", got)
				}
				return
			}
			var normalised, original map[string]any
			if err := json.Unmarshal(got, &normalised); err != nil {
				t.Fatalf("normalised output is not JSON: %v", err)
			}
			_ = json.Unmarshal([]byte(tc.raw), &original)
			if len(normalised) != len(original) {
				t.Fatalf("normalised appearance lost fields: %s", got)
			}
		})
	}
}
