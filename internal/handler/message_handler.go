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
	msgSvc     *service.MessageService
	campaignSvc *service.CampaignService
}

func NewMessageHandler(msgSvc *service.MessageService, campaignSvc *service.CampaignService) *MessageHandler {
	return &MessageHandler{msgSvc: msgSvc, campaignSvc: campaignSvc}
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

	c.JSON(http.StatusCreated, msg)
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

	if err := h.msgSvc.MarkAsRead(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}