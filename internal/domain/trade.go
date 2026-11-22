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
	// OfferedItems and RequestedItems name the items of the offer for the trade list
	// (user-stories.md: the recipient sees which items are offered). Filled on listing.
	OfferedItems   []TradeItemRef `db:"-" json:"offered_items,omitempty"`
	RequestedItems []TradeItemRef `db:"-" json:"requested_items,omitempty"`
}

// TradeItemRef is the name and quantity of an inventory item referenced by an offer.
type TradeItemRef struct {
	ID       int64  `db:"id" json:"id"`
	Name     string `db:"name" json:"name"`
	Quantity int    `db:"quantity" json:"quantity"`
}

// NameTradeItems fills OfferedItems/RequestedItems of each offer from the named items;
// ids that no longer exist are skipped.
func NameTradeItems(offers []TradeOffer, items []TradeItemRef, decode func(string) []int64) {
	byID := make(map[int64]TradeItemRef, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}
	pick := func(raw string) []TradeItemRef {
		out := []TradeItemRef{}
		for _, id := range decode(raw) {
			if item, ok := byID[id]; ok {
				out = append(out, item)
			}
		}
		return out
	}
	for i := range offers {
		offers[i].OfferedItems = pick(offers[i].OfferedItemIDs)
		offers[i].RequestedItems = pick(offers[i].RequestedItemIDs)
	}
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
