package handler

import (
	"errors"
	"log"
	"net/http"

	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// StatRollHandler serves ability score rolls made by the server (characters.md).
type StatRollHandler struct {
	repo *repository.StatRollRepository
}

func NewStatRollHandler(repo *repository.StatRollRepository) *StatRollHandler {
	return &StatRollHandler{repo: repo}
}

func (h *StatRollHandler) RegisterRoutes(g *gin.RouterGroup) {
	g.GET("/campaigns/:id/stat-rolls", h.List)
	g.POST("/campaigns/:id/stat-rolls", h.Roll)
	g.DELETE("/campaigns/:id/stat-rolls/:roll_id", h.Discard)
}

// List: a player gets their available set; the GM gets every set of the campaign.
func (h *StatRollHandler) List(c *gin.Context) {
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	if middleware.IsGM(c) {
		rolls, err := h.repo.List(ctx, campaignID)
		if err != nil {
			log.Printf("stat rolls: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudieron cargar las tiradas"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"all": rolls})
		return
	}
	current, err := h.repo.Available(ctx, campaignID, middleware.GetUserID(c))
	if err != nil {
		log.Printf("stat rolls: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudieron cargar las tiradas"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"current": current})
}

// Roll makes a new set unless one is already waiting to be used.
func (h *StatRollHandler) Roll(c *gin.Context) {
	dice, totals := service.RollAbilitySet(nil)
	roll, err := h.repo.Create(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), dice, totals)
	if err != nil {
		log.Printf("stat rolls: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo tirar"})
		return
	}
	c.JSON(http.StatusOK, roll)
}

// Discard (GM) allows the player to roll again.
func (h *StatRollHandler) Discard(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Solo el DM puede permitir repetir la tirada"})
		return
	}
	if err := h.repo.Discard(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("roll_id"))); err != nil {
		if errors.Is(err, repository.ErrStatRollNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo descartar"})
		return
	}
	c.Status(http.StatusNoContent)
}
