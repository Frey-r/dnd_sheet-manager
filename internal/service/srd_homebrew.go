package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// ErrHomebrewNotFound is returned when the monster does not exist or is an immutable SRD entry.
var ErrHomebrewNotFound = errors.New("homebrew monster not found")

// ValidationError marks a user-input error (maps to HTTP 400).
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

func invalid(format string, a ...any) error { return &ValidationError{Msg: fmt.Sprintf(format, a...)} }

var (
	validSizes = map[string]string{"tiny": "Tiny", "small": "Small", "medium": "Medium", "large": "Large", "huge": "Huge", "gargantuan": "Gargantuan"}
	validTypes = map[string]bool{"aberration": true, "beast": true, "celestial": true, "construct": true, "dragon": true,
		"elemental": true, "fey": true, "fiend": true, "giant": true, "humanoid": true, "monstrosity": true,
		"ooze": true, "plant": true, "undead": true}
)

// ProficiencyBonusForCR derives the proficiency bonus from a CR string (SRD table).
func ProficiencyBonusForCR(cr string) int {
	n := CRToNumeric(cr)
	switch {
	case n < 5:
		return 2
	case n < 9:
		return 3
	case n < 13:
		return 4
	case n < 17:
		return 5
	case n < 21:
		return 6
	case n < 25:
		return 7
	case n < 29:
		return 8
	}
	return 9
}

// HomebrewMonsterRequest is the payload to create/update a homebrew monster.
type HomebrewMonsterRequest struct {
	Name                string          `json:"name"`
	Size                string          `json:"size"`
	Type                string          `json:"type"`
	Subtype             string          `json:"subtype"`
	Alignment           string          `json:"alignment"`
	AC                  int             `json:"ac"`
	ACType              string          `json:"ac_type"`
	HP                  int             `json:"hp"`
	HitDice             string          `json:"hit_dice"`
	Speed               json.RawMessage `json:"speed"`
	STR                 int             `json:"str"`
	DEX                 int             `json:"dex"`
	CON                 int             `json:"con"`
	INT                 int             `json:"int"`
	WIS                 int             `json:"wis"`
	CHA                 int             `json:"cha"`
	CR                  string          `json:"cr"`
	Senses              string          `json:"senses"`
	Languages           string          `json:"languages"`
	Traits              json.RawMessage `json:"traits"`
	Actions             json.RawMessage `json:"actions"`
	LegendaryActions    json.RawMessage `json:"legendary_actions"`
	Reactions           json.RawMessage `json:"reactions"`
	Resistances         string          `json:"resistances"`
	Immunities          string          `json:"immunities"`
	Vulnerabilities     string          `json:"vulnerabilities"`
	ConditionImmunities string          `json:"condition_immunities"`
	SavingThrows        json.RawMessage `json:"saving_throws"`
	Skills              json.RawMessage `json:"skills"`
}

// jsonColumn validates raw JSON of the expected kind ('{' object or '[' array); empty means the default.
func jsonColumn(field string, raw json.RawMessage, object bool) (string, error) {
	def := "[]"
	if object {
		def = "{}"
	}
	t := strings.TrimSpace(string(raw))
	if t == "" || t == "null" {
		return def, nil
	}
	if object {
		var v map[string]any
		if err := json.Unmarshal(raw, &v); err != nil {
			return "", invalid("%s must be a JSON object", field)
		}
	} else {
		var v []any
		if err := json.Unmarshal(raw, &v); err != nil {
			return "", invalid("%s must be a JSON array", field)
		}
	}
	return t, nil
}

