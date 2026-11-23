package handler

import (
	"net/http"
	"strings"

	"dnd-campaign-manager/internal/middleware"

	"github.com/gin-gonic/gin"
)

func (h *AuthHandler) Logout(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.authSvc.Logout(c.Request.Context(), req.RefreshToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not log out"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) SetupTOTP(c *gin.Context) {
	secret, url, err := h.authSvc.SetupTOTP(c.Request.Context(), middleware.GetUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not setup 2FA"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"secret": secret, "otpauth_url": url})
}

func (h *AuthHandler) EnableTOTP(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required,len=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.authSvc.EnableTOTP(c.Request.Context(), middleware.GetUserID(c), strings.TrimSpace(req.Code)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid verification code"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"enabled": true})
}

func (h *AuthHandler) DisableTOTP(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required,len=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.authSvc.DisableTOTP(c.Request.Context(), middleware.GetUserID(c), strings.TrimSpace(req.Code)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid verification code"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"enabled": false})
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.authSvc.ChangePassword(c.Request.Context(), middleware.GetUserID(c), req.CurrentPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is invalid"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "password changed; sign in again"})
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	var req struct {
		Username  string `json:"username" binding:"required,min=3,max=50"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userID := middleware.GetUserID(c)
	if err := h.authSvc.UpdateProfile(c.Request.Context(), userID, strings.TrimSpace(req.Username), strings.TrimSpace(req.AvatarURL)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update profile"})
		return
	}
	user, err := h.authSvc.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load profile"})
		return
	}
	c.JSON(http.StatusOK, user)
}
