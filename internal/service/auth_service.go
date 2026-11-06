package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/pkg/utils"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserExists         = errors.New("user already exists")
	ErrInvalidToken       = errors.New("invalid token")
	ErrTOTPRequired       = errors.New("totp required")
)

type AuthService struct {
	userRepo  *repository.UserRepository
	jwtConfig config.JWTConfig
}

func NewAuthService(userRepo *repository.UserRepository, jwtConfig config.JWTConfig) *AuthService {
	return &AuthService{userRepo: userRepo, jwtConfig: jwtConfig}
}

func (s *AuthService) GetUserByID(ctx context.Context, id int64) (*domain.User, error) {
	return s.userRepo.GetByID(ctx, id)
}

type JWTClaims struct {
	UserID    int64  `json:"user_id"`
	Role      string `json:"role"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

func (s *AuthService) Register(ctx context.Context, req *domain.CreateUserRequest) (*domain.LoginResponse, error) {
	existing, err := s.userRepo.GetByEmail(ctx, strings.ToLower(strings.TrimSpace(req.Email)))
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrUserExists
	}
	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}
	user := &domain.User{Username: strings.TrimSpace(req.Username), Email: strings.ToLower(strings.TrimSpace(req.Email)), PasswordHash: hash, Role: domain.UserRolePlayer}
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}
	return s.issueSession(ctx, user)
}

func (s *AuthService) Login(ctx context.Context, req *domain.LoginRequest) (*domain.LoginResponse, error) {
	user, err := s.userRepo.GetByEmail(ctx, strings.ToLower(strings.TrimSpace(req.Email)))
	if err != nil || user == nil || !utils.CheckPassword(req.Password, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}
	if user.TOTPEnabled {
		if req.OTP == "" {
			return &domain.LoginResponse{User: *user, RequiresTOTP: true}, nil
		}
		secret, enabled, err := s.userRepo.GetTOTP(ctx, user.ID)
		if err != nil || !enabled || !totp.Validate(req.OTP, secret) {
			return nil, ErrInvalidCredentials
		}
	}
	return s.issueSession(ctx, user)
}

func (s *AuthService) issueSession(ctx context.Context, user *domain.User) (*domain.LoginResponse, error) {
	token, err := s.generateToken(user, user.Role, 0)
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.userRepo.CreateRefreshSession(ctx, user.ID, time.Duration(s.jwtConfig.RefreshTTL)*time.Second)
	if err != nil {
		return nil, err
	}
	return &domain.LoginResponse{Token: token, RefreshToken: refreshToken, User: *user}, nil
}

func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (any, error) {
		return []byte(s.jwtConfig.Secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*JWTClaims)
	if !ok || claims.TokenType != "access" || claims.UserID < 1 {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*domain.LoginResponse, error) {
	userID, newRefresh, err := s.userRepo.RotateRefreshSession(ctx, refreshToken, time.Duration(s.jwtConfig.RefreshTTL)*time.Second)
	if err != nil {
		return nil, ErrInvalidToken
	}
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, ErrInvalidToken
	}
	token, err := s.generateToken(user, user.Role, 0)
	if err != nil {
		return nil, err
	}
	return &domain.LoginResponse{Token: token, RefreshToken: newRefresh, User: *user}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.userRepo.RevokeRefreshSession(ctx, refreshToken)
}

func (s *AuthService) SetupTOTP(ctx context.Context, userID int64) (string, string, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return "", "", ErrInvalidToken
	}
	key, err := totp.Generate(totp.GenerateOpts{Issuer: "D&D Campaign Manager", AccountName: user.Email})
	if err != nil {
		return "", "", err
	}
	if err := s.userRepo.SetTOTP(ctx, userID, key.Secret(), false); err != nil {
		return "", "", err
	}
	return key.Secret(), key.URL(), nil
}

func (s *AuthService) EnableTOTP(ctx context.Context, userID int64, code string) error {
	secret, _, err := s.userRepo.GetTOTP(ctx, userID)
	if err != nil || secret == "" || !totp.Validate(code, secret) {
		return ErrInvalidCredentials
	}
	if err := s.userRepo.SetTOTP(ctx, userID, secret, true); err != nil {
		return err
	}
	return s.userRepo.RevokeAllRefreshSessions(ctx, userID)
}

func (s *AuthService) DisableTOTP(ctx context.Context, userID int64, code string) error {
	secret, enabled, err := s.userRepo.GetTOTP(ctx, userID)
	if err != nil || !enabled || !totp.Validate(code, secret) {
		return ErrInvalidCredentials
	}
	if err := s.userRepo.SetTOTP(ctx, userID, "", false); err != nil {
		return err
	}
	return s.userRepo.RevokeAllRefreshSessions(ctx, userID)
}

func (s *AuthService) ChangePassword(ctx context.Context, userID int64, oldPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil || !utils.CheckPassword(oldPassword, user.PasswordHash) {
		return ErrInvalidCredentials
	}
	hash, err := utils.HashPassword(newPassword)
	if err != nil {
		return err
	}
	if err := s.userRepo.UpdatePassword(ctx, userID, hash); err != nil {
		return err
	}
	return s.userRepo.RevokeAllRefreshSessions(ctx, userID)
}

func (s *AuthService) generateToken(user *domain.User, role string, campaignID int64) (string, error) {
	claims := JWTClaims{UserID: user.ID, Role: role, TokenType: "access", RegisteredClaims: jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.jwtConfig.TTL) * time.Second)),
		IssuedAt:  jwt.NewNumericDate(time.Now()), Subject: user.Email,
	}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtConfig.Secret))
}

func (s *AuthService) UpdateProfile(ctx context.Context, userID int64, username, avatarURL string) error {
	return s.userRepo.UpdateProfile(ctx, userID, username, avatarURL)
}

func (s *AuthService) GenerateCampaignToken(userID int64, role, campaignID string) (string, error) {
	user, err := s.userRepo.GetByID(context.Background(), userID)
	if err != nil || user == nil {
		return "", ErrInvalidToken
	}
	return s.generateToken(user, role, 0)
}
