package domain

import "time"

type CampaignStatus string

const (
	CampaignActive CampaignStatus = "active"
	CampaignPaused CampaignStatus = "paused"
)

type Campaign struct {
	ID             int64          `db:"id" json:"id"`
	Name           string         `db:"name" json:"name"`
	Description    string         `db:"description" json:"description"`
	JoinCode       string         `db:"join_code" json:"join_code"`
	GMUserID       int64          `db:"gm_user_id" json:"gm_user_id"`
	Status         CampaignStatus `db:"status" json:"status"`
	GameMode       string         `db:"game_mode" json:"game_mode"`
	BastionSalePct int            `db:"bastion_sale_pct" json:"bastion_sale_pct"`
	CreatedAt      time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time      `db:"updated_at" json:"updated_at"`
}

type CampaignMember struct {
	CampaignID int64     `db:"campaign_id" json:"campaign_id"`
	UserID     int64     `db:"user_id" json:"user_id"`
	Role       string    `db:"role" json:"role"` // "gm" or "player"
	JoinedAt   time.Time `db:"joined_at" json:"joined_at"`
	Username   string    `db:"username" json:"username"`
}

type CreateCampaignRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=100"`
	Description string `json:"description" binding:"max=10000"`
	GameMode    string `json:"game_mode" binding:"omitempty,oneof=local foundry"`
}

type JoinCampaignRequest struct {
	JoinCode string `json:"join_code" binding:"required"`
}

type UpdateCampaignRequest struct {
	Name        *string         `json:"name"`
	Description *string         `json:"description"`
	Status      *CampaignStatus `json:"status"`
	// BastionSalePct is the share of value_cp paid for Bastion goods (market-bastions.md §6.5).
	BastionSalePct *int `json:"bastion_sale_pct" binding:"omitempty,min=0,max=100"`
}

const (
	RoleGM     = "gm"
	RolePlayer = "player"
)
