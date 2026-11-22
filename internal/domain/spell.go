package domain

import "time"

type Spell struct {
	ID          int64     `db:"id" json:"id"`
	CharacterID int64     `db:"character_id" json:"character_id"`
	Name        string    `db:"name" json:"name"`
	Level       int       `db:"level" json:"level"`
	School      string    `db:"school" json:"school"`
	CastingTime string    `db:"casting_time" json:"casting_time"`
	Range       string    `db:"range" json:"range"`
	Duration    string    `db:"duration" json:"duration"`
	Description string    `db:"description" json:"description"`
	Components  string    `db:"components" json:"components"` // JSON array
	DamageType  string    `db:"damage_type" json:"damage_type"`
	Prepared    bool      `db:"prepared" json:"prepared"`
	SRDRefID    *int64    `db:"srd_ref_id" json:"srd_ref_id,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type CreateSpellRequest struct {
	Name        string `json:"name" binding:"required"`
	Level       int    `json:"level" binding:"required,min=0,max=9"`
	School      string `json:"school" binding:"required"`
	CastingTime string `json:"casting_time" binding:"required"`
	Range       string `json:"range" binding:"required"`
	Duration    string `json:"duration" binding:"required"`
	Description string `json:"description"`
	Components  string `json:"components"`
	DamageType  string `json:"damage_type"`
	SRDRefID    *int64 `json:"srd_ref_id"`
	// Prepared was sent by the client but dropped: spells were always stored unprepared.
	Prepared *bool `json:"prepared"`
}

type UpdateSpellRequest struct {
	Name     *string `json:"name"`
	Prepared *bool   `json:"prepared"`
	Level    *int    `json:"level"`
	School   *string `json:"school"`
}
