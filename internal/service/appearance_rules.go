package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"regexp"

	"dnd-campaign-manager/internal/domain"
)

// Avatar rules (openspec/specs/character-appearance.md).

var ErrInvalidAppearance = errors.New("apariencia inválida")

const (
	maxAppearanceBytes = 1024
	maxHairStyle       = 11 // 0 = bald, 1–11 styles; 0–8 predate the chibi redesign and keep their meaning
	maxOutfit          = 9  // 0–9 outfits; 0–7 predate the chibi redesign and keep their meaning
	maxFeature         = 3
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// ValidateAppearance checks an appearance payload and returns it normalised. Empty or null
// input means "no appearance" and yields nil.
func ValidateAppearance(raw []byte) (domain.RawJSON, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || string(trimmed) == "null" {
		return nil, nil
	}
	if len(trimmed) > maxAppearanceBytes {
		return nil, ErrInvalidAppearance
	}
	dec := json.NewDecoder(bytes.NewReader(trimmed))
	dec.DisallowUnknownFields()
	var a domain.Appearance
	if err := dec.Decode(&a); err != nil || dec.More() {
		return nil, ErrInvalidAppearance
	}
	if a.V != 1 || a.Body < 0 || a.Body > 1 ||
		a.Hair < 0 || a.Hair > maxHairStyle ||
		a.Outfit < 0 || a.Outfit > maxOutfit ||
		a.Feature < 0 || a.Feature > maxFeature {
		return nil, ErrInvalidAppearance
	}
	for _, c := range []string{a.Skin, a.Eyes, a.HairColor, a.OutfitColors[0], a.OutfitColors[1]} {
		if !hexColor.MatchString(c) {
			return nil, ErrInvalidAppearance
		}
	}
	out, err := json.Marshal(a)
	if err != nil {
		return nil, ErrInvalidAppearance
	}
	return out, nil
}
