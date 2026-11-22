package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

// SRDHandler handles all SRD reference data REST endpoints.
type SRDHandler struct {
	svc *service.SRDService
	// Burst limits (10 req/min per user) for the computationally intensive endpoints.
	encounterLimiter *middleware.RateLimiter
	plannerLimiter   *middleware.RateLimiter
}

// heavyRequestsPerMinute is the per-user burst limit for encounter build and spell planner.
const heavyRequestsPerMinute = 10

// limit returns a middleware enforcing the given per-user limiter.
func limit(rl *middleware.RateLimiter) gin.HandlerFunc { return middleware.RateLimitMiddleware(rl) }

// NewSRDHandler creates a new SRDHandler.
func NewSRDHandler(svc *service.SRDService) *SRDHandler {
	return &SRDHandler{
		svc:              svc,
		encounterLimiter: middleware.NewRateLimiter(heavyRequestsPerMinute),
		plannerLimiter:   middleware.NewRateLimiter(heavyRequestsPerMinute),
	}
}

// RegisterRoutes registers all SRD endpoints on the given router group.
func (h *SRDHandler) RegisterRoutes(rg *gin.RouterGroup) {
	srd := rg.Group("/srd")
	{
		srd.GET("/monsters", h.SearchMonsters)
		srd.GET("/monsters/:id", h.GetMonster)
		srd.GET("/spells", h.SearchSpells)
		srd.GET("/spells/:id", h.GetSpell)
		srd.GET("/equipment", h.SearchEquipment)
		srd.GET("/equipment/:id", h.GetEquipment)
		srd.GET("/magic-items", h.SearchMagicItems)
		srd.GET("/magic-items/:id", h.GetMagicItem)
		srd.GET("/classes", h.ListClasses)
		srd.GET("/classes/:name", h.GetClass)
		srd.GET("/races", h.ListRaces)
		srd.GET("/races/:name", h.GetRace)
		srd.GET("/conditions", h.ListConditions)
		srd.GET("/rules", h.SearchRules)
		// Any authenticated user: campaign GMs hold the global role "player", so a global
		// role check here would lock every GM but the first (admin) user out.
		srd.POST("/encounter/build", limit(h.encounterLimiter), h.BuildEncounter)
		srd.POST("/spells/plan", limit(h.plannerLimiter), h.PlanSpells)
		// Homebrew monsters are owned by their creator: editing/deleting is scoped to the
		// owner (or an admin) in the repository, not to a global role.
		srd.POST("/monsters", h.CreateMonster)
		srd.PUT("/monsters/:id", h.UpdateMonster)
		srd.DELETE("/monsters/:id", h.DeleteMonster)
		srd.POST("/loadout/analyze", h.AnalyzeLoadout)
	}
}

// ── Monsters ────────────────────────────────────────────────

func (h *SRDHandler) SearchMonsters(c *gin.Context) {
	var filters domain.MonsterFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Honour explicit zeros (cr_max=0 means "CR 0 only").
	_, filters.HasCRMin = c.GetQuery("cr_min")
	_, filters.HasCRMax = c.GetQuery("cr_max")
	if filters.HasCRMin && c.Query("cr_min") == "" {
		filters.HasCRMin = false
	}
	if filters.HasCRMax && c.Query("cr_max") == "" {
		filters.HasCRMax = false
	}
	result, err := h.svc.SearchMonsters(filters)
	if err != nil {
		log.Printf("srd: search monsters: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search monsters"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *SRDHandler) GetMonster(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid monster ID"})
		return
	}
	monster, err := h.svc.GetMonster(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monster not found"})
		return
	}
	c.JSON(http.StatusOK, monster)
}

// ── Spells ──────────────────────────────────────────────────

func (h *SRDHandler) SearchSpells(c *gin.Context) {
	var filters domain.SpellFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.SearchSpells(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search spells"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *SRDHandler) GetSpell(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid spell ID"})
		return
	}
	spell, err := h.svc.GetSpell(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Spell not found"})
		return
	}
	c.JSON(http.StatusOK, spell)
}

// ── Equipment ───────────────────────────────────────────────

