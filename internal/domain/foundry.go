package domain

import (
	"encoding/json"
	"time"
)

// NPC mirrors a Foundry actor of type "npc". Owned by Foundry under one-way sync.
type NPC struct {
	ID              int64     `db:"id" json:"id"`
	CampaignID      int64     `db:"campaign_id" json:"campaign_id"`
	FoundryUUID     *string   `db:"foundry_uuid" json:"foundry_uuid,omitempty"`
	Name            string    `db:"name" json:"name"`
	Role            string    `db:"role" json:"role"`
	Status          string    `db:"status" json:"status"`
	AvatarURL       string    `db:"avatar_url" json:"avatar_url"`
	AC              int       `db:"ac" json:"ac"`
	HP              int       `db:"hp" json:"hp"`
	Speed           int       `db:"speed" json:"speed"`
	Description     string    `db:"description" json:"description"`
	Notes           string    `db:"notes" json:"notes"`
	IsFoundryOrphan bool      `db:"is_foundry_orphan" json:"is_foundry_orphan"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

// Map mirrors a Foundry scene. Owned by Foundry under one-way sync.
type Map struct {
	ID              int64     `db:"id" json:"id"`
	CampaignID      int64     `db:"campaign_id" json:"campaign_id"`
	FoundryUUID     *string   `db:"foundry_uuid" json:"foundry_uuid,omitempty"`
	Name            string    `db:"name" json:"name"`
	Location        string    `db:"location" json:"location"`
	ImageURL        string    `db:"image_url" json:"image_url"`
	Notes           string    `db:"notes" json:"notes"`
	IsFoundryOrphan bool      `db:"is_foundry_orphan" json:"is_foundry_orphan"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

// FoundrySyncState records the outcome of the last sync for a campaign.
type FoundrySyncState struct {
	CampaignID   int64           `db:"campaign_id" json:"campaign_id"`
	Status       string          `db:"status" json:"status"` // never | running | ok | error
	LastSyncedAt *time.Time      `db:"last_synced_at" json:"last_synced_at,omitempty"`
	Counts       json.RawMessage `db:"counts" json:"counts"`
	Error        string          `db:"error" json:"error"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updated_at"`
}

// SyncCounts is the per-entity-type tally returned by a sync run.
type SyncCounts struct {
	Characters int `json:"characters"`
	NPCs       int `json:"npcs"`
	Items      int `json:"items"`
	Scenes     int `json:"scenes"`
	Journal    int `json:"journal"`
	Monsters   int `json:"monsters"`
}
