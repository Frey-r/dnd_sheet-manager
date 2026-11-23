package handler

import (
	"net/http"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type CombatHandler struct{ repo *repository.CombatRepository }

func NewCombatHandler(repo *repository.CombatRepository) *CombatHandler {
	return &CombatHandler{repo: repo}
}

func (h *CombatHandler) State(c *gin.Context) {
	state, err := h.repo.State(c.Request.Context(), parseID(c.Param("id")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load combat"})
		return
	}
	c.JSON(http.StatusOK, state)
}

func (h *CombatHandler) Add(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	var combatant domain.Combatant
	if err := c.ShouldBindJSON(&combatant); err != nil || strings.TrimSpace(combatant.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	combatant.ID, combatant.CampaignID, combatant.SRDMonsterID = 0, parseID(c.Param("id")), nil
	if err := h.repo.Add(c.Request.Context(), &combatant); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, combatant)
}

// AddEncounter adds every combatant of an accepted encounter in one request. Each
// entry is either a plain combatant (GM console / NPCs) or an SRD monster reference
// {monster_id, count}: for those hp, AC and the initiative DEX modifier are resolved
// from srd_monsters server-side and client values are ignored. All combatants are
// inserted atomically. The realtime middleware publishes ENCOUNTER_STARTED for this
// route (only reached on success).
func (h *CombatHandler) AddEncounter(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	var in struct {
		Combatants []service.EncounterEntry `json:"combatants"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Combatants) == 0 || len(in.Combatants) > service.MaxEncounterCombatants {
		c.JSON(http.StatusBadRequest, gin.H{"error": "combatants must contain between 1 and 50 entries"})
		return
	}
	ctx := c.Request.Context()
	monsters, err := h.repo.SRDMonsterStats(ctx, service.MonsterIDs(in.Combatants))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load srd monsters"})
		return
	}
	combatants, err := service.ResolveEncounter(parseID(c.Param("id")), in.Combatants, monsters, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.AddMany(ctx, combatants); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"combatants": combatants})
}

func (h *CombatHandler) Next(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	if err := h.repo.NextTurn(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.State(c)
}

func (h *CombatHandler) UpdateHP(c *gin.Context) {
	var request struct {
		HP int `json:"hp"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid HP"})
		return
	}
	if err := h.repo.UpdateHP(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("combatant_id")), middleware.GetUserID(c), middleware.IsGM(c), request.HP); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.State(c)
}

func (h *CombatHandler) Remove(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	if err := h.repo.Remove(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("combatant_id"))); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "combatant removed"})
}

func (h *CombatHandler) Reset(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	if err := h.repo.Reset(c.Request.Context(), parseID(c.Param("id"))); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reset combat"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "combat reset"})
}
