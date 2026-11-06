package handler

import (
	"net/http"
	"strconv"

	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type FoundryHandler struct {
	svc       *service.FoundrySyncService
	campaigns *service.CampaignService
}

func NewFoundryHandler(svc *service.FoundrySyncService, campaigns *service.CampaignService) *FoundryHandler {
	return &FoundryHandler{svc: svc, campaigns: campaigns}
}

func (h *FoundryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/foundry")
	f.GET("/health", h.Health)
	f.GET("/status", h.Status)
	f.POST("/sync", h.Sync)
	f.POST("/sync/reference", middleware.RequireRole("dm", "admin"), h.SyncReference)
}

type syncRequest struct {
	CampaignID int64 `json:"campaign_id" binding:"required"`
}

func (h *FoundryHandler) Sync(c *gin.Context) {
	var req syncRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.CampaignID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid campaign_id is required"})
		return
	}
	userID := middleware.GetUserID(c)
	if !h.campaigns.IsGM(c.Request.Context(), req.CampaignID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	counts, err := h.svc.Sync(c.Request.Context(), req.CampaignID, userID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"status": "error", "counts": counts, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "counts": counts})
}

func (h *FoundryHandler) SyncReference(c *gin.Context) {
	counts, err := h.svc.SyncReference(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"status": "error", "counts": counts, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "counts": counts})
}

func (h *FoundryHandler) Status(c *gin.Context) {
	campaignID, err := strconv.ParseInt(c.Query("campaign_id"), 10, 64)
	if err != nil || campaignID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid campaign_id"})
		return
	}
	member, err := h.campaigns.IsMember(c.Request.Context(), campaignID, middleware.GetUserID(c))
	if err != nil || !member {
		c.JSON(http.StatusForbidden, gin.H{"error": "campaign membership required"})
		return
	}
	state, err := h.svc.Status(c.Request.Context(), campaignID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read sync status"})
		return
	}
	if state == nil {
		c.JSON(http.StatusOK, gin.H{"status": "never"})
		return
	}
	c.JSON(http.StatusOK, state)
}

func (h *FoundryHandler) Health(c *gin.Context) {
	if err := h.svc.Health(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