func (h *SRDHandler) SearchEquipment(c *gin.Context) {
	var filters domain.EquipmentFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.SearchEquipment(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search equipment"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *SRDHandler) GetEquipment(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid equipment ID"})
		return
	}
	item, err := h.svc.GetEquipment(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Equipment not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// ── Magic Items ─────────────────────────────────────────────

func (h *SRDHandler) SearchMagicItems(c *gin.Context) {
	var filters domain.MagicItemFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.SearchMagicItems(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search magic items"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *SRDHandler) GetMagicItem(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid magic item ID"})
		return
	}
	item, err := h.svc.GetMagicItem(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Magic item not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// ── Classes ─────────────────────────────────────────────────

func (h *SRDHandler) ListClasses(c *gin.Context) {
	classes, err := h.svc.ListClasses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list classes"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": classes})
}

func (h *SRDHandler) GetClass(c *gin.Context) {
	name := c.Param("name")
	class, err := h.svc.GetClassByName(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Class not found"})
		return
	}
	c.JSON(http.StatusOK, class)
}

// ── Races ───────────────────────────────────────────────────

func (h *SRDHandler) ListRaces(c *gin.Context) {
	races, err := h.svc.ListRaces()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list races"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": races})
}

func (h *SRDHandler) GetRace(c *gin.Context) {
	name := c.Param("name")
	race, err := h.svc.GetRaceByName(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Race not found"})
		return
	}
	c.JSON(http.StatusOK, race)
}

// ── Conditions ──────────────────────────────────────────────

func (h *SRDHandler) ListConditions(c *gin.Context) {
	conditions, err := h.svc.ListConditions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list conditions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conditions})
}

// ── Rules ───────────────────────────────────────────────────

func (h *SRDHandler) SearchRules(c *gin.Context) {
	var filters domain.RulesFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.SearchRules(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search rules"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ── Encounter Builder ───────────────────────────────────────

func (h *SRDHandler) BuildEncounter(c *gin.Context) {
	var req service.EncounterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.BuildEncounter(req)
	if errors.Is(err, service.ErrInvalidDifficulty) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		log.Printf("srd: build encounter: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build encounter"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ── Loadout Analyzer ────────────────────────────────────────

func (h *SRDHandler) AnalyzeLoadout(c *gin.Context) {
	var req service.LoadoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.AnalyzeLoadout(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze loadout"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ── Spell Planner ───────────────────────────────────────────

func (h *SRDHandler) PlanSpells(c *gin.Context) {
	var req service.SpellPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.PlanSpells(req)
	if errors.Is(err, service.ErrClassNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Class not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to plan spells"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ── Homebrew Monsters (GM only, is_srd = FALSE) ─────────────

func (h *SRDHandler) homebrewError(c *gin.Context, err error, fallback string) {
	var ve *service.ValidationError
	switch {
	case errors.As(err, &ve):
		c.JSON(http.StatusBadRequest, gin.H{"error": ve.Msg})
	case errors.Is(err, service.ErrHomebrewNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Homebrew monster not found (imported content is read-only; you can only change your own creatures)"})
	case isUniqueViolation(err):
		c.JSON(http.StatusConflict, gin.H{"error": "A homebrew monster with that name already exists"})
	default:
		log.Printf("srd: homebrew: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fallback})
	}
}

func (h *SRDHandler) CreateMonster(c *gin.Context) {
	var req service.HomebrewMonsterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m, err := h.svc.CreateHomebrewMonster(req, middleware.GetUserID(c))
	if err != nil {
		h.homebrewError(c, err, "Failed to create monster")
		return
	}
	c.JSON(http.StatusCreated, m)
}

func (h *SRDHandler) UpdateMonster(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid monster ID"})
		return
	}
	var req service.HomebrewMonsterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m, err := h.svc.UpdateHomebrewMonster(id, req, middleware.GetUserID(c), middleware.GetUserRole(c) == "admin")
	if err != nil {
		h.homebrewError(c, err, "Failed to update monster")
		return
	}
	c.JSON(http.StatusOK, m)
}

func (h *SRDHandler) DeleteMonster(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid monster ID"})
		return
	}
	if err := h.svc.DeleteHomebrewMonster(id, middleware.GetUserID(c), middleware.GetUserRole(c) == "admin"); err != nil {
		h.homebrewError(c, err, "Failed to delete monster")
		return
	}
	c.Status(http.StatusNoContent)
}

// isUniqueViolation reports a PostgreSQL unique_violation (23505) anywhere in the chain.
func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
