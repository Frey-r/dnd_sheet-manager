package handler

import (
	"net/http"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authSvc *service.AuthService
}

func NewAuthHandler(authSvc *service.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req domain.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authSvc.Register(c.Request.Context(), &req)
	if err != nil {
		if err == service.ErrUserExists {
			c.JSON(http.StatusConflict, gin.H{"error": "user already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authSvc.Login(c.Request.Context(), &req)
	if err != nil {
		if err == service.ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authSvc.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	user, err := h.authSvc.GetUserByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

type CampaignHandler struct {
	campaignSvc *service.CampaignService
	charSvc     *service.CharacterService
	itemRepo    *repository.ItemRepository
	tradeSvc    *service.TradeService
}

func NewCampaignHandler(campaignSvc *service.CampaignService, charSvc *service.CharacterService, itemRepo *repository.ItemRepository, tradeSvc *service.TradeService) *CampaignHandler {
	return &CampaignHandler{campaignSvc: campaignSvc, charSvc: charSvc, itemRepo: itemRepo, tradeSvc: tradeSvc}
}

func (h *CampaignHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	campaigns, err := h.campaignSvc.ListByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list campaigns"})
		return
	}

	c.JSON(http.StatusOK, campaigns)
}

func (h *CampaignHandler) Create(c *gin.Context) {
	var req domain.CreateCampaignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	campaign, err := h.campaignSvc.Create(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create campaign"})
		return
	}

	c.JSON(http.StatusCreated, campaign)
}

func (h *CampaignHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	campaignID := parseID(c.Param("id"))

	campaign, err := h.campaignSvc.GetByID(c.Request.Context(), campaignID, userID)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "campaign not found"})
			return
		}
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get campaign"})
		return
	}

	c.JSON(http.StatusOK, campaign)
}

func (h *CampaignHandler) Update(c *gin.Context) {
	var req domain.UpdateCampaignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	campaignID := parseID(c.Param("id"))

	campaign, err := h.campaignSvc.Update(c.Request.Context(), campaignID, userID, &req)
	if err != nil {
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only GM can update campaign"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update campaign"})
		return
	}

	c.JSON(http.StatusOK, campaign)
}

func (h *CampaignHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	campaignID := parseID(c.Param("id"))

	err := h.campaignSvc.Delete(c.Request.Context(), campaignID, userID)
	if err != nil {
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only GM can delete campaign"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete campaign"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "campaign deleted"})
}

func (h *CampaignHandler) Join(c *gin.Context) {
	var req domain.JoinCampaignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	campaign, err := h.campaignSvc.Join(c.Request.Context(), userID, req.JoinCode)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "campaign not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join campaign"})
		return
	}

	c.JSON(http.StatusOK, campaign)
}

func (h *CampaignHandler) GetMembers(c *gin.Context) {
	userID := middleware.GetUserID(c)
	campaignID := parseID(c.Param("id"))

	members, err := h.campaignSvc.GetMembers(c.Request.Context(), campaignID, userID)
	if err != nil {
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

func (h *CampaignHandler) GetCharacters(c *gin.Context) {
	userID := middleware.GetUserID(c)
	campaignID := parseID(c.Param("id"))

	// Check membership first
	isMember, err := h.campaignSvc.IsMember(c.Request.Context(), campaignID, userID)
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	chars, err := h.charSvc.ListByCampaign(c.Request.Context(), campaignID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get characters"})
		return
	}

	c.JSON(http.StatusOK, chars)
}

func parseID(s string) int64 {
	var id int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			id = id*10 + int64(c-'0')
		} else {
			return 0
		}
	}
	return id
}

func (h *CampaignHandler) GetMarketplace(c *gin.Context) {
	campaignID := parseID(c.Param("id"))
	items, err := h.itemRepo.GetMarketplaceItems(c.Request.Context(), campaignID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list marketplace items"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *CampaignHandler) CreateMarketplaceItem(c *gin.Context) {
	campaignID := parseID(c.Param("id"))
	userID := middleware.GetUserID(c)

	camp, err := h.campaignSvc.GetByID(c.Request.Context(), campaignID, userID)
	if err != nil || camp.GMUserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only GM can add items to marketplace"})
		return
	}

	var req struct {
		Name               string  `json:"name" binding:"required"`
		ItemType           string  `json:"item_type" binding:"required"`
		Rarity             string  `json:"rarity"`
		Price              int     `json:"price" binding:"required"`
		Weight             float64 `json:"weight"`
		Description        string  `json:"description"`
		AttunementRequired bool    `json:"attunement_required"`
		SRDRefID           *int64  `json:"srd_ref_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mItem := &domain.MarketplaceItem{
		CampaignID:         campaignID,
		Name:               req.Name,
		ItemType:           domain.ItemType(req.ItemType),
		Rarity:             domain.Rarity(req.Rarity),
		Price:              req.Price,
		Weight:             req.Weight,
		Description:        req.Description,
		AttunementRequired: req.AttunementRequired,
		SRDRefID:           req.SRDRefID,
	}

	if err := h.itemRepo.CreateMarketplaceItem(c.Request.Context(), mItem); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create marketplace item"})
		return
	}

	c.JSON(http.StatusCreated, mItem)
}

func (h *CampaignHandler) PurchaseMarketplaceItem(c *gin.Context) {
	campaignID := parseID(c.Param("id"))
	userID := middleware.GetUserID(c)
	var req struct {
		ItemID int64 `json:"item_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	char, err := h.charSvc.GetByUserAndCampaign(c.Request.Context(), userID, campaignID)
	if err != nil || char == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no character found in this campaign"})
		return
	}
	if err := h.tradeSvc.Purchase(c.Request.Context(), campaignID, req.ItemID, char.ID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "purchase successful"})
}

// TradeableItems lists the tradeable items of a character of this campaign for the trade
// picker. Any member may call it (RBAC checks membership); it returns only trade-relevant
// fields instead of the full inventory, which stays owner/GM-only.
func (h *CampaignHandler) TradeableItems(c *gin.Context) {
	items, err := h.itemRepo.TradeableByCharacter(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("character_id")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load items"})
		return
	}
	c.JSON(http.StatusOK, items)
}
