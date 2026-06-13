package domain

import "time"

// SRDMonster represents a D&D 5e SRD monster entry.
type SRDMonster struct {
	ID                  int64     `db:"id" json:"id"`
	Name                string    `db:"name" json:"name"`
	Size                string    `db:"size" json:"size"`
	Type                string    `db:"type" json:"type"`
	Subtype             string    `db:"subtype" json:"subtype"`
	Alignment           string    `db:"alignment" json:"alignment"`
	AC                  int       `db:"ac" json:"ac"`
	ACType              string    `db:"ac_type" json:"ac_type"`
	HP                  int       `db:"hp" json:"hp"`
	HitDice             string    `db:"hit_dice" json:"hit_dice"`
	Speed               string    `db:"speed" json:"speed"` // JSON
	STR                 int       `db:"str" json:"str"`
	DEX                 int       `db:"dex" json:"dex"`
	CON                 int       `db:"con" json:"con"`
	INT                 int       `db:"int" json:"int"`
	WIS                 int       `db:"wis" json:"wis"`
	CHA                 int       `db:"cha" json:"cha"`
	CR                  string    `db:"cr" json:"cr"`
	XP                  int       `db:"xp" json:"xp"`
	Senses              string    `db:"senses" json:"senses"`
	Languages           string    `db:"languages" json:"languages"`
	Traits              string    `db:"traits" json:"traits"`                       // JSON array
	Actions             string    `db:"actions" json:"actions"`                     // JSON array
	LegendaryActions    string    `db:"legendary_actions" json:"legendary_actions"` // JSON array
	Reactions           string    `db:"reactions" json:"reactions"`                 // JSON array
	Resistances         string    `db:"resistances" json:"resistances"`
	Immunities          string    `db:"immunities" json:"immunities"`
	Vulnerabilities     string    `db:"vulnerabilities" json:"vulnerabilities"`
	ConditionImmunities string    `db:"condition_immunities" json:"condition_immunities"`
	SavingThrows        string    `db:"saving_throws" json:"saving_throws"` // JSON
	Skills              string    `db:"skills" json:"skills"`               // JSON
	ProficiencyBonus    int       `db:"proficiency_bonus" json:"proficiency_bonus"`
	IsSRD               bool      `db:"is_srd" json:"is_srd"`
	FoundryUUID         *string   `db:"foundry_uuid" json:"foundry_uuid,omitempty"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
}

// AbilityModifier returns the modifier for a given ability score: floor((score - 10) / 2).
func AbilityModifier(score int) int {
	return (score - 10) / 2
}

// MonsterFilters holds search/filter parameters for SRD monster queries.
type MonsterFilters struct {
	Query  string  `form:"query"`
	CR     string  `form:"cr"`
	CRMin  float64 `form:"cr_min"`
	CRMax  float64 `form:"cr_max"`
	Type   string  `form:"type"`
	Size   string  `form:"size"`
	IsSRD  *bool   `form:"is_srd"`
	Limit  int     `form:"limit"`
	Offset int     `form:"offset"`
}

// MonsterListItem is a lightweight monster summary for list views.
type MonsterListItem struct {
	ID    int64  `db:"id" json:"id"`
	Name  string `db:"name" json:"name"`
	Size  string `db:"size" json:"size"`
	Type  string `db:"type" json:"type"`
	CR    string `db:"cr" json:"cr"`
	XP    int    `db:"xp" json:"xp"`
	HP    int    `db:"hp" json:"hp"`
	AC    int    `db:"ac" json:"ac"`
	IsSRD bool   `db:"is_srd" json:"is_srd"`
}
