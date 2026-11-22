package middleware

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// CharacterAuthorizer is the slice of CharacterService this middleware needs.
type CharacterAuthorizer interface {
	AuthorizeInCampaign(ctx context.Context, charID, userID int64) (bool, int64, error)
}

func CharacterAuthorizationMiddleware(charSvc CharacterAuthorizer) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, "/api/characters/") || c.Param("id") == "" {
			c.Next()
			return
		}
		characterID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || characterID < 1 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid character id"})
			return
		}
		isGM, campaignID, err := charSvc.AuthorizeInCampaign(c.Request.Context(), characterID, GetUserID(c))
		if campaignID > 0 {
			SetAuditCampaign(c, campaignID)
		}
		if err != nil {
			status := http.StatusForbidden
			if err == service.ErrNotFound {
				status = http.StatusNotFound
			} else {
				SetAuditReason(c, "character not owned by user")
			}
			c.AbortWithStatusJSON(status, gin.H{"error": "character access denied"})
			return
		}
		c.Set("is_gm", isGM)
		c.Next()
	}
}
