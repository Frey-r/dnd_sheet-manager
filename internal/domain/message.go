package domain

import "time"

type MessageType string

const (
	MessageTypeGMBroadcast  MessageType = "gm_broadcast"
	MessageTypeGMDirect     MessageType = "gm_direct"
	MessageTypePlayerDirect MessageType = "player_direct"
)

type Message struct {
	ID              int64       `db:"id" json:"id"`
	CampaignID      int64       `db:"campaign_id" json:"campaign_id"`
	SenderUserID    int64       `db:"sender_user_id" json:"sender_user_id"`
	RecipientUserID *int64      `db:"recipient_user_id" json:"recipient_user_id"`
	MessageType     MessageType `db:"message_type" json:"message_type"`
	Subject         string      `db:"subject" json:"subject"`
	Body            string      `db:"body" json:"body"`
	IsRead          bool        `db:"is_read" json:"is_read"`
	CreatedAt       time.Time   `db:"created_at" json:"created_at"`
}

type SendMessageRequest struct {
	RecipientUserID *int64      `json:"recipient_user_id"`
	MessageType     MessageType `json:"message_type" binding:"required"`
	Subject         string      `json:"subject"`
	Body            string      `json:"body" binding:"required"`
}

type Conversation struct {
	OtherUserID   int64       `json:"other_user_id"`
	OtherUsername string      `json:"other_username"`
	MessageType   MessageType `json:"conversation_type"`
	LastMessage   string      `json:"last_message"`
	LastMessageAt time.Time   `json:"last_message_at"`
	UnreadCount   int         `json:"unread_count"`
}
