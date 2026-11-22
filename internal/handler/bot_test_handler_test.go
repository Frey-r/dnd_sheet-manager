package handler

import (
	"strings"
	"testing"
)

func TestValidateBotMessage(t *testing.T) {
	cases := []struct {
		name string
		in   string
		ok   bool
	}{
		{"empty", "   ", false},
		{"ok", " hola ", true},
		{"limit", strings.Repeat("ñ", 500), true},
		{"too long", strings.Repeat("a", 501), false},
	}
	for _, tc := range cases {
		got, err := validateBotMessage(tc.in)
		if (err == nil) != tc.ok {
			t.Errorf("%s: err=%v want ok=%v", tc.name, err, tc.ok)
		}
		if tc.name == "ok" && got != "hola" {
			t.Errorf("message not trimmed: %q", got)
		}
	}
}

func TestEnabledBotModules(t *testing.T) {
	got := enabledBotModules(map[string]any{"pacing": true, "loot_split": false, "bogus": true, "turn_timer": true})
	if len(got) != 2 || got[0] != botModuleLabels["pacing"] && got[1] != botModuleLabels["pacing"] {
		t.Errorf("unexpected modules: %v", got)
	}
	if n := len(enabledBotModules([]byte(`{"pacing":true}`))); n != 1 {
		t.Errorf("raw JSON: got %d", n)
	}
	if n := len(enabledBotModules(nil)); n != 0 {
		t.Errorf("nil: got %d", n)
	}
}

func TestBuildBotPrompt(t *testing.T) {
	p := buildBotPrompt("Eres un gnomo", []string{"pacing"}, "hola")
	for _, want := range []string{"Eres un gnomo", "pacing", "hola"} {
		if !strings.Contains(p, want) {
			t.Errorf("prompt missing %q", want)
		}
	}
}

func TestValidateEventRelations(t *testing.T) {
	many := make([]any, 51)
	for i := range many {
		many[i] = "x"
	}
	exactly := many[:50]
	cases := []struct {
		name  string
		input map[string]any
		ok    bool
	}{
		{"absent", map[string]any{}, true},
		{"valid", map[string]any{"related_npcs": []any{"Mira"}, "related_locations": []any{"Puerto"}}, true},
		{"null", map[string]any{"related_npcs": nil}, true},
		{"50 entries", map[string]any{"related_npcs": exactly}, true},
		{"51 entries", map[string]any{"related_locations": many}, false},
		{"not array", map[string]any{"related_npcs": "Mira"}, false},
		{"non-string item", map[string]any{"related_npcs": []any{1}}, false},
		{"200 chars", map[string]any{"related_npcs": []any{strings.Repeat("é", 200)}}, true},
		{"201 chars", map[string]any{"related_npcs": []any{strings.Repeat("a", 201)}}, false},
	}
	for _, tc := range cases {
		if err := validateEventRelations(tc.input); (err == nil) != tc.ok {
			t.Errorf("%s: err=%v want ok=%v", tc.name, err, tc.ok)
		}
	}
	in := map[string]any{"related_npcs": nil}
	_ = validateEventRelations(in)
	if l, ok := in["related_npcs"].([]any); !ok || len(l) != 0 {
		t.Errorf("null not normalised: %v", in["related_npcs"])
	}
}