// ToMonster validates the request and builds the monster to persist (is_srd is always FALSE).
func (r HomebrewMonsterRequest) ToMonster() (*domain.SRDMonster, error) {
	name := strings.TrimSpace(r.Name)
	if name == "" || len(name) > 120 {
		return nil, invalid("name is required (max 120 characters)")
	}
	size, ok := validSizes[strings.ToLower(strings.TrimSpace(r.Size))]
	if !ok {
		return nil, invalid("size must be one of: Tiny, Small, Medium, Large, Huge, Gargantuan")
	}
	typ := strings.ToLower(strings.TrimSpace(r.Type))
	if !validTypes[typ] {
		return nil, invalid("type must be a valid SRD creature type (e.g. beast, undead, dragon)")
	}
	cr := strings.TrimSpace(r.CR)
	xp, ok := CRToXP[cr]
	if !ok {
		return nil, invalid("cr must be one of 0, 1/8, 1/4, 1/2, 1-30")
	}
	if r.HP < 1 {
		return nil, invalid("hp must be >= 1")
	}
	if r.AC < 0 || r.AC > 40 {
		return nil, invalid("ac must be between 0 and 40")
	}
	for label, v := range map[string]int{"str": r.STR, "dex": r.DEX, "con": r.CON, "int": r.INT, "wis": r.WIS, "cha": r.CHA} {
		if v < 1 || v > 30 {
			return nil, invalid("%s must be an integer between 1 and 30", label)
		}
	}
	speed, err := jsonColumn("speed", r.Speed, true)
	if err != nil {
		return nil, err
	}
	saves, err := jsonColumn("saving_throws", r.SavingThrows, true)
	if err != nil {
		return nil, err
	}
	skills, err := jsonColumn("skills", r.Skills, true)
	if err != nil {
		return nil, err
	}
	traits, err := jsonColumn("traits", r.Traits, false)
	if err != nil {
		return nil, err
	}
	actions, err := jsonColumn("actions", r.Actions, false)
	if err != nil {
		return nil, err
	}
	legendary, err := jsonColumn("legendary_actions", r.LegendaryActions, false)
	if err != nil {
		return nil, err
	}
	reactions, err := jsonColumn("reactions", r.Reactions, false)
	if err != nil {
		return nil, err
	}
	hitDice := strings.TrimSpace(r.HitDice)
	if hitDice == "" {
		hitDice = "1d8"
	}
	return &domain.SRDMonster{
		Name: name, Size: size, Type: typ, Subtype: r.Subtype, Alignment: r.Alignment,
		AC: r.AC, ACType: r.ACType, HP: r.HP, HitDice: hitDice, Speed: speed,
		STR: r.STR, DEX: r.DEX, CON: r.CON, INT: r.INT, WIS: r.WIS, CHA: r.CHA,
		CR: cr, XP: xp, Senses: r.Senses, Languages: r.Languages,
		Traits: traits, Actions: actions, LegendaryActions: legendary, Reactions: reactions,
		Resistances: r.Resistances, Immunities: r.Immunities, Vulnerabilities: r.Vulnerabilities,
		ConditionImmunities: r.ConditionImmunities, SavingThrows: saves, Skills: skills,
		ProficiencyBonus: ProficiencyBonusForCR(cr), IsSRD: false,
	}, nil
}

// CreateHomebrewMonster validates and stores a homebrew monster, returning the stored detail.
func (s *SRDService) CreateHomebrewMonster(req HomebrewMonsterRequest, ownerID int64) (*MonsterDetail, error) {
	m, err := req.ToMonster()
	if err != nil {
		return nil, err
	}
	id, err := s.repo.CreateHomebrewMonster(m, ownerID)
	if err != nil {
		return nil, err
	}
	return s.GetMonster(id)
}

// UpdateHomebrewMonster validates and updates the caller's homebrew monster (never an SRD entry).
func (s *SRDService) UpdateHomebrewMonster(id int64, req HomebrewMonsterRequest, ownerID int64, asAdmin bool) (*MonsterDetail, error) {
	m, err := req.ToMonster()
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateHomebrewMonster(id, m, ownerID, asAdmin); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrHomebrewNotFound
		}
		return nil, err
	}
	return s.GetMonster(id)
}

// DeleteHomebrewMonster deletes the caller's homebrew monster (never an SRD entry).
func (s *SRDService) DeleteHomebrewMonster(id, ownerID int64, asAdmin bool) error {
	if err := s.repo.DeleteHomebrewMonster(id, ownerID, asAdmin); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrHomebrewNotFound
		}
		return err
	}
	return nil
}
