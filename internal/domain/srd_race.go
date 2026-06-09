package domain

import "time"

// SRDRace represents a D&D 5e SRD playable race.
type SRDRace struct {
	ID             int64     `db:"id" json:"id"`
	Name           string    `db:"name" json:"name"`
	Speed          int       `db:"speed" json:"speed"`
	Size           string    `db:"size" json:"size"`
	AbilityBonuses string    `db:"ability_bonuses" json:"ability_bonuses"` // JSON: {"str": 2, "con": 1}
	Traits         string    `db:"traits" json:"traits"`                   // JSON array of {name, description}
	Languages      string    `db:"languages" json:"languages"`             // JSON array
	Subraces       string    `db:"subraces" json:"subraces"`               // JSON array
	Description    string    `db:"description" json:"description"`
	IsSRD          bool      `db:"is_srd" json:"is_srd"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}
