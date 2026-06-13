package domain

import "time"

// SRDSubclass represents a D&D 5e subclass (e.g. "Path of the Berserker").
type SRDSubclass struct {
	ID          int64     `db:"id" json:"id"`
	ClassName   string    `db:"class_name" json:"class_name"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	FoundryUUID *string   `db:"foundry_uuid" json:"foundry_uuid,omitempty"`
	IsSRD       bool      `db:"is_srd" json:"is_srd"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}
