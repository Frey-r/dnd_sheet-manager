package handler

import (
	"errors"
	"net/http"
	"strconv"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// defaultSyncPerMinute is the per-user burst for the I/O-heavy sync endpoints
// (foundry-integration.md -> Auth & Rate Limiting).
const defaultSyncPerMinute = 5

type FoundryHandler struct {
	svc           *service.FoundrySyncService
	campaigns     *service.CampaignService
	syncPerMinute int
}

func NewFoundryHandler(svc *service.FoundrySyncService, campaigns *service.CampaignService) *FoundryHandler {
	return &FoundryHandler{svc: svc, campaigns: campaigns, syncPerMinute: defaultSyncPerMinute}
}

// WithSyncLimit overrides the per-user requests/minute of the sync endpoints.
func (h *FoundryHandler) WithSyncLimit(perMinute int) *FoundryHandler {
	if perMinute > 0 {
		h.syncPerMinute = perMinute
	}
	return h
}

func (h *FoundryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/foundry")
	// One shared bucket per user: POST /sync and POST /sync/reference together
	// are limited to syncPerMinute requests per minute.
	syncLimit := middleware.PerUserLimit("foundry-sync", h.syncPerMinute)
	f.GET("/health", h.Health)
	f.GET("/status", h.Status)
	f.POST("/sync", syncLimit, h.Sync)
	f.POST("/sync/reference", middleware.RequireRole("dm", "admin"), syncLimit, h.SyncReference)
}

type syncRequest struct {
	CampaignID int64 `json:"campaign_id" binding:"required"`
}

// authorizeCampaign enforces, server side: membership, GM role (when needGM) and
// game_mode == "foundry". It writes the error response (and records the audit
// reason) and returns false when the request must stop.
func (h *FoundryHandler) authorizeCampaign(c *gin.Context, campaignID int64, needGM bool) bool {
	userID := middleware.GetUserID(c)
	middleware.SetAuditCampaign(c, campaignID)
	campaign, err := h.campaigns.GetByID(c.Request.Context(), campaignID, userID)
	switch {
	case errors.Is(err, service.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "campaign not found"})
		return false
	case err != nil:
		middleware.SetAuditReason(c, "foundry: campaign membership required")
		c.JSON(http.StatusForbidden, gin.H{"error": "campaign membership required"})
		return false
	}
	if needGM && !h.campaigns.IsGM(c.Request.Context(), campaignID, userID) {
		middleware.SetAuditReason(c, "foundry: gm membership required (player attempted sync)")
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return false
	}
	if campaign.GameMode != "foundry" {
		c.JSON(http.StatusConflict, gin.H{"error": "campaign is not in foundry game mode", "game_mode": campaign.GameMode})
		return false
	}
	return true
}

func (h *FoundryHandler) Sync(c *gin.Context) {
	var req syncRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.CampaignID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid campaign_id is required"})
		return
	}
	if !h.authorizeCampaign(c, req.CampaignID, true) {
		return
	}
	counts, err := h.svc.Sync(c.Request.Context(), req.CampaignID, middleware.GetUserID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"status": "error", "counts": counts, "error": err.Error(), "errors": splitMessage(err.Error())})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "counts": counts, "errors": []string{}})
}

// SyncReference imports compendium reference data. campaign_id (query or JSON
// body) is optional: when given it must be a foundry-mode campaign the caller GMs
// and the outcome is recorded in foundry_sync_state; when omitted, the caller must
// GM at least one foundry-mode campaign.
func (h *FoundryHandler) SyncReference(c *gin.Context) {
	campaignID, _ := strconv.ParseInt(c.Query("campaign_id"), 10, 64)
	if campaignID == 0 {
		var req struct {
			CampaignID int64 `json:"campaign_id"`
		}
		if c.Request.ContentLength != 0 && c.ShouldBindJSON(&req) == nil {
			campaignID = req.CampaignID
		}
	}
	if campaignID > 0 {
		if !h.authorizeCampaign(c, campaignID, true) {
			return
		}
	} else if !h.hasFoundryCampaign(c) {
		middleware.SetAuditReason(c, "foundry: no foundry-mode campaign owned by user")
		c.JSON(http.StatusForbidden, gin.H{"error": "foundry game mode with gm membership required"})
		return
	}
	counts, err := h.svc.SyncReference(c.Request.Context(), campaignID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"status": "error", "counts": counts, "error": err.Error(), "errors": splitMessage(err.Error())})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "counts": counts, "errors": []string{}})
}

func (h *FoundryHandler) hasFoundryCampaign(c *gin.Context) bool {
	userID := middleware.GetUserID(c)
	campaigns, err := h.campaigns.ListByUser(c.Request.Context(), userID)
	if err != nil {
		return false
	}
	for _, camp := range campaigns {
		if camp.GameMode == "foundry" && (camp.GMUserID == userID || h.campaigns.IsGM(c.Request.Context(), camp.ID, userID)) {
			return true
		}
	}
	return false
}

func splitMessage(msg string) []string { return []string{msg} }

// Status returns the spec's response shape: status, last_synced_at, counts, errors.
func (h *FoundryHandler) Status(c *gin.Context) {
	campaignID, err := strconv.ParseInt(c.Query("campaign_id"), 10, 64)
	if err != nil || campaignID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid campaign_id"})
		return
	}
	if !h.authorizeCampaign(c, campaignID, false) {
		return
	}
	state, err := h.svc.Status(c.Request.Context(), campaignID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read sync status"})
		return
	}
	c.JSON(http.StatusOK, statusResponse(state, campaignID))
}

func statusResponse(state *domain.FoundrySyncState, campaignID int64) gin.H {
	if state == nil {
		return gin.H{"campaign_id": campaignID, "status": "never", "last_synced_at": nil, "counts": gin.H{}, "errors": []string{}}
	}
	counts := state.Counts
	if len(counts) == 0 {
		counts = []byte("{}")
	}
	return gin.H{
		"campaign_id":    state.CampaignID,
		"status":         state.Status,
		"last_synced_at": state.LastSyncedAt,
		"counts":         counts,
		"errors":         service.SplitSyncErrors(state.Error),
		"error":          state.Error, // legacy single-string field kept for existing clients
		"updated_at":     state.UpdatedAt,
	}
}

func (h *FoundryHandler) Health(c *gin.Context) {
	if err := h.svc.Health(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
