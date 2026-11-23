package domain

import (
	"encoding/json"
	"time"
)

type ContentEntity struct {
	ID         int64           `json:"id"`
	Type       string          `json:"type"`
	Name       string          `json:"name"`
	Source     string          `json:"source"`
	Page       *int            `json:"page,omitempty"`
	IsSRD      bool            `json:"is_srd"`
	Origin     string          `json:"origin"`
	Data       json.RawMessage `json:"data"`
	SourceFile string          `json:"source_file,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type ContentSummary struct {
	ID     int64  `db:"id" json:"id"`
	Type   string `db:"entity_type" json:"type"`
	Name   string `db:"name" json:"name"`
	Source string `db:"source" json:"source"`
	Page   *int   `db:"page" json:"page,omitempty"`
	IsSRD  bool   `db:"is_srd" json:"is_srd"`
	Origin string `db:"origin" json:"origin"`
}

type ContentFilters struct {
	Query  string `form:"query"`
	Type   string `form:"type"`
	Source string `form:"source"`
	IsSRD  *bool  `form:"is_srd"`
	Origin string `form:"origin"`
	Limit  int    `form:"limit"`
	Offset int    `form:"offset"`
}

type ContentCategory struct {
	Type  string `db:"entity_type" json:"type"`
	Count int    `db:"count" json:"count"`
}
