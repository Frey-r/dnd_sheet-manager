package handler

import (
	"net/http"
	"strconv"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/service"
	"github.com/gin-gonic/gin"
)

// SRDHandler handles all SRD reference data REST endpoints.
type SRDHandler struct {
	svc *service.SRDService
}

// NewSRDHandler creates a new SRDHandler.
func NewSRDHandler(svc *service.SRDService) *SRDHandler {
	return &SRDHandler{svc: svc}
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
		srd.POST("/encounter/build", h.BuildEncounter)
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
	result, err := h.svc.SearchMonsters(filters)
	if err != nil {
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
	if err != nil {
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
