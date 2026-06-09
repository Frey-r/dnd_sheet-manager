package websocket

import "time"

type MessageType string

const (
	// Outbound message types
	TypeCharacterUpdate MessageType = "CHARACTER_UPDATE"
	TypeSpellCast       MessageType = "SPELL_CAST"
	TypeLoreQuery       MessageType = "LORE_QUERY"
	TypeLoreQueryResult MessageType = "LORE_QUERY_RESULT"
	TypeGameEvent       MessageType = "GAME_EVENT"
	TypeTradeOffer      MessageType = "TRADE_OFFER"
	TypeTradeAccepted   MessageType = "TRADE_ACCEPTED"
	TypeTradeRejected   MessageType = "TRADE_REJECTED"
	TypeTradeCancelled  MessageType = "TRADE_CANCELLED"
	TypeMessageGM       MessageType = "MESSAGE_GM"
	TypeMessagePlayer   MessageType = "MESSAGE_PLAYER"
	TypeRAGResponse     MessageType = "RAG_RESPONSE"
	TypeRAGError        MessageType = "RAG_ERROR"
	TypePing            MessageType = "PING"
	TypePong            MessageType = "PONG"
	TypeError           MessageType = "ERROR"
	TypeAuthSuccess     MessageType = "AUTH_SUCCESS"
	TypeAuthError       MessageType = "AUTH_ERROR"
)

type WSMessage struct {
	Type    MessageType `json:"type"`
	Payload interface{} `json:"payload"`
}

// Inbound (client → server)
type AuthFrame struct {
	Token string `json:"token"`
}

type LoreQueryPayload struct {
	Query string `json:"query"`
	Scope string `json:"scope"` // "character_lore", "campaign_plot", "gm_hidden_lore"
}

type TradeOfferPayload struct {
	RecipientCharacterID int64   `json:"recipient_character_id"`
	OfferedItemIDs       []int64 `json:"offered_item_ids"`
	OfferedGold          int     `json:"offered_gold"`
	RequestedItemIDs     []int64 `json:"requested_item_ids"`
	RequestedGold        int     `json:"requested_gold"`
}

type TradeResponsePayload struct {
	TradeID int64  `json:"trade_id"`
	Action  string `json:"action"` // "accept" or "reject"
}

type ChatMessagePayload struct {
	Body            string `json:"body"`
	MessageType     string `json:"message_type"` // "player_direct", "gm_direct", "gm_broadcast"
	RecipientUserID *int64 `json:"recipient_user_id"`
}

type CharacterUpdatePayload struct {
	CharacterID int64  `json:"character_id"`
	Field       string `json:"field"` // "current_hp", "gold", "spell_slots"
	Value       interface{} `json:"value"`
}

// Outbound payloads
type CharacterUpdateResponse struct {
	CharacterID    int64  `json:"character_id"`
	CharacterName  string `json:"character_name"`
	Field          string `json:"field"`
	OldValue       interface{} `json:"old_value"`
	NewValue       interface{} `json:"new_value"`
}

type RAGResponsePayload struct {
	Query    string   `json:"query"`
	Answer   string   `json:"answer"`
	Sources  []string `json:"sources"`
}

type RAGErrorPayload struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Query   string `json:"query"`
}

type TradeOfferNotification struct {
	TradeID      int64  `json:"trade_id"`
	OfferorName  string `json:"offeror_name"`
	OfferedItems []string `json:"offered_items"`
	OfferedGold  int    `json:"offered_gold"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type ErrorPayload struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type GameEventPayload struct {
	EventType string      `json:"event_type"`
	Character *string     `json:"character,omitempty"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
}

type MessagePayload struct {
	MessageID     int64     `json:"message_id"`
	SenderID      int64     `json:"sender_id"`
	SenderName    string    `json:"sender_name"`
	RecipientID   *int64    `json:"recipient_id,omitempty"`
	MessageType   string    `json:"message_type"`
	Subject       string    `json:"subject"`
	Body          string    `json:"body"`
	Timestamp     time.Time `json:"timestamp"`
}

type PingPayload struct {
	Timestamp time.Time `json:"timestamp"`
}

type ClientInfo struct {
	UserID      int64  `json:"user_id"`
	Username    string `json:"username"`
	Role        string `json:"role"`        // "gm" or "player"
	CharacterID int64  `json:"character_id"`
	CampaignID  int64  `json:"campaign_id"`
}