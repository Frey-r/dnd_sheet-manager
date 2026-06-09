package domain

import "time"

type CampaignStatus string

const (
	CampaignActive CampaignStatus = "active"
	CampaignPaused CampaignStatus = "paused"
)

type Campaign struct {
	ID          int64          `db:"id" json:"id"`
	Name        string         `db:"name" json:"name"`
	Description string         `db:"description" json:"description"`
	JoinCode    string         `db:"join_code" json:"join_code"`
	GMUserID    int64          `db:"gm_user_id" json:"gm_user_id"`
	Status      CampaignStatus `db:"status" json:"status"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

type CampaignMember struct {
	CampaignID int64     `db:"campaign_id" json:"campaign_id"`
	UserID     int64     `db:"user_id" json:"user_id"`
	Role       string    `db:"role" json:"role"` // "gm" or "player"
	JoinedAt   time.Time `db:"joined_at" json:"joined_at"`
}

type CreateCampaignRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=100"`
	Description string `json:"description"`
}

type JoinCampaignRequest struct {
	JoinCode string `json:"join_code" binding:"required"`
}

type UpdateCampaignRequest struct {
	Name        *string         `json:"name"`
	Description *string         `json:"description"`
	Status      *CampaignStatus `json:"status"`
}

const (
	RoleGM     = "gm"
	RolePlayer = "player"
)