package realtime

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func (h *Hub) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Writer.Status() < 200 || c.Writer.Status() >= 300 || (c.Request.Method != http.MethodPost && c.Request.Method != http.MethodPut && c.Request.Method != http.MethodDelete) {
			return
		}
		path := c.Request.URL.Path
		// VTT and uploads publish their own fine-grained events (openspec/specs/vtt.md §7).
		if strings.Contains(path, "/vtt/") || strings.HasSuffix(path, "/uploads") {
			return
		}
		var campaignID int64
		switch {
		case strings.HasPrefix(path, "/api/campaigns/"):
			campaignID, _ = strconv.ParseInt(c.Param("id"), 10, 64)
		case strings.HasPrefix(path, "/api/characters/"):
			characterID, err := strconv.ParseInt(c.Param("id"), 10, 64)
			if err == nil {
				_ = h.db.QueryRowContext(c.Request.Context(), `SELECT campaign_id FROM characters WHERE id=$1`, characterID).Scan(&campaignID)
			}
		case strings.HasPrefix(path, "/api/trades/"):
			tradeID, err := strconv.ParseInt(c.Param("id"), 10, 64)
			if err == nil {
				_ = h.db.QueryRowContext(c.Request.Context(), `SELECT campaign_id FROM trade_offers WHERE id=$1`, tradeID).Scan(&campaignID)
			}
		}
		if campaignID < 1 {
			return
		}
		userID, _ := c.Get("user_id")
		actorID, _ := userID.(int64)
		payload := map[string]any{"path": path, "method": c.Request.Method}
		if err := h.Publish(c.Request.Context(), campaignID, actorID, "state.changed", payload); err != nil {
			_ = c.Error(err)
		}
		// Typed event names from resilience.md, published in addition to the generic
		// state.changed the SPA relies on.
		role, _ := c.Get("campaign_role")
		roleStr, _ := role.(string)
		if eventType := TypedEventName(c.Request.Method, path, roleStr); eventType != "" {
			if err := h.Publish(c.Request.Context(), campaignID, actorID, eventType, payload); err != nil {
				_ = c.Error(err)
			}
		}
	}
}

// TypedEventName maps a successful REST mutation to the typed realtime event of
// resilience.md (Message Contract). It returns "" when the mutation has no typed event.
func TypedEventName(method, path, campaignRole string) string {
	segments := strings.Split(strings.Trim(path, "/"), "/") // api, <resource>, <id>, ...
	if len(segments) < 3 || segments[0] != "api" {
		return ""
	}
	switch segments[1] {
	case "trades":
		if len(segments) < 4 {
			return ""
		}
		switch segments[3] {
		case "accept":
			return "TRADE_ACCEPTED"
		case "reject":
			return "TRADE_REJECTED"
		case "cancel":
			return "TRADE_CANCELLED" // not in the spec list; kept distinct from a rejection
		case "counter":
			return "TRADE_OFFER"
		}
	case "characters":
		switch {
		case len(segments) >= 4 && segments[3] == "trades":
			return "TRADE_OFFER"
		case len(segments) >= 6 && segments[3] == "spells" && segments[5] == "cast":
			return "SPELL_CAST"
		}
		return "CHARACTER_UPDATE"
	case "campaigns":
		if len(segments) == 5 && segments[3] == "combat" && segments[4] == "encounter" && method == http.MethodPost {
			return "ENCOUNTER_STARTED"
		}
		// market-bastions.md §6.4: when the GM runs a Bastion turn "owners are notified".
		if len(segments) == 5 && segments[3] == "bastions" && segments[4] == "turn" && method == http.MethodPost {
			return "BASTION_TURN"
		}
		if len(segments) == 4 && segments[3] == "messages" && method == http.MethodPost {
			if campaignRole == "gm" {
				return "MESSAGE_GM"
			}
			return "MESSAGE_PLAYER"
		}
	}
	return ""
}
