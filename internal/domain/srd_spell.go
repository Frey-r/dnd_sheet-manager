package domain

import "time"

// SRDSpell represents a D&D 5e SRD spell entry.
type SRDSpell struct {
	ID            int64     `db:"id" json:"id"`
	Name          string    `db:"name" json:"name"`
	Level         int       `db:"level" json:"level"`
	School        string    `db:"school" json:"school"`
	CastingTime   string    `db:"casting_time" json:"casting_time"`
	Range         string    `db:"range" json:"range"`
	Duration      string    `db:"duration" json:"duration"`
	Concentration bool      `db:"concentration" json:"concentration"`
	Ritual        bool      `db:"ritual" json:"ritual"`
	ComponentsV   bool      `db:"components_v" json:"components_v"`
	ComponentsS   bool      `db:"components_s" json:"components_s"`
	ComponentsM   bool      `db:"components_m" json:"components_m"`
	MaterialDesc  string    `db:"material_desc" json:"material_desc"`
	Description   string    `db:"description" json:"description"`
	HigherLevels  string    `db:"higher_levels" json:"higher_levels"`
	Classes       string    `db:"classes" json:"classes"` // JSON array of class names
	DamageType    string    `db:"damage_type" json:"damage_type"`
	AreaType      string    `db:"area_type" json:"area_type"`
	IsSRD         bool      `db:"is_srd" json:"is_srd"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// SpellFilters holds search/filter parameters for SRD spell queries.
type SpellFilters struct {
	Query         string `form:"query"`
	Level         *int   `form:"level"`
	School        string `form:"school"`
	ClassName     string `form:"class"`
	Concentration *bool  `form:"concentration"`
	Ritual        *bool  `form:"ritual"`
	DamageType    string `form:"damage_type"`
	IsSRD         *bool  `form:"is_srd"`
	Limit         int    `form:"limit"`
	Offset        int    `form:"offset"`
}

// SpellListItem is a lightweight spell summary for list views.
type SpellListItem struct {
	ID            int64  `db:"id" json:"id"`
	Name          string `db:"name" json:"name"`
	Level         int    `db:"level" json:"level"`
	School        string `db:"school" json:"school"`
	CastingTime   string `db:"casting_time" json:"casting_time"`
	Concentration bool   `db:"concentration" json:"concentration"`
	Ritual        bool   `db:"ritual" json:"ritual"`
	IsSRD         bool   `db:"is_srd" json:"is_srd"`
}
