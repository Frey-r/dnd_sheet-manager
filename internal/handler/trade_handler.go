package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/realtime"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type TradeHandler struct {
	tradeSvc *service.TradeService
	charSvc  *service.CharacterService
	limiter  *middleware.RateLimiter
}

// tradeRatePerMinute is the per-player cap on new trade offers (user-stories.md, Rate Limit on Trade Requests).
const tradeRatePerMinute = 5

func NewTradeHandler(tradeSvc *service.TradeService, charSvc *service.CharacterService) *TradeHandler {
	return &TradeHandler{tradeSvc: tradeSvc, charSvc: charSvc, limiter: middleware.NewRateLimiter(tradeRatePerMinute)}
}

// allowNewTrade enforces 5 trade submissions per minute per player; it answers 429 when exceeded.
func (h *TradeHandler) allowNewTrade(c *gin.Context) bool {
	if h.limiter.AllowCategory(middleware.GetUserID(c), "trade-create") {
		return true
	}
	c.Header("Retry-After", "12")
	c.JSON(http.StatusTooManyRequests, gin.H{"error": "Trade rate limit exceeded. Wait before retrying."})
	return false
}

// tradeFail maps trade errors to HTTP statuses; the spec'd messages are returned verbatim.
func tradeFail(c *gin.Context, err error, msg string) {
	var gold *repository.InsufficientGoldError
	switch {
	case errors.As(err, &gold):
		c.JSON(http.StatusBadRequest, gin.H{"error": gold.Error()})
	case errors.Is(err, service.ErrInsufficientGold):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient gold balance"})
	case errors.Is(err, service.ErrTradeInvalidated):
		// The offer was stored as invalidated: tell the campaign so the offeror can redo it.
		c.Set(realtime.ForcedEventKey, "TRADE_INVALIDATED")
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrTradeItem), errors.Is(err, repository.ErrTradeEmpty), errors.Is(err, service.ErrCounterRecipient):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrTradeUnavailable):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "not allowed on this trade"})
	case errors.Is(err, service.ErrNotFound), errors.Is(err, repository.ErrResourceNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "trade not found"})
	default:
		log.Printf("trade: %s: %v", msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
	}
}

func (h *TradeHandler) CreateOffer(c *gin.Context) {
	if !h.allowNewTrade(c) {
		return
	}
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
		tradeFail(c, err, "failed to create trade")
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
		if errors.Is(err, service.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "only recipient can accept"})
			return
		}
		tradeFail(c, err, "failed to accept trade")
		return
	}

	// user-stories.md: the accepted trade is audited with its amounts and items.
	c.Set(realtime.EventDetailsKey, tradeAuditDetails(offer))
	c.JSON(http.StatusOK, offer)
}

func (h *TradeHandler) RejectTrade(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isGM := middleware.IsGM(c)
	tradeID := parseID(c.Param("id"))

	if err := h.tradeSvc.RejectTrade(c.Request.Context(), tradeID, userID, isGM); err != nil {
		tradeFail(c, err, "failed to reject trade")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "trade rejected"})
}

func (h *TradeHandler) CancelTrade(c *gin.Context) {
	userID := middleware.GetUserID(c)
	isGM := middleware.IsGM(c)
	tradeID := parseID(c.Param("id"))

	if err := h.tradeSvc.CancelTrade(c.Request.Context(), tradeID, userID, isGM); err != nil {
		tradeFail(c, err, "failed to cancel trade")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "trade cancelled"})
}

func (h *TradeHandler) List(c *gin.Context) {
	offers, err := h.tradeSvc.List(c.Request.Context(), middleware.GetUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list trades"})
		return
	}
	c.JSON(http.StatusOK, offers)
}

func (h *TradeHandler) CounterOffer(c *gin.Context) {
	if !h.allowNewTrade(c) {
		return
	}
	var req domain.CreateTradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	offer, err := h.tradeSvc.CounterOffer(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), &req)
	if err != nil {
		tradeFail(c, err, "failed to counter trade")
		return
	}
	c.JSON(http.StatusCreated, offer)
}

// tradeAuditDetails is the TRADE_ACCEPTED payload stored in game_events (campaign audit).
func tradeAuditDetails(offer *domain.TradeOffer) map[string]any {
	if offer == nil {
		return nil
	}
	return map[string]any{
		"trade_id":               offer.ID,
		"offeror_character_id":   offer.OfferorCharacterID,
		"recipient_character_id": offer.RecipientCharacterID,
		"offered_gold":           offer.OfferedGold,
		"requested_gold":         offer.RequestedGold,
		"offered_item_ids":       jsonIDs(offer.OfferedItemIDs),
		"requested_item_ids":     jsonIDs(offer.RequestedItemIDs),
	}
}

// jsonIDs keeps a stored JSON id array as raw JSON in the event (empty array when invalid).
func jsonIDs(raw string) json.RawMessage {
	if json.Valid([]byte(raw)) && raw != "" {
		return json.RawMessage(raw)
	}
	return json.RawMessage("[]")
}
