package middleware

import (
	"net/http"
	"strings"

	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(authSvc *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			return
		}

		tokenString := parts[1]
		claims, err := authSvc.ValidateToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func RBACMiddleware(campaignSvc *service.CampaignService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		userID, exists := c.Get("user_id")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
			return
		}

		campaignIDStr := c.Param("id")
		if campaignIDStr == "" {
			campaignIDStr = c.Param("campaign_id")
		}

		if campaignIDStr != "" {
			// Try to parse campaign ID
			campID := int64(0)
			for _, ch := range campaignIDStr {
				if ch >= '0' && ch <= '9' {
					campID = campID*10 + int64(ch-'0')
				} else {
					break
				}
			}
			if campID > 0 {
				role, _ := campaignSvc.GetMemberRole(c.Request.Context(), campID, userID.(int64))
				c.Set("campaign_role", role)
				c.Set("is_gm", role == "gm")
			}
		}

		c.Next()
	}
}

func GetUserID(c *gin.Context) int64 {
	if id, exists := c.Get("user_id"); exists {
		return id.(int64)
	}
	return 0
}

func GetRole(c *gin.Context) string {
	if role, exists := c.Get("role"); exists {
		if r, ok := role.(string); ok {
			return r
		}
	}
	return ""
}

// GetUserRole returns the global user role (admin, dm, player) from the JWT claims.
func GetUserRole(c *gin.Context) string {
	return GetRole(c)
}

// RequireRole returns a middleware that allows access only if the user's role is in the allowed list.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}
		role := GetRole(c)
		for _, allowed := range allowedRoles {
			if role == allowed {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

func IsGM(c *gin.Context) bool {
	if isGM, exists := c.Get("is_gm"); exists {
		return isGM.(bool)
	}
	return false
}