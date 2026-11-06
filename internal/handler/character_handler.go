package handler

import (
	"net/http"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type CharacterHandler struct {
	charSvc     *service.CharacterService
	campaignSvc *service.CampaignService
}

func NewCharacterHandler(charSvc *service.CharacterService, campaignSvc *service.CampaignService) *CharacterHandler {
	return &CharacterHandler{charSvc: charSvc, campaignSvc: campaignSvc}
}

func (h *CharacterHandler) Create(c *gin.Context) {
	var req domain.CreateCharacterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	char, err := h.charSvc.Create(c.Request.Context(), userID, &req)
	if err != nil {
		switch err {
		case service.ErrInvalidAbilityScore:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case service.ErrForbidden:
			c.JSON(http.StatusForbidden, gin.H{"error": "campaign membership required"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create character"})
		}
		return
	}

	c.JSON(http.StatusCreated, char)
}

func (h *CharacterHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	charID := parseID(c.Param("id"))
	isGM := middleware.IsGM(c)

	char, err := h.charSvc.GetByID(c.Request.Context(), charID, userID, isGM)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "character not found"})
			return
		}
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get character"})
		return
	}

	c.JSON(http.StatusOK, char)
}

func (h *CharacterHandler) Update(c *gin.Context) {
	var req domain.UpdateCharacterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	charID := parseID(c.Param("id"))
	isGM := middleware.IsGM(c)

	char, err := h.charSvc.Update(c.Request.Context(), charID, userID, isGM, &req)
	if err != nil {
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update character"})
		return
	}

	c.JSON(http.StatusOK, char)
}

func (h *CharacterHandler) UpdateHP(c *gin.Context) {
	var req struct {
		CurrentHP int `json:"current_hp"`
		TempHP    int `json:"temp_hp"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	charID := parseID(c.Param("id"))
	isGM := middleware.IsGM(c)

	if err := h.charSvc.UpdateHP(c.Request.Context(), charID, userID, isGM, req.CurrentHP, req.TempHP); err != nil {
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update HP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "HP updated"})
}

func (h *CharacterHandler) LongRest(c *gin.Context) {
	charID := parseID(c.Param("id"))

	if err := h.charSvc.Rest(c.Request.Context(), charID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to perform long rest"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "long rest completed"})
}

func (h *CharacterHandler) GetInventory(c *gin.Context) {
	charID := parseID(c.Param("id"))

	items, err := h.charSvc.GetInventory(c.Request.Context(), charID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get inventory"})
		return
	}

	c.JSON(http.StatusOK, items)
}

func (h *CharacterHandler) GetSpells(c *gin.Context) {
	charID := parseID(c.Param("id"))

	spells, err := h.charSvc.GetSpells(c.Request.Context(), charID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get spells"})
		return
	}

	c.JSON(http.StatusOK, spells)
}

func (h *CharacterHandler) GetSpellSlots(c *gin.Context) {
	charID := parseID(c.Param("id"))

	slots, err := h.charSvc.GetSpellSlots(c.Request.Context(), charID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get spell slots"})
		return
	}

	c.JSON(http.StatusOK, slots)
}

func (h *CharacterHandler) CastSpell(c *gin.Context) {
	charID := parseID(c.Param("id"))
	spellID := parseID(c.Param("spellId"))
	slots, err := h.charSvc.CastSpell(c.Request.Context(), charID, spellID)
	if err != nil {
		switch err {
		case service.ErrNoSpellSlots:
			c.JSON(http.StatusConflict, gin.H{"error": "no quedan espacios de conjuro de ese nivel"})
		case service.ErrNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "spell not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cast spell"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "spell cast", "spell_slots": slots})
}

func (h *CharacterHandler) GetFeatures(c *gin.Context) {
	charID := parseID(c.Param("id"))

	features, err := h.charSvc.GetFeatures(c.Request.Context(), charID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get features"})
		return
	}

	c.JSON(http.StatusOK, features)
}

func (h *CharacterHandler) AddSpell(c *gin.Context) {
	charID := parseID(c.Param("id"))
	var req domain.CreateSpellRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	spell, err := h.charSvc.AddSpell(c.Request.Context(), charID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add spell"})
		return
	}

	c.JSON(http.StatusCreated, spell)
}

func (h *CharacterHandler) AddItem(c *gin.Context) {
	charID := parseID(c.Param("id"))
	var req domain.CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.charSvc.AddItem(c.Request.Context(), charID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add item"})
		return
	}

	c.JSON(http.StatusCreated, item)
}

func (h *CharacterHandler) RemoveItem(c *gin.Context) {
	charID := parseID(c.Param("id"))
	itemID := parseID(c.Param("itemId"))

	if err := h.charSvc.RemoveItem(c.Request.Context(), charID, itemID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove item"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "item removed"})
}

func (h *CharacterHandler) EquipItem(c *gin.Context) {
	charID := parseID(c.Param("id"))
	itemID := parseID(c.Param("itemId"))

	if err := h.charSvc.EquipItem(c.Request.Context(), charID, itemID); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "equip status toggled"})
}

func (h *CharacterHandler) UpdateItem(c *gin.Context) {
	var req domain.UpdateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.charSvc.UpdateItem(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("itemId")), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}
