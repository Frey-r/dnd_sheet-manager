package handler

import (
	"context"
	"net/http"
	"strings"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type LoreHandler struct {
	lore  *repository.LoreRepository
	chars *repository.CharacterRepository
	pool  *service.LoreWorkerPool
}

func NewLoreHandler(lore *repository.LoreRepository, chars *repository.CharacterRepository, pool *service.LoreWorkerPool) *LoreHandler {
	return &LoreHandler{lore: lore, chars: chars, pool: pool}
}
func (h *LoreHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/campaigns/:id/lore", h.List)
	group.POST("/campaigns/:id/lore", h.Create)
	group.GET("/campaigns/:id/lore/:lore_id", h.Get)
	group.PUT("/campaigns/:id/lore/:lore_id", h.Update)
	group.DELETE("/campaigns/:id/lore/:lore_id", h.Delete)
	group.POST("/campaigns/:id/lore/search", h.Search)
}

func (h *LoreHandler) List(c *gin.Context) {
	entries, err := h.lore.ListVisible(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load lore"})
		return
	}
	c.JSON(http.StatusOK, entries)
}

func (h *LoreHandler) visible(c *gin.Context) (*domain.LoreEntry, bool) {
	entry, err := h.lore.GetByID(c.Request.Context(), parseID(c.Param("lore_id")))
	if err != nil || entry == nil || entry.CampaignID != parseID(c.Param("id")) {
		c.JSON(http.StatusNotFound, gin.H{"error": "lore not found"})
		return nil, false
	}
	if middleware.IsGM(c) || entry.LoreTier == domain.LoreTierCampaignPlot {
		return entry, true
	}
	if entry.CharacterID != nil && entry.LoreTier != domain.LoreTierGMHidden {
		character, err := h.chars.GetByID(c.Request.Context(), *entry.CharacterID)
		if err == nil && character != nil && character.UserID == middleware.GetUserID(c) {
			return entry, true
		}
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
	return nil, false
}

func (h *LoreHandler) Get(c *gin.Context) {
	if entry, ok := h.visible(c); ok {
		c.JSON(http.StatusOK, entry)
	}
}
func (h *LoreHandler) Create(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	var request domain.CreateLoreRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validTier(request.LoreTier) || strings.TrimSpace(request.ContentText) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lore entry"})
		return
	}
	if request.CharacterID != nil {
		character, err := h.chars.GetByID(c.Request.Context(), *request.CharacterID)
		if err != nil || character == nil || character.CampaignID != parseID(c.Param("id")) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "character not in campaign"})
			return
		}
	}
	entry := &domain.LoreEntry{CampaignID: parseID(c.Param("id")), CharacterID: request.CharacterID, ContentText: request.ContentText, LoreTier: request.LoreTier, ChapterOrder: request.ChapterOrder, Title: strings.TrimSpace(request.Title)}
	if err := h.lore.Create(c.Request.Context(), entry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create lore"})
		return
	}
	_ = h.pool.Vectorize(entry.ID)
	c.JSON(http.StatusCreated, entry)
}
func (h *LoreHandler) Update(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	entry, ok := h.visible(c)
	if !ok {
		return
	}
	var request domain.UpdateLoreRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if request.ContentText != nil {
		entry.ContentText = *request.ContentText
	}
	if request.Title != nil {
		entry.Title = *request.Title
	}
	if request.ChapterOrder != nil {
		entry.ChapterOrder = *request.ChapterOrder
	}
	if request.LoreTier != nil {
		if !validTier(*request.LoreTier) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tier"})
			return
		}
		entry.LoreTier = *request.LoreTier
	}
	if err := h.lore.Update(c.Request.Context(), entry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update lore"})
		return
	}
	_ = h.pool.Vectorize(entry.ID)
	c.JSON(http.StatusOK, entry)
}
func (h *LoreHandler) Delete(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	if _, ok := h.visible(c); !ok {
		return
	}
	if err := h.lore.Delete(c.Request.Context(), parseID(c.Param("lore_id"))); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete lore"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
func validTier(tier domain.LoreTier) bool {
	return tier == domain.LoreTierCampaignPlot || tier == domain.LoreTierGMHidden || tier == domain.LoreTierCharacter
}
func (h *LoreHandler) Search(c *gin.Context) {
	var request struct {
		Query       string          `json:"query" binding:"required"`
		Scope       domain.LoreTier `json:"scope"`
		CharacterID *int64          `json:"character_id"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if (!validTier(request.Scope) && request.Scope != domain.LoreScopeAll) || len(request.Query) > 4000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid query"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()
	select {
	case result := <-h.pool.Query(ctx, service.LoreQuery{CampaignID: parseID(c.Param("id")), CharacterID: request.CharacterID, UserID: middleware.GetUserID(c), IsGM: middleware.IsGM(c), Tier: request.Scope, Text: request.Query}):
		if result.Err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		if result.Err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "character not found"})
			return
		}
		if result.Err == service.ErrLoreBusy {
			c.JSON(http.StatusServiceUnavailable, gin.H{"type": "RAG_BUSY", "error": "El Oráculo está ocupado; inténtalo en unos segundos", "retryable": true})
			return
		}
		if result.Err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"type": "RAG_UNAVAILABLE", "error": "El Oráculo no está disponible en este servidor", "retryable": true})
			return
		}
		titles := make([]string, len(result.Sources))
		for i, source := range result.Sources {
			titles[i] = source.Title
		}
		c.JSON(http.StatusOK, gin.H{"answer": result.Answer, "sources": titles, "source_details": result.Sources})
	case <-ctx.Done():
		c.JSON(http.StatusGatewayTimeout, gin.H{"type": "RAG_TIMEOUT", "message": "Lore query timed out", "retryable": true})
	}
}
