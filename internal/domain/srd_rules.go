package domain

import "time"

// SRDCondition represents a D&D 5e SRD condition (e.g., Blinded, Charmed).
type SRDCondition struct {
	ID          int64     `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Effects     string    `db:"effects" json:"effects"` // JSON array
	IsSRD       bool      `db:"is_srd" json:"is_srd"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// SRDRule represents a D&D 5e SRD rule section.
type SRDRule struct {
	ID           int64     `db:"id" json:"id"`
	Name         string    `db:"name" json:"name"`
	Category     string    `db:"category" json:"category"`
	Content      string    `db:"content" json:"content"`
	ParentRuleID *int64    `db:"parent_rule_id" json:"parent_rule_id"`
	IsSRD        bool      `db:"is_srd" json:"is_srd"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// RulesFilters holds search parameters for SRD rules.
type RulesFilters struct {
	Query    string `form:"query"`
	Category string `form:"category"`
	Limit    int    `form:"limit"`
	Offset   int    `form:"offset"`
}

// PaginatedResult wraps any list result with pagination metadata.
type PaginatedResult[T any] struct {
	Data   []T `json:"data"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}
