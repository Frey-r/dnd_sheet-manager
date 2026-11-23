package domain

import "time"

type LoreTier string

const (
	LoreTierCharacter    LoreTier = "character_lore"
	LoreTierCampaignPlot LoreTier = "campaign_plot"
	LoreTierGMHidden     LoreTier = "gm_hidden_lore"
	// LoreScopeAll is a search scope, not a stored tier: the GM searches every tier at once.
	LoreScopeAll LoreTier = "all"
)

// LoreSource is one lore entry cited by an Oracle answer: its title and tier (source type).
type LoreSource struct {
	Title string   `json:"title"`
	Tier  LoreTier `json:"tier"`
}

type LoreEntry struct {
	ID              int64     `db:"id" json:"id"`
	CampaignID      int64     `db:"campaign_id" json:"campaign_id"`
	CharacterID     *int64    `db:"character_id" json:"character_id"` // null for campaign-level
	ContentText     string    `db:"content_text" json:"content_text"`
	ContentVector   []float32 `db:"-" json:"-"` // pgvector column, written via UpdateVector; never scanned
	LoreTier        LoreTier  `db:"lore_tier" json:"lore_tier"`
	ChapterOrder    int       `db:"chapter_order" json:"chapter_order"`
	Title           string    `db:"title" json:"title"`
	FoundryUUID     *string   `db:"foundry_uuid" json:"foundry_uuid,omitempty"`
	IsFoundryOrphan bool      `db:"is_foundry_orphan" json:"is_foundry_orphan"`
	IsVectorized    bool      `db:"is_vectorized" json:"is_vectorized"` // derived: content_vector IS NOT NULL
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

type GameEvent struct {
	ID          int64     `db:"id" json:"id"`
	CampaignID  int64     `db:"campaign_id" json:"campaign_id"`
	CharacterID *int64    `db:"character_id" json:"character_id"`
	EventType   string    `db:"event_type" json:"event_type"`
	Payload     string    `db:"payload" json:"payload"` // JSON
	Timestamp   time.Time `db:"timestamp" json:"timestamp"`
}

type AuditLog struct {
	ID         int64     `db:"id" json:"id"`
	UserID     *int64    `db:"user_id" json:"user_id"`
	CampaignID *int64    `db:"campaign_id" json:"campaign_id"`
	Action     string    `db:"action" json:"action"`
	Details    string    `db:"details" json:"details"` // JSON
	IPAddress  string    `db:"ip_address" json:"ip_address"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

type CreateLoreRequest struct {
	CharacterID  *int64   `json:"character_id"`
	ContentText  string   `json:"content_text" binding:"required"`
	LoreTier     LoreTier `json:"lore_tier" binding:"required"`
	ChapterOrder int      `json:"chapter_order"`
	Title        string   `json:"title"`
}

type UpdateLoreRequest struct {
	ContentText  *string   `json:"content_text"`
	Title        *string   `json:"title"`
	ChapterOrder *int      `json:"chapter_order"`
	LoreTier     *LoreTier `json:"lore_tier"`
}
