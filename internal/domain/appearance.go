package domain

import (
	"database/sql/driver"
	"errors"
)

// RawJSON is a nullable JSONB column passed through verbatim (NULL ↔ JSON null).
type RawJSON []byte

func (j RawJSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return string(j), nil
}

func (j *RawJSON) Scan(src any) error {
	switch v := src.(type) {
	case nil:
		*j = nil
	case []byte:
		*j = append(RawJSON(nil), v...)
	case string:
		*j = RawJSON(v)
	default:
		return errors.New("unsupported JSON column type")
	}
	return nil
}

func (j RawJSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *RawJSON) UnmarshalJSON(b []byte) error {
	if string(b) == "null" {
		*j = nil
		return nil
	}
	*j = append(RawJSON(nil), b...)
	return nil
}

// Appearance is the pixel-art avatar of a character (openspec/specs/character-appearance.md).
// The visual family comes from the race and the aura from the class, so neither is stored.
type Appearance struct {
	V            int       `json:"v"`
	Body         int       `json:"body"`
	Skin         string    `json:"skin"`
	Eyes         string    `json:"eyes"`
	Hair         int       `json:"hair"`
	HairColor    string    `json:"hairColor"`
	Outfit       int       `json:"outfit"`
	OutfitColors [2]string `json:"outfitColors"`
	Feature      int       `json:"feature"`
}
