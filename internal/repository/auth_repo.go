package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"time"
)

type RefreshSession struct {
	ID     string
	UserID int64
}

func (r *UserRepository) CreateRefreshSession(ctx context.Context, userID int64, ttl time.Duration) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	id, err := randomToken(16)
	if err != nil {
		return "", err
	}
	hash := hashToken(token)
	_, err = r.db.ExecContext(ctx, `INSERT INTO refresh_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)`, id, userID, hash, time.Now().Add(ttl))
	return token, err
}

func (r *UserRepository) RotateRefreshSession(ctx context.Context, token string, ttl time.Duration) (int64, string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, "", err
	}
	defer tx.Rollback()
	var session RefreshSession
	var expires time.Time
	var revoked *time.Time
	err = tx.QueryRowContext(ctx, `SELECT id,user_id,expires_at,revoked_at FROM refresh_sessions WHERE token_hash=$1 FOR UPDATE`, hashToken(token)).Scan(&session.ID, &session.UserID, &expires, &revoked)
	if err != nil {
		return 0, "", err
	}
	if revoked != nil || time.Now().After(expires) {
		return 0, "", sql.ErrNoRows
	}
	newToken, err := randomToken(32)
	if err != nil {
		return 0, "", err
	}
	newID, err := randomToken(16)
	if err != nil {
		return 0, "", err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO refresh_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)`, newID, session.UserID, hashToken(newToken), time.Now().Add(ttl)); err != nil {
		return 0, "", err
	}
	result, err := tx.ExecContext(ctx, `UPDATE refresh_sessions SET revoked_at=NOW(),replaced_by=$2 WHERE id=$1 AND revoked_at IS NULL`, session.ID, newID)
	if err != nil {
		return 0, "", err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return 0, "", sql.ErrNoRows
	}
	if err := tx.Commit(); err != nil {
		return 0, "", err
	}
	return session.UserID, newToken, nil
}

func (r *UserRepository) RevokeRefreshSession(ctx context.Context, token string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE refresh_sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL`, hashToken(token))
	return err
}
func (r *UserRepository) RevokeAllRefreshSessions(ctx context.Context, userID int64) error {
	_, err := r.db.ExecContext(ctx, `UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL`, userID)
	return err
}
func (r *UserRepository) GetTOTP(ctx context.Context, userID int64) (string, bool, error) {
	var secret string
	var enabled bool
	err := r.db.QueryRowContext(ctx, `SELECT totp_secret,totp_enabled FROM users WHERE id=$1`, userID).Scan(&secret, &enabled)
	return secret, enabled, err
}
func (r *UserRepository) SetTOTP(ctx context.Context, userID int64, secret string, enabled bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET totp_secret=$2,totp_enabled=$3,updated_at=NOW() WHERE id=$1`, userID, secret, enabled)
	return err
}
func (r *UserRepository) UpdatePassword(ctx context.Context, userID int64, hash string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET password_hash=$2,updated_at=NOW() WHERE id=$1`, userID, hash)
	return err
}
func (r *UserRepository) UpdateProfile(ctx context.Context, userID int64, username, avatar string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET username=$2,avatar_url=$3,updated_at=NOW() WHERE id=$1`, userID, username, avatar)
	return err
}
func randomToken(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
