package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"

	"github.com/gin-gonic/gin"
)

type CampaignResourceHandler struct {
	repo *repository.CampaignResourceRepository
}

func NewCampaignResourceHandler(repo *repository.CampaignResourceRepository) *CampaignResourceHandler {
	return &CampaignResourceHandler{repo: repo}
}

func (h *CampaignResourceHandler) RegisterRoutes(auth *gin.RouterGroup) {
	for _, kind := range []string{"npcs", "maps", "events", "notes"} {
		auth.GET("/campaigns/:id/"+kind, h.List(kind))
		auth.POST("/campaigns/:id/"+kind, h.Create(kind))
		auth.GET("/campaigns/:id/"+kind+"/:resource_id", h.Get(kind))
		auth.PUT("/campaigns/:id/"+kind+"/:resource_id", h.Update(kind))
		auth.DELETE("/campaigns/:id/"+kind+"/:resource_id", h.Delete(kind))
	}
	auth.GET("/campaigns/:id/bot", h.Bot)
	auth.PUT("/campaigns/:id/bot", h.SaveBot)
}

func (h *CampaignResourceHandler) List(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := h.repo.List(c.Request.Context(), parseID(c.Param("id")), kind)
		h.respond(c, rows, err)
	}
}

func (h *CampaignResourceHandler) Get(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !middleware.IsGM(c) {
			c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
			return
		}
		row, err := h.repo.Get(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), kind)
		h.respond(c, row, err)
	}
}

func (h *CampaignResourceHandler) Create(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !middleware.IsGM(c) {
			c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
			return
		}
		var input map[string]any
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if err := validateResource(kind, input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		row, err := h.repo.Create(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), kind, input)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create resource"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func validateResource(kind string, input map[string]any) error {
	nameField := "name"
	if kind == "events" || kind == "notes" {
		nameField = "title"
	}
	if text, ok := input[nameField].(string); !ok || strings.TrimSpace(text) == "" {
		return errors.New(nameField + " is required")
	}
	if kind == "events" {
		date, ok := input["event_date"].(string)
		if !ok {
			return errors.New("event_date is required")
		}
		if _, err := time.Parse("2006-01-02", date); err != nil {
			return errors.New("event_date must be YYYY-MM-DD")
		}
	}
	return nil
}

func (h *CampaignResourceHandler) Update(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !middleware.IsGM(c) {
			c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
			return
		}
		var input map[string]any
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		row, err := h.repo.Update(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), middleware.GetUserID(c), kind, input)
		h.respond(c, row, err)
	}
}

func (h *CampaignResourceHandler) Delete(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !middleware.IsGM(c) {
			c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
			return
		}
		h.respond(c, gin.H{"message": "deleted"}, h.repo.Delete(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), kind))
	}
}

func (h *CampaignResourceHandler) Bot(c *gin.Context) {
	row, err := h.repo.GetBot(c.Request.Context(), parseID(c.Param("id")))
	if err == repository.ErrResourceNotFound {
		h.respond(c, gin.H{"enabled": false, "personality": "", "actions": map[string]any{}}, nil)
		return
	}
	h.respond(c, row, err)
}

func (h *CampaignResourceHandler) SaveBot(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	var input map[string]any
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	row, err := h.repo.SaveBot(c.Request.Context(), parseID(c.Param("id")), input)
	h.respond(c, row, err)
}

func (h *CampaignResourceHandler) respond(c *gin.Context, data any, err error) {
	if err == repository.ErrResourceNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}
