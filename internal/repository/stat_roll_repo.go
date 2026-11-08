package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// StatRoll is a server-made set of ability score rolls (6 × 4d6 drop lowest).
type StatRoll struct {
	ID          int64         `db:"id" json:"id"`
	CampaignID  int64         `db:"campaign_id" json:"campaign_id"`
	UserID      int64         `db:"user_id" json:"user_id"`
	DiceRaw     []byte        `db:"dice" json:"-"`
	Totals      pq.Int64Array `db:"totals" json:"totals"`
	Status      string        `db:"status" json:"status"`
	CharacterID *int64        `db:"character_id" json:"character_id"`
	CreatedAt   time.Time     `db:"created_at" json:"created_at"`
	ResolvedAt  *time.Time    `db:"resolved_at" json:"resolved_at"`
	Username    string        `db:"username" json:"username"`

	Dice [][]int `db:"-" json:"dice"`
}

var ErrStatRollNotFound = errors.New("stat roll not found")

type StatRollRepository struct{ db *sqlx.DB }

func NewStatRollRepository(db *sqlx.DB) *StatRollRepository { return &StatRollRepository{db: db} }

const statRollSelect = `SELECT r.*, COALESCE(u.username, '') AS username FROM stat_rolls r LEFT JOIN users u ON u.id = r.user_id`

func decodeDice(rolls []StatRoll) []StatRoll {
	for i := range rolls {
		_ = json.Unmarshal(rolls[i].DiceRaw, &rolls[i].Dice)
	}
	return rolls
}

// Available returns the user's unused set in the campaign (nil when none).
func (r *StatRollRepository) Available(ctx context.Context, campaignID, userID int64) (*StatRoll, error) {
	rolls := []StatRoll{}
	if err := r.db.SelectContext(ctx, &rolls, statRollSelect+` WHERE r.campaign_id=$1 AND r.user_id=$2 AND r.status='available'`, campaignID, userID); err != nil {
		return nil, err
	}
	if len(rolls) == 0 {
		return nil, nil
	}
	return &decodeDice(rolls)[0], nil
}

// Create stores a new set; when one is already available it returns that one instead (no
// rerolling by refreshing).
func (r *StatRollRepository) Create(ctx context.Context, campaignID, userID int64, dice [6][4]int, totals [6]int) (*StatRoll, error) {
	raw, _ := json.Marshal(dice)
	t := make(pq.Int64Array, 6)
	for i, v := range totals {
		t[i] = int64(v)
	}
	_, err := r.db.ExecContext(ctx, `INSERT INTO stat_rolls (campaign_id, user_id, dice, totals) VALUES ($1,$2,$3,$4)`, campaignID, userID, raw, t)
	if err != nil && !strings.Contains(err.Error(), "stat_rolls_one_available") {
		return nil, err
	}
	return r.Available(ctx, campaignID, userID)
}

// List returns every set of the campaign, newest first (GM view).
func (r *StatRollRepository) List(ctx context.Context, campaignID int64) ([]StatRoll, error) {
	rolls := []StatRoll{}
	if err := r.db.SelectContext(ctx, &rolls, statRollSelect+` WHERE r.campaign_id=$1 ORDER BY r.created_at DESC LIMIT 100`, campaignID); err != nil {
		return nil, err
	}
	return decodeDice(rolls), nil
}

func (r *StatRollRepository) Get(ctx context.Context, id int64) (*StatRoll, error) {
	rolls := []StatRoll{}
	if err := r.db.SelectContext(ctx, &rolls, statRollSelect+` WHERE r.id=$1`, id); err != nil {
		return nil, err
	}
	if len(rolls) == 0 {
		return nil, ErrStatRollNotFound
	}
	return &decodeDice(rolls)[0], nil
}

// Discard lets the user roll again (GM decision).
func (r *StatRollRepository) Discard(ctx context.Context, campaignID, id int64) error {
	res, err := r.db.ExecContext(ctx, `UPDATE stat_rolls SET status='discarded', resolved_at=NOW() WHERE campaign_id=$1 AND id=$2 AND status='available'`, campaignID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrStatRollNotFound
	}
	return nil
}

// MarkUsed binds an available set to the character created with it.
func (r *StatRollRepository) MarkUsed(ctx context.Context, id, characterID int64) error {
	res, err := r.db.ExecContext(ctx, `UPDATE stat_rolls SET status='used', character_id=$2, resolved_at=NOW() WHERE id=$1 AND status='available'`, id, characterID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
