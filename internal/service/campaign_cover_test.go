package service

import "testing"

func TestValidCoverURL(t *testing.T) {
	for raw, want := range map[string]bool{
		"":                              true,
		"/uploads/1/portada.png":        true,
		"https://example.org/cover.jpg": true,
		" HTTP://lan.local/x.png ":      true,
		"javascript:alert(1)":           false,
		"data:image/png;base64,AAAA":    false,
		"//evil.example/x.png":          false,
	} {
		if got := ValidCoverURL(raw); got != want {
			t.Errorf("ValidCoverURL(%q) = %v, want %v", raw, got, want)
		}
	}
}
