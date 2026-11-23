package middleware

import (
	"net/http"
	"strconv"
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

		// Campaign context is intentionally NOT a JWT claim (security.md asks for it):
		// a user belongs to several campaigns with different roles, memberships can be
		// revoked or the GM changed while a token is still valid, and the SPA uses one
		// token across campaigns. Embedding it would be stale and break multi-campaign
		// use, so RBACMiddleware resolves campaign_id/campaign_role from the database
		// on every request (authoritative and immediately revocable).
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
		// POST /campaigns/:id/join resolves the campaign from the join code, not from :id
		// (a player does not know the id yet; the UI sends 0), so it skips the id checks.
		isJoin := strings.HasSuffix(c.Request.URL.Path, "/join")
		if campaignIDStr != "" && strings.HasPrefix(c.Request.URL.Path, "/api/campaigns/") && !isJoin {
			campaignID, err := strconv.ParseInt(campaignIDStr, 10, 64)
			if err != nil || campaignID < 1 {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid campaign id"})
				return
			}
			{
				role, err := campaignSvc.GetMemberRole(c.Request.Context(), campaignID, userID.(int64))
				if err != nil {
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "could not verify membership"})
					return
				}
				if role == "" {
					SetAuditCampaign(c, campaignID)
					SetAuditReason(c, "campaign membership required")
					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "campaign membership required"})
					return
				}
				SetAuditCampaign(c, campaignID)
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
		SetAuditReason(c, "insufficient permissions: role "+role+" not in "+strings.Join(allowedRoles, ","))
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

func IsGM(c *gin.Context) bool {
	if isGM, exists := c.Get("is_gm"); exists {
		return isGM.(bool)
	}
	return false
}
