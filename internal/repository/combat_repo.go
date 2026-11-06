package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

type CombatRepository struct{ db *sqlx.DB }

func NewCombatRepository(db *sqlx.DB) *CombatRepository { return &CombatRepository{db: db} }

func (r *CombatRepository) State(ctx context.Context, campaignID int64) (*domain.CombatState, error) {
	state := &domain.CombatState{Combatants: []domain.Combatant{}, Log: []domain.CombatLogEntry{}}
	var settings []byte
	if err := r.db.GetContext(ctx, &settings, `SELECT settings FROM campaigns WHERE id=$1`, campaignID); err != nil {
		return nil, err
	}
	var data struct {
		Combat struct {
			Round int `json:"round"`
			Turn  int `json:"turn"`
		} `json:"combat"`
	}
	if err := json.Unmarshal(settings, &data); err != nil {
		return nil, err
	}
	state.Round, state.Turn = data.Combat.Round, data.Combat.Turn
	if err := r.db.SelectContext(ctx, &state.Combatants, `SELECT * FROM combatants WHERE campaign_id=$1 ORDER BY initiative DESC, id`, campaignID); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &state.Log, `SELECT * FROM combat_log WHERE campaign_id=$1 ORDER BY id DESC LIMIT 100`, campaignID); err != nil {
		return nil, err
	}
	return state, nil
}

func (r *CombatRepository) Add(ctx context.Context, combatant *domain.Combatant) error {
	if combatant.CharacterID != nil {
		var character domain.Character
		err := r.db.GetContext(ctx, &character, `SELECT id, campaign_id, name, current_hp, max_hp FROM characters WHERE id=$1 AND campaign_id=$2`, *combatant.CharacterID, combatant.CampaignID)
		if err == sql.ErrNoRows {
			return ErrResourceNotFound
		}
		if err != nil {
			return err
		}
		combatant.Name = character.Name
		combatant.HP = character.CurrentHP
		combatant.MaxHP = character.MaxHP
		combatant.IsPlayer = true
	}
	if combatant.MaxHP < 1 || combatant.MaxHP > 100000 || combatant.HP < 0 {
		return ErrResourceConflict
	}
	if combatant.HP > combatant.MaxHP {
		combatant.HP = combatant.MaxHP
	}
	if combatant.Initiative < -20 || combatant.Initiative > 100 {
		return ErrResourceConflict
	}
	return r.db.QueryRowxContext(ctx, `INSERT INTO combatants (campaign_id, character_id, name, initiative, hp, max_hp, is_player)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`, combatant.CampaignID, combatant.CharacterID,
		combatant.Name, combatant.Initiative, combatant.HP, combatant.MaxHP, combatant.IsPlayer).Scan(&combatant.ID, &combatant.CreatedAt)
}

func (r *CombatRepository) NextTurn(ctx context.Context, campaignID, actorID int64) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `SELECT id FROM campaigns WHERE id=$1 FOR UPDATE`, campaignID); err != nil {
		return err
	}
	var count int
	if err := tx.GetContext(ctx, &count, `SELECT COUNT(*) FROM combatants WHERE campaign_id=$1`, campaignID); err != nil {
		return err
	}
	if count == 0 {
		return ErrResourceNotFound
	}
	var settings []byte
	if err := tx.GetContext(ctx, &settings, `SELECT settings FROM campaigns WHERE id=$1`, campaignID); err != nil {
		return err
	}
	var config map[string]any
	if len(settings) == 0 {
		config = map[string]any{}
	} else if err := json.Unmarshal(settings, &config); err != nil {
		return err
	}
	combat, _ := config["combat"].(map[string]any)
	if combat == nil {
		combat = map[string]any{}
	}
	turn, _ := combat["turn"].(float64)
	round, _ := combat["round"].(float64)
	next := int(turn)
	if int(round) > 0 {
		next = (next + 1) % count
	}
	if next == 0 {
		round++
	}
	combat["turn"], combat["round"] = next, round
	config["combat"] = combat
	encoded, _ := json.Marshal(config)
	if _, err := tx.ExecContext(ctx, `UPDATE campaigns SET settings=$1 WHERE id=$2`, encoded, campaignID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO combat_log (campaign_id, actor_id, body) VALUES ($1,$2,$3)`, campaignID, actorID, "Turno siguiente"); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *CombatRepository) UpdateHP(ctx context.Context, campaignID, combatantID, userID int64, isGM bool, hp int) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var combatant domain.Combatant
	if err := tx.QueryRowxContext(ctx, `SELECT * FROM combatants WHERE id=$1 AND campaign_id=$2 FOR UPDATE`, combatantID, campaignID).StructScan(&combatant); err != nil {
		if err == sql.ErrNoRows {
			return ErrResourceNotFound
		}
		return err
	}
	if hp < 0 {
		hp = 0
	}
	if hp > combatant.MaxHP {
		hp = combatant.MaxHP
	}
	if !isGM {
		if combatant.CharacterID == nil {
			return ErrResourceConflict
		}
		result, err := tx.ExecContext(ctx, `UPDATE combatants SET hp=$1 WHERE id=$2 AND character_id IN (SELECT id FROM characters WHERE user_id=$3 AND campaign_id=$4)`, hp, combatantID, userID, campaignID)
		if err != nil {
			return err
		}
		if changed, _ := result.RowsAffected(); changed != 1 {
			return ErrResourceConflict
		}
	} else if _, err := tx.ExecContext(ctx, `UPDATE combatants SET hp=$1 WHERE id=$2`, hp, combatantID); err != nil {
		return err
	}
	if combatant.CharacterID != nil {
		if _, err := tx.ExecContext(ctx, `UPDATE characters SET current_hp=$1, updated_at=NOW() WHERE id=$2`, hp, combatant.CharacterID); err != nil {
			return err
		}
	}
	combatant.HP = hp
	body, _ := json.Marshal(map[string]any{"combatant_id": combatantID, "hp": hp})
	if _, err := tx.ExecContext(ctx, `INSERT INTO combat_log (campaign_id, actor_id, body) VALUES ($1,$2,$3)`, campaignID, userID, string(body)); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *CombatRepository) Remove(ctx context.Context, campaignID, combatantID int64) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM combatants WHERE campaign_id=$1 AND id=$2`, campaignID, combatantID)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed != 1 {
		return ErrResourceNotFound
	}
	return nil
}

func (r *CombatRepository) Reset(ctx context.Context, campaignID int64) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM combatants WHERE campaign_id=$1`, campaignID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `UPDATE campaigns SET settings=settings-'combat' WHERE id=$1`, campaignID)
	if err != nil {
		return err
	}
	return tx.Commit()
}
