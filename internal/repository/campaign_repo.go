package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *domain.User) error {
	// The first account of an empty installation becomes admin (openspec/specs/lan-deployment.md §5).
	query := `
		INSERT INTO users (username, email, password_hash, avatar_url, role)
		VALUES ($1, $2, $3, $4, CASE WHEN $5 = 'player' AND NOT EXISTS (SELECT 1 FROM users) THEN 'admin' ELSE $5 END)
		RETURNING id, role, created_at, updated_at`
	return r.db.QueryRowxContext(ctx, query, user.Username, user.Email, user.PasswordHash, user.AvatarURL, user.Role).
		Scan(&user.ID, &user.Role, &user.CreatedAt, &user.UpdatedAt)
}

func (r *UserRepository) GetByID(ctx context.Context, id int64) (*domain.User, error) {
	var user domain.User
	query := `SELECT id, username, email, password_hash, avatar_url, role, totp_enabled, created_at, updated_at FROM users WHERE id = $1`
	err := r.db.GetContext(ctx, &user, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	query := `SELECT id, username, email, password_hash, avatar_url, role, totp_enabled, created_at, updated_at FROM users WHERE email = $1`
	err := r.db.GetContext(ctx, &user, query, email)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	var user domain.User
	query := `SELECT id, username, email, password_hash, avatar_url, role, totp_enabled, created_at, updated_at FROM users WHERE username = $1`
	err := r.db.GetContext(ctx, &user, query, username)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) UpdateAvatar(ctx context.Context, userID int64, avatarURL string) error {
	query := `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, avatarURL, userID)
	return err
}

type CampaignRepository struct {
	db *sqlx.DB
}

func NewCampaignRepository(db *sqlx.DB) *CampaignRepository {
	return &CampaignRepository{db: db}
}

func (r *CampaignRepository) Create(ctx context.Context, c *domain.Campaign) error {
	query := `
		INSERT INTO campaigns (name, description, join_code, gm_user_id, status, game_mode, cover_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, bastion_sale_pct, created_at, updated_at`
	return r.db.QueryRowxContext(ctx, query, c.Name, c.Description, c.JoinCode, c.GMUserID, c.Status, c.GameMode, c.CoverURL).
		Scan(&c.ID, &c.BastionSalePct, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CampaignRepository) GetByID(ctx context.Context, id int64) (*domain.Campaign, error) {
	var c domain.Campaign
	query := `SELECT id, name, description, join_code, gm_user_id, status, game_mode, bastion_sale_pct, cover_url, created_at, updated_at FROM campaigns WHERE id = $1`
	err := r.db.GetContext(ctx, &c, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

func (r *CampaignRepository) GetByJoinCode(ctx context.Context, code string) (*domain.Campaign, error) {
	var c domain.Campaign
	query := `SELECT id, name, description, join_code, gm_user_id, status, game_mode, bastion_sale_pct, cover_url, created_at, updated_at FROM campaigns WHERE join_code = $1`
	err := r.db.GetContext(ctx, &c, query, code)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

func (r *CampaignRepository) ListByUser(ctx context.Context, userID int64) ([]domain.Campaign, error) {
	campaigns := []domain.Campaign{}
	query := `
		SELECT c.id, c.name, c.description, c.join_code, c.gm_user_id, c.status, c.game_mode, c.bastion_sale_pct, c.cover_url, c.created_at, c.updated_at
		FROM campaigns c
		JOIN campaign_members cm ON c.id = cm.campaign_id
		WHERE cm.user_id = $1
		ORDER BY c.updated_at DESC`
	err := r.db.SelectContext(ctx, &campaigns, query, userID)
	return campaigns, err
}

func (r *CampaignRepository) Update(ctx context.Context, c *domain.Campaign) error {
	query := `UPDATE campaigns SET name=$1, description=$2, status=$3, bastion_sale_pct=$4, cover_url=$6, updated_at=NOW() WHERE id=$5`
	_, err := r.db.ExecContext(ctx, query, c.Name, c.Description, c.Status, c.BastionSalePct, c.ID, c.CoverURL)
	return err
}

func (r *CampaignRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM campaigns WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *CampaignRepository) AddMember(ctx context.Context, campaignID, userID int64, role string) error {
	query := `INSERT INTO campaign_members (campaign_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, campaignID, userID, role)
	return err
}

func (r *CampaignRepository) RemoveMember(ctx context.Context, campaignID, userID int64) error {
	query := `DELETE FROM campaign_members WHERE campaign_id=$1 AND user_id=$2`
	_, err := r.db.ExecContext(ctx, query, campaignID, userID)
	return err
}

func (r *CampaignRepository) GetMembers(ctx context.Context, campaignID int64) ([]domain.CampaignMember, error) {
	members := []domain.CampaignMember{}
	query := `SELECT cm.campaign_id, cm.user_id, cm.role, cm.joined_at, u.username FROM campaign_members cm JOIN users u ON u.id=cm.user_id WHERE cm.campaign_id=$1 ORDER BY cm.role, u.username`
	err := r.db.SelectContext(ctx, &members, query, campaignID)
	return members, err
}

func (r *CampaignRepository) GetMemberRole(ctx context.Context, campaignID, userID int64) (string, error) {
	var role string
	query := `SELECT role FROM campaign_members WHERE campaign_id=$1 AND user_id=$2`
	err := r.db.GetContext(ctx, &role, query, campaignID, userID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return role, err
}

func (r *CampaignRepository) IsMember(ctx context.Context, campaignID, userID int64) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM campaign_members WHERE campaign_id=$1 AND user_id=$2`
	err := r.db.GetContext(ctx, &count, query, campaignID, userID)
	return count > 0, err
}

func GenerateJoinCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	result := make([]byte, 8)
	if _, err := rand.Read(result); err != nil {
		panic(err)
	}
	for i, b := range result {
		result[i] = chars[b%byte(len(chars))]
	}
	return string(result)
}
