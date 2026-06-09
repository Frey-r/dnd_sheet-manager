package handler

import (
	"net/http"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type TradeHandler struct {
	tradeSvc   *service.TradeService
	charSvc    *service.CharacterService
}

func NewTradeHandler(tradeSvc *service.TradeService, charSvc *service.CharacterService) *TradeHandler {
	return &TradeHandler{tradeSvc: tradeSvc, charSvc: charSvc}
}

func (h *TradeHandler) CreateOffer(c *gin.Context) {
	var req domain.CreateTradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	isGM := middleware.IsGM(c)

	offerorCharID := parseID(c.Param("id"))
	offer, err := h.tradeSvc.CreateOffer(c.Request.Context(), offerorCharID, userID, isGM, &req)
	if err != nil {
		if err == service.ErrInsufficientGold {
			c.JSON(http.StatusBadRequest, gin.H{"error": "insufficient gold"})
			return
		}
		if err == service.ErrItemNotTradeable || err == service.ErrItemQuestBound {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create trade"})
		return
	}

	c.JSON(http.StatusCreated, offer)
}

func (h *TradeHandler) AcceptTrade(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isGM := middleware.IsGM(c)
	tradeID := parseID(c.Param("id"))

	offer, err := h.tradeSvc.AcceptTrade(c.Request.Context(), tradeID, userID, isGM)
	if err != nil {
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only recipient can accept"})
			return
		}
		if err == service.ErrInsufficientGold {
			c.JSON(http.StatusBadRequest, gin.H{"error": "insufficient gold for trade"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept trade"})
		return
	}

	c.JSON(http.StatusOK, offer)
}

func (h *TradeHandler) RejectTrade(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isGM := middleware.IsGM(c)
	tradeID := parseID(c.Param("id"))

	if err := h.tradeSvc.RejectTrade(c.Request.Context(), tradeID, userID, isGM); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject trade"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "trade rejected"})
}

func (h *TradeHandler) CancelTrade(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isGM := middleware.IsGM(c)
	tradeID := parseID(c.Param("id"))

	if err := h.tradeSvc.CancelTrade(c.Request.Context(), tradeID, userID, isGM); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel trade"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "trade cancelled"})
}