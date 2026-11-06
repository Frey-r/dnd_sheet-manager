package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

func CharacterAuthorizationMiddleware(charSvc *service.CharacterService) gin.HandlerFunc {
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
		isGM, err := charSvc.Authorize(c.Request.Context(), characterID, GetUserID(c))
		if err != nil {
			status := http.StatusForbidden
			if err == service.ErrNotFound {
				status = http.StatusNotFound
			}
			c.AbortWithStatusJSON(status, gin.H{"error": "character access denied"})
			return
		}
		c.Set("is_gm", isGM)
		c.Next()
	}
}
