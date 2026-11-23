package realtime

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ForcedEventKey is the gin context key a handler sets to publish a typed event even though
// the request answers with an error status.
const ForcedEventKey = "realtime_event"

// EventDetailsKey is the gin context key a handler sets (map[string]any) to add fields to the
// typed event payload, e.g. the amounts of an accepted trade for the campaign audit trail.
const EventDetailsKey = "realtime_event_details"

func (h *Hub) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		// A handler may name a typed event for a failed request that still changed state, e.g.
		// an accept that invalidated the trade (409) must tell the offeror (TRADE_INVALIDATED).
		forced := c.GetString(ForcedEventKey)
		if !shouldPublish(c.Writer.Status(), c.Request.Method, forced) {
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
		// actor_id lets clients skip notices about their own actions.
		payload := map[string]any{"path": path, "method": c.Request.Method, "actor_id": actorID}
		if err := h.Publish(c.Request.Context(), campaignID, actorID, "state.changed", payload); err != nil {
			_ = c.Error(err)
		}
		// Typed event names from resilience.md, published in addition to the generic
		// state.changed the SPA relies on.
		role, _ := c.Get("campaign_role")
		roleStr, _ := role.(string)
		if eventType := typedEventFor(c.Writer.Status(), c.Request.Method, path, roleStr, forced); eventType != "" {
			typed := payload
			if details, ok := c.Get(EventDetailsKey); ok {
				if extra, ok := details.(map[string]any); ok {
					typed = make(map[string]any, len(payload)+len(extra))
					for k, v := range extra {
						typed[k] = v
					}
					typed["path"], typed["method"], typed["actor_id"] = path, c.Request.Method, actorID
				}
			}
			if err := h.Publish(c.Request.Context(), campaignID, actorID, eventType, typed); err != nil {
				_ = c.Error(err)
			}
		}
	}
}

// shouldPublish reports whether a finished request produces realtime events: successful
// mutations always do; a failed one only when its handler forced an event.
func shouldPublish(status int, method, forced string) bool {
	if method != http.MethodPost && method != http.MethodPut && method != http.MethodDelete {
		return false
	}
	return (status >= 200 && status < 300) || forced != ""
}

// typedEventFor picks the typed event of a request: the forced one for a failed request,
// otherwise the one mapped from the route.
func typedEventFor(status int, method, path, role, forced string) string {
	if status < 200 || status >= 300 {
		return forced
	}
	return TypedEventName(method, path, role)
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
		// resilience.md Message Contract: an Oracle query is a LORE_QUERY event.
		if len(segments) == 5 && segments[3] == "lore" && segments[4] == "search" && method == http.MethodPost {
			return "LORE_QUERY"
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
