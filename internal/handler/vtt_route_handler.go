package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// routeTarget loads the token and its scene for a GM route request; it answers the error itself.
func (h *VTTHandler) routeTarget(c *gin.Context) (*domain.VTTScene, *domain.VTTToken, bool) {
	if !requireGM(c) {
		return nil, nil, false
	}
	if h.play == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "routes are not available"})
		return nil, nil, false
	}
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	token, err := h.repo.GetToken(ctx, campaignID, parseID(c.Param("token_id")))
	if err != nil {
		h.fail(c, err, "could not load token")
		return nil, nil, false
	}
	scene, err := h.repo.GetScene(ctx, campaignID, token.SceneID)
	if err != nil {
		h.fail(c, err, "could not load scene")
		return nil, nil, false
	}
	return scene, token, true
}

// routeDone answers a route change: 400 with a safe message for invalid routes, else the token.
func (h *VTTHandler) routeDone(c *gin.Context, token *domain.VTTToken, err error) {
	var invalid service.RouteError
	switch {
	case errors.As(err, &invalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": invalid.Error()})
	case errors.Is(err, service.ErrRouteNotAllowed):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case err != nil:
		h.fail(c, err, "could not save route")
	default:
		token.RouteClock = service.RouteClockView(*token, time.Now())
		c.JSON(http.StatusOK, token)
	}
}

// SetRoute: PUT …/tokens/:token_id/route with {mode, points} or null (vtt-npc-routines.md §7).
func (h *VTTHandler) SetRoute(c *gin.Context) {
	scene, token, ok := h.routeTarget(c)
	if !ok {
		return
	}
	// An empty body or JSON null removes the route.
	raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 64<<10))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	var route *domain.Route
	if len(bytes.TrimSpace(raw)) > 0 {
		if err := json.Unmarshal(raw, &route); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
	}
	h.routeDone(c, token, h.play.SetRoute(c.Request.Context(), scene, token, route))
}

// RouteAction: POST …/tokens/:token_id/route/{pause,resume,restart}.
func (h *VTTHandler) RouteAction(c *gin.Context) {
	action := c.Param("action")
	if action != "pause" && action != "resume" && action != "restart" {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	scene, token, ok := h.routeTarget(c)
	if !ok {
		return
	}
	if token.Route == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "the token has no route"})
		return
	}
	ctx := c.Request.Context()
	var err error
	switch action {
	case "pause":
		err = h.play.PauseRoute(ctx, scene, token)
	case "resume":
		err = h.play.ResumeRoute(ctx, scene, token)
	default:
		err = h.play.RestartRoute(ctx, scene, token)
	}
	h.routeDone(c, token, err)
}

// afterTokenUpdate keeps a route token in place when its speed changed and drops the route of a
// token turned into a player token.
func (h *VTTHandler) afterTokenUpdate(c *gin.Context, before, token *domain.VTTToken) {
	if h.play == nil || token.Route == nil {
		return
	}
	ctx := c.Request.Context()
	scene, err := h.repo.GetScene(ctx, token.CampaignID, token.SceneID)
	if err != nil {
		log.Printf("vtt: route scene of token %d: %v", token.ID, err)
		return
	}
	if token.Kind == "pc" {
		err = h.play.SetRoute(ctx, scene, token, nil)
	} else {
		err = h.play.RetimeRoute(ctx, scene, token, service.RouteRate(scene, before.SpeedFt))
	}
	if err != nil {
		log.Printf("vtt: route after token update %d: %v", token.ID, err)
	}
}
