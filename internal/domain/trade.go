package domain

import "time"

type TradeStatus string

const (
	TradePending   TradeStatus = "pending"
	TradeAccepted  TradeStatus = "accepted"
	TradeRejected  TradeStatus = "rejected"
	TradeCancelled TradeStatus = "cancelled"
	TradeExpired   TradeStatus = "expired"
	// TradeInvalidated: an item vanished before acceptance (user-stories.md, Trade Conflict).
	TradeInvalidated TradeStatus = "invalidated"
)

type TradeOffer struct {
	ID                   int64       `db:"id" json:"id"`
	CampaignID           int64       `db:"campaign_id" json:"campaign_id"`
	OfferorCharacterID   int64       `db:"offeror_character_id" json:"offeror_character_id"`
	RecipientCharacterID int64       `db:"recipient_character_id" json:"recipient_character_id"`
	OfferedItemIDs       string      `db:"offered_item_ids" json:"offered_item_ids"` // JSON array
	OfferedGold          int         `db:"offered_gold" json:"offered_gold"`
	RequestedItemIDs     string      `db:"requested_item_ids" json:"requested_item_ids"` // JSON array
	RequestedGold        int         `db:"requested_gold" json:"requested_gold"`
	Status               TradeStatus `db:"status" json:"status"`
	CreatedAt            time.Time   `db:"created_at" json:"created_at"`
	ExpiresAt            time.Time   `db:"expires_at" json:"expires_at"`
}

type CreateTradeRequest struct {
	RecipientCharacterID int64   `json:"recipient_character_id" binding:"required"`
	OfferedItemIDs       []int64 `json:"offered_item_ids"`
	OfferedGold          int     `json:"offered_gold"`
	RequestedItemIDs     []int64 `json:"requested_item_ids"`
	RequestedGold        int     `json:"requested_gold"`
}

type TradeResponse struct {
	Action string `json:"action"` // "accept" or "reject"
}
