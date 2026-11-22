package service

import (
	"encoding/json"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// parseJSONField parses a JSON text column into a structured value; it returns nil on empty or invalid input.
func parseJSONField(raw string) any {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var v any
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return nil
	}
	return v
}

// MonsterDetail is a monster whose JSONB columns are returned as structured JSON (null on parse failure).
// Fields declared here shadow the same-named JSON keys of the embedded struct.
type MonsterDetail struct {
	domain.SRDMonster
	Speed            any `json:"speed"`
	Traits           any `json:"traits"`
	Actions          any `json:"actions"`
	LegendaryActions any `json:"legendary_actions"`
	Reactions        any `json:"reactions"`
	SavingThrows     any `json:"saving_throws"`
	Skills           any `json:"skills"`
}

// NewMonsterDetail converts a stored monster to its structured representation.
func NewMonsterDetail(m *domain.SRDMonster) *MonsterDetail {
	return &MonsterDetail{
		SRDMonster:       *m,
		Speed:            parseJSONField(m.Speed),
		Traits:           parseJSONField(m.Traits),
		Actions:          parseJSONField(m.Actions),
		LegendaryActions: parseJSONField(m.LegendaryActions),
		Reactions:        parseJSONField(m.Reactions),
		SavingThrows:     parseJSONField(m.SavingThrows),
		Skills:           parseJSONField(m.Skills),
	}
}

// SpellDetail is a spell whose classes JSON array is returned as structured JSON (null on parse failure).
type SpellDetail struct {
	domain.SRDSpell
	Classes any `json:"classes"`
}

// NewSpellDetail converts a stored spell to its structured representation.
func NewSpellDetail(s *domain.SRDSpell) *SpellDetail {
	return &SpellDetail{SRDSpell: *s, Classes: parseJSONField(s.Classes)}
}
