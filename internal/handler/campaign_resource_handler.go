package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// BotLLM is the slice of the RAG service the bot test needs (satisfied by *service.RAGService).
type BotLLM interface {
	GenerateResponse(ctx context.Context, prompt string) (string, error)
}

type CampaignResourceHandler struct {
	repo *repository.CampaignResourceRepository
	llm  BotLLM
}

// WithBotLLM enables POST /campaigns/:id/bot/test.
func (h *CampaignResourceHandler) WithBotLLM(llm BotLLM) *CampaignResourceHandler {
	h.llm = llm
	return h
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
	auth.POST("/campaigns/:id/bot/test", h.TestBot)
}

// List is GM-only like Get: NPC secrets, GM notes, events and maps are DM preparation material
// and every screen that lists them sits behind the GM guard.
func (h *CampaignResourceHandler) List(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireGM(c) {
			return
		}
		rows, err := h.repo.List(c.Request.Context(), parseID(c.Param("id")), kind)
		h.respond(c, rows, err)
	}
}

func (h *CampaignResourceHandler) Get(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireGM(c) {
			return
		}
		row, err := h.repo.Get(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), kind)
		h.respond(c, row, err)
	}
}

func (h *CampaignResourceHandler) Create(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireGM(c) {
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
	return validateFields(kind, input)
}

// validateFields checks the optional fields that create and update share, normalising them in place.
func validateFields(kind string, input map[string]any) error {
	switch kind {
	case "events":
		return validateEventRelations(input)
	case "npcs":
		return normalizeAppearance(input)
	}
	return nil
}

// normalizeAppearance validates an NPC appearance exactly like a character's (service.ValidateAppearance)
// and replaces it with the normalised document; null yields an empty one, which is stored as SQL NULL.
func normalizeAppearance(input map[string]any) error {
	value, exists := input["appearance"]
	if !exists {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return service.ErrInvalidAppearance
	}
	appearance, err := service.ValidateAppearance(raw)
	if err != nil {
		return err
	}
	input["appearance"] = appearance
	return nil
}

const (
	maxRelationEntries = 50
	maxRelationLength  = 200
)

// validateEventRelations checks related_npcs / related_locations: arrays of at most 50 strings,
// each at most 200 characters. A null value is normalised to an empty array.
func validateEventRelations(input map[string]any) error {
	for _, field := range []string{"related_npcs", "related_locations"} {
		value, exists := input[field]
		if !exists {
			continue
		}
		if value == nil {
			input[field] = []any{}
			continue
		}
		list, ok := value.([]any)
		if !ok {
			return errors.New(field + " must be an array of strings")
		}
		if len(list) > maxRelationEntries {
			return fmt.Errorf("%s allows at most %d entries", field, maxRelationEntries)
		}
		for _, item := range list {
			text, ok := item.(string)
			if !ok {
				return errors.New(field + " must be an array of strings")
			}
			if utf8.RuneCountInString(text) > maxRelationLength {
				return fmt.Errorf("%s entries must be at most %d characters", field, maxRelationLength)
			}
		}
	}
	return nil
}

func (h *CampaignResourceHandler) Update(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireGM(c) {
			return
		}
		var input map[string]any
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		if err := validateFields(kind, input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		row, err := h.repo.Update(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), middleware.GetUserID(c), kind, input)
		h.respond(c, row, err)
	}
}

func (h *CampaignResourceHandler) Delete(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !requireGM(c) {
			return
		}
		h.respond(c, gin.H{"message": "deleted"}, h.repo.Delete(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), kind))
	}
}

// Bot is GM-only: the personality and the enabled actions are DM preparation material like the other resources.
func (h *CampaignResourceHandler) Bot(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	row, err := h.repo.GetBot(c.Request.Context(), parseID(c.Param("id")))
	if errors.Is(err, repository.ErrResourceNotFound) {
		h.respond(c, gin.H{"enabled": false, "personality": "", "actions": map[string]any{}}, nil)
		return
	}
	h.respond(c, row, err)
}

func (h *CampaignResourceHandler) SaveBot(c *gin.Context) {
	if !requireGM(c) {
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

// respond answers 404 for a missing resource and 400 with the message of an input the repository rejected; any
// other error is internal: it is logged and the client only gets a generic 500 (openspec/specs/security.md).
func (h *CampaignResourceHandler) respond(c *gin.Context, data any, err error) {
	var invalid repository.ResourceInputError
	switch {
	case err == nil:
		c.JSON(http.StatusOK, data)
	case errors.Is(err, repository.ErrResourceNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	case errors.As(err, &invalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": invalid.Msg})
	default:
		log.Printf("campaign resources: %s %s: %v", c.Request.Method, c.FullPath(), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
	}
}
