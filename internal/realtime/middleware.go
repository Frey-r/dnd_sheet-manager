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
		if err := h.Publish(c.Request.Context(), campaignID, actorID, "state.changed", map[string]any{"path": path, "method": c.Request.Method}); err != nil {
			_ = c.Error(err)
		}
	}
}
