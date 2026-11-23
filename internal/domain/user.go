package domain

import "time"

// User-level role constants (global, not per-campaign)
const (
	UserRoleAdmin  = "admin"
	UserRoleDM     = "dm"
	UserRolePlayer = "player"
)

type User struct {
	ID           int64     `db:"id" json:"id"`
	Username     string    `db:"username" json:"username"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	AvatarURL    string    `db:"avatar_url" json:"avatar_url"`
	Role         string    `db:"role" json:"role"`
	TOTPEnabled  bool      `db:"totp_enabled" json:"totp_enabled"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type CreateUserRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	OTP      string `json:"otp"`
}

type LoginResponse struct {
	Token        string `json:"token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	User         User   `json:"user"`
	RequiresTOTP bool   `json:"requires_totp,omitempty"`
}
