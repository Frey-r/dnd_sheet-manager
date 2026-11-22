package handler

import (
	"net/http"
	"strconv"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type MessageHandler struct {
	msgSvc      *service.MessageService
	campaignSvc *service.CampaignService
	presence    Presence
}

func NewMessageHandler(msgSvc *service.MessageService, campaignSvc *service.CampaignService) *MessageHandler {
	return &MessageHandler{msgSvc: msgSvc, campaignSvc: campaignSvc}
}

// Presence tells whether a member has a live socket (satisfied by *realtime.Hub).
type Presence interface {
	IsOnline(campaignID, userID int64) bool
	OnlineUsers(campaignID int64) []int64
}

// Presence answers GET /campaigns/:id/presence: the members connected right now (chat header).
func (h *MessageHandler) Presence(c *gin.Context) {
	online := []int64{}
	if h.presence != nil {
		online = h.presence.OnlineUsers(parseID(c.Param("id")))
	}
	c.JSON(http.StatusOK, gin.H{"online_user_ids": online})
}

// WithPresence lets SendMessage answer delivered vs queued (user-stories.md).
func (h *MessageHandler) WithPresence(p Presence) *MessageHandler {
	h.presence = p
	return h
}

// deliveryStatus is "delivered" when the recipient is connected now and "queued" otherwise;
// broadcasts and handlers without presence report "delivered" (stored for every member).
func deliveryStatus(p Presence, msg *domain.Message) string {
	if p == nil || msg.RecipientUserID == nil || msg.MessageType == domain.MessageTypeGMBroadcast {
		return "delivered"
	}
	if p.IsOnline(msg.CampaignID, *msg.RecipientUserID) {
		return "delivered"
	}
	return "queued"
}

func (h *MessageHandler) SendMessage(c *gin.Context) {
	var req domain.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	isGM := middleware.IsGM(c)
	campaignID := parseID(c.Param("id"))

	msg, err := h.msgSvc.SendMessage(c.Request.Context(), userID, campaignID, isGM, &req)
	if err != nil {
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot send this type of message"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send message"})
		return
	}

	c.JSON(http.StatusCreated, struct {
		*domain.Message
		Delivery string `json:"delivery"`
	}{msg, deliveryStatus(h.presence, msg)})
}

func (h *MessageHandler) GetConversations(c *gin.Context) {
	userID := middleware.GetUserID(c)
	campaignID := parseID(c.Param("id"))

	convs, err := h.msgSvc.GetConversations(c.Request.Context(), campaignID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get conversations"})
		return
	}

	c.JSON(http.StatusOK, convs)
}

func (h *MessageHandler) GetConversation(c *gin.Context) {
	userID := middleware.GetUserID(c)
	campaignID := parseID(c.Param("id"))
	otherUserID := parseID(c.Param("user_id"))

	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	messages, err := h.msgSvc.GetConversation(c.Request.Context(), campaignID, userID, otherUserID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get messages"})
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *MessageHandler) MarkAsRead(c *gin.Context) {
	userID := middleware.GetUserID(c)

	// Optional scope: ?campaign_id=X&user_id=Y marks only that conversation.
	if campaignID, otherID := parseID(c.Query("campaign_id")), parseID(c.Query("user_id")); campaignID > 0 && otherID > 0 {
		if err := h.msgSvc.MarkConversationAsRead(c.Request.Context(), campaignID, userID, otherID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark as read"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
		return
	}

	if err := h.msgSvc.MarkAsRead(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}
