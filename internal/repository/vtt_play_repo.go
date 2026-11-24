package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

// ErrAlreadyAttempted means the character already tried this object (vtt-modes.md §3).
var ErrAlreadyAttempted = errors.New("object already attempted by this character")

// ---------- Milestones ----------

func (r *VTTRepository) Milestones(ctx context.Context, campaignID int64) ([]domain.Milestone, error) {
	out := []domain.Milestone{}
	err := r.db.SelectContext(ctx, &out, `SELECT * FROM campaign_milestones WHERE campaign_id=$1 ORDER BY id`, campaignID)
	return out, err
}

func (r *VTTRepository) CreateMilestone(ctx context.Context, m *domain.Milestone) error {
	return r.db.QueryRowxContext(ctx, `INSERT INTO campaign_milestones(campaign_id,name,achieved,achieved_at) VALUES($1,$2,$3,CASE WHEN $3 THEN NOW() END) RETURNING *`,
		m.CampaignID, m.Name, m.Achieved).StructScan(m)
}

func (r *VTTRepository) UpdateMilestone(ctx context.Context, m *domain.Milestone) error {
	err := r.db.QueryRowxContext(ctx, `UPDATE campaign_milestones SET name=$3, achieved=$4,
		achieved_at=CASE WHEN $4 AND NOT achieved THEN NOW() WHEN NOT $4 THEN NULL ELSE achieved_at END
		WHERE campaign_id=$1 AND id=$2 RETURNING *`, m.CampaignID, m.ID, m.Name, m.Achieved).StructScan(m)
	return notFound(err)
}

// ---------- Objects ----------

const objectCols = `id,scene_id,campaign_id,name,icon,x,y,discover_dc,requirements,loot_kind,loot,per_character,depleted,created_at`

func (r *VTTRepository) Objects(ctx context.Context, sceneID int64) ([]domain.VTTObject, error) {
	out := []domain.VTTObject{}
	err := r.db.SelectContext(ctx, &out, `SELECT `+objectCols+` FROM vtt_objects WHERE scene_id=$1 ORDER BY id`, sceneID)
	return out, err
}

func (r *VTTRepository) Object(ctx context.Context, campaignID, objectID int64) (*domain.VTTObject, error) {
	var o domain.VTTObject
	err := r.db.GetContext(ctx, &o, `SELECT `+objectCols+` FROM vtt_objects WHERE campaign_id=$1 AND id=$2`, campaignID, objectID)
	if err != nil {
		return nil, notFound(err)
	}
	return &o, nil
}

func (r *VTTRepository) SaveObject(ctx context.Context, o *domain.VTTObject) error {
	if o.ID == 0 {
		return r.db.QueryRowxContext(ctx, `INSERT INTO vtt_objects(scene_id,campaign_id,name,icon,x,y,discover_dc,requirements,loot_kind,loot,per_character,depleted)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING `+objectCols,
			o.SceneID, o.CampaignID, o.Name, o.Icon, o.X, o.Y, o.DiscoverDC, o.Requirements, o.LootKind, o.Loot, o.PerCharacter, o.Depleted).StructScan(o)
	}
	err := r.db.QueryRowxContext(ctx, `UPDATE vtt_objects SET name=$3,icon=$4,x=$5,y=$6,discover_dc=$7,requirements=$8,loot_kind=$9,loot=$10,per_character=$11,depleted=$12
		WHERE campaign_id=$1 AND id=$2 RETURNING `+objectCols,
		o.CampaignID, o.ID, o.Name, o.Icon, o.X, o.Y, o.DiscoverDC, o.Requirements, o.LootKind, o.Loot, o.PerCharacter, o.Depleted).StructScan(o)
	return notFound(err)
}

func (r *VTTRepository) DeleteObject(ctx context.Context, campaignID, objectID int64) (int64, error) {
	var sceneID int64
	err := r.db.GetContext(ctx, &sceneID, `DELETE FROM vtt_objects WHERE campaign_id=$1 AND id=$2 RETURNING scene_id`, campaignID, objectID)
	return sceneID, notFound(err)
}

// ResetObject clears an object's attempts and depletion; it returns the object's scene id so the
// vtt.object.updated event can carry it (vtt-modes.md).
func (r *VTTRepository) ResetObject(ctx context.Context, campaignID, objectID int64) (int64, error) {
	if _, err := r.db.ExecContext(ctx, `DELETE FROM vtt_object_attempts WHERE object_id=(SELECT id FROM vtt_objects WHERE campaign_id=$1 AND id=$2)`, campaignID, objectID); err != nil {
		return 0, err
	}
	var sceneID int64
	err := r.db.GetContext(ctx, &sceneID, `UPDATE vtt_objects SET depleted=FALSE WHERE campaign_id=$1 AND id=$2 RETURNING scene_id`, campaignID, objectID)
	return sceneID, notFound(err)
}

// AttemptedObjects returns the ids of objects of a scene the given characters already tried.
func (r *VTTRepository) AttemptedObjects(ctx context.Context, sceneID int64, characterIDs []int64) (map[int64]bool, error) {
	out := map[int64]bool{}
	if len(characterIDs) == 0 {
		return out, nil
	}
	query, args, err := sqlx.In(`SELECT DISTINCT a.object_id FROM vtt_object_attempts a JOIN vtt_objects o ON o.id=a.object_id WHERE o.scene_id=? AND a.character_id IN (?)`, sceneID, characterIDs)
	if err != nil {
		return nil, err
	}
	var ids []int64
	if err := r.db.SelectContext(ctx, &ids, r.db.Rebind(query), args...); err != nil {
		return nil, err
	}
	for _, id := range ids {
		out[id] = true
	}
	return out, nil
}

// LootGrant is what an interaction gives to a character.
type LootGrant struct {
	Gold  int
	Items []LootItem
}

type LootItem struct {
	Name string
	Qty  int
}

// RecordAttempt stores the attempt and, on success, grants the loot atomically.
func (r *VTTRepository) RecordAttempt(ctx context.Context, objectID, characterID int64, success bool, detail string, grant *LootGrant, deplete bool) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	res, err := tx.ExecContext(ctx, `INSERT INTO vtt_object_attempts(object_id,character_id,success,detail) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, objectID, characterID, success, detail)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrAlreadyAttempted
	}
	if success && grant != nil {
		if grant.Gold != 0 {
			if _, err := tx.ExecContext(ctx, `UPDATE characters SET gold=gold+$2, updated_at=NOW() WHERE id=$1`, characterID, grant.Gold); err != nil {
				return err
			}
		}
		for _, it := range grant.Items {
			if _, err := tx.ExecContext(ctx, `INSERT INTO inventory_items(character_id,name,quantity) VALUES($1,$2,$3)`, characterID, it.Name, max(1, it.Qty)); err != nil {
				return err
			}
		}
	}
	if success && deplete {
		if _, err := tx.ExecContext(ctx, `UPDATE vtt_objects SET depleted=TRUE WHERE id=$1`, objectID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// CharacterProfile carries the sheet values the exploration rules need.
type CharacterProfile struct {
	ID      int64  `db:"id"`
	UserID  int64  `db:"user_id"`
	Race    string `db:"race"`
	Class   string `db:"class"`
	Speed   int    `db:"speed"`
	Passive int    `db:"passive_perception"`
	Str     int    `db:"str_score"`
	Dex     int    `db:"dex_score"`
	Con     int    `db:"con_score"`
	Int     int    `db:"int_score"`
	Wis     int    `db:"wis_score"`
	Cha     int    `db:"cha_score"`
}

func (r *VTTRepository) CharacterProfile(ctx context.Context, characterID int64) (*CharacterProfile, error) {
	var p CharacterProfile
	err := r.db.GetContext(ctx, &p, `SELECT id,user_id,race,class,COALESCE(speed,30) speed,COALESCE(passive_perception,10) passive_perception,
		COALESCE(str_score,10) str_score,COALESCE(dex_score,10) dex_score,COALESCE(con_score,10) con_score,COALESCE(int_score,10) int_score,COALESCE(wis_score,10) wis_score,COALESCE(cha_score,10) cha_score
		FROM characters WHERE id=$1`, characterID)
	if err != nil {
		return nil, notFound(err)
	}
	return &p, nil
}

func (r *VTTRepository) CharacterItemNames(ctx context.Context, characterID int64) ([]string, error) {
	var out []string
	err := r.db.SelectContext(ctx, &out, `SELECT LOWER(name) FROM inventory_items WHERE character_id=$1`, characterID)
	return out, err
}

// ---------- Combats ----------

const combatCols = `id,scene_id,campaign_id,status,round,turn_index,turn_started_at,turn_seconds,paused,remaining_ms,center_x,center_y,created_at`

func (r *VTTRepository) ActiveCombats(ctx context.Context, sceneID int64) ([]domain.VTTCombat, error) {
	out := []domain.VTTCombat{}
	if err := r.db.SelectContext(ctx, &out, `SELECT `+combatCols+` FROM vtt_combats WHERE scene_id=$1 AND status='active' ORDER BY id`, sceneID); err != nil {
		return nil, err
	}
	for i := range out {
		if err := r.loadCombatants(ctx, &out[i]); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// AllActiveCombats is used by the turn-timer loop.
func (r *VTTRepository) AllActiveCombats(ctx context.Context) ([]domain.VTTCombat, error) {
	out := []domain.VTTCombat{}
	if err := r.db.SelectContext(ctx, &out, `SELECT `+combatCols+` FROM vtt_combats WHERE status='active'`); err != nil {
		return nil, err
	}
	for i := range out {
		if err := r.loadCombatants(ctx, &out[i]); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (r *VTTRepository) Combat(ctx context.Context, campaignID, combatID int64) (*domain.VTTCombat, error) {
	var c domain.VTTCombat
	if err := r.db.GetContext(ctx, &c, `SELECT `+combatCols+` FROM vtt_combats WHERE campaign_id=$1 AND id=$2`, campaignID, combatID); err != nil {
		return nil, notFound(err)
	}
	return &c, r.loadCombatants(ctx, &c)
}

func (r *VTTRepository) loadCombatants(ctx context.Context, c *domain.VTTCombat) error {
	c.Combatants = []domain.VTTCombatant{}
	return r.db.SelectContext(ctx, &c.Combatants, `SELECT cb.id,cb.combat_id,cb.token_id,cb.initiative,cb.is_player,cb.movement_used_ft,cb.dashed,cb.pending,t.name,t.hidden
		FROM vtt_combatants cb JOIN vtt_tokens t ON t.id=cb.token_id WHERE cb.combat_id=$1 AND NOT cb.pending ORDER BY cb.initiative DESC, cb.id`, c.ID)
}

// CreateCombat inserts a combat and its combatants in one transaction.
func (r *VTTRepository) CreateCombat(ctx context.Context, c *domain.VTTCombat, combatants []domain.VTTCombatant) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := tx.QueryRowxContext(ctx, `INSERT INTO vtt_combats(scene_id,campaign_id,center_x,center_y,turn_seconds,remaining_ms) VALUES($1,$2,$3,$4,$5,$6) RETURNING `+combatCols,
		c.SceneID, c.CampaignID, c.CenterX, c.CenterY, c.TurnSeconds, c.TurnSeconds*1000).StructScan(c); err != nil {
		return err
	}
	for _, cb := range combatants {
		if _, err := tx.ExecContext(ctx, `INSERT INTO vtt_combatants(combat_id,token_id,initiative,is_player) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, c.ID, cb.TokenID, cb.Initiative, cb.IsPlayer); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return r.loadCombatants(ctx, c)
}

func (r *VTTRepository) SaveCombatState(ctx context.Context, c *domain.VTTCombat) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_combats SET status=$2,round=$3,turn_index=$4,turn_started_at=$5,paused=$6,remaining_ms=$7,turn_seconds=$8 WHERE id=$1`,
		c.ID, c.Status, c.Round, c.TurnIndex, c.TurnStartedAt, c.Paused, c.RemainingMs, c.TurnSeconds)
	return err
}

func (r *VTTRepository) ResetMovement(ctx context.Context, combatantID int64) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_combatants SET movement_used_ft=0, dashed=FALSE WHERE id=$1`, combatantID)
	return err
}

func (r *VTTRepository) UseMovement(ctx context.Context, combatantID int64, ft int, dash bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_combatants SET movement_used_ft=movement_used_ft+$2, dashed=dashed OR $3 WHERE id=$1`, combatantID, ft, dash)
	return err
}

// AddPending queues a token to join a combat at the end of the round.
func (r *VTTRepository) AddPending(ctx context.Context, combatID, tokenID int64, initiative int) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO vtt_combatants(combat_id,token_id,initiative,is_player,pending) VALUES($1,$2,$3,TRUE,TRUE) ON CONFLICT DO NOTHING`, combatID, tokenID, initiative)
	return err
}

func (r *VTTRepository) ActivatePending(ctx context.Context, combatID int64) (int64, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE vtt_combatants SET pending=FALSE WHERE combat_id=$1 AND pending`, combatID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// TokenInCombat reports whether a token takes part (or is queued) in an active combat.
func (r *VTTRepository) TokenInCombat(ctx context.Context, tokenID int64) (int64, error) {
	var id int64
	err := r.db.GetContext(ctx, &id, `SELECT c.id FROM vtt_combatants cb JOIN vtt_combats c ON c.id=cb.combat_id WHERE cb.token_id=$1 AND c.status='active' LIMIT 1`, tokenID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return id, err
}

func (r *VTTRepository) SetSneaking(ctx context.Context, tokenID int64, on bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_tokens SET sneaking=$2, updated_at=NOW() WHERE id=$1`, tokenID, on)
	return err
}

func (r *VTTRepository) DisarmZone(ctx context.Context, sceneID int64, zones domain.Zones) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_scenes SET zones=$2 WHERE id=$1`, sceneID, zones)
	return err
}

func (r *VTTRepository) TouchToken(ctx context.Context, tokenID int64, x, y float64, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_tokens SET x=$2, y=$3, updated_at=$4 WHERE id=$1`, tokenID, x, y, at)
	return err
}

func (r *VTTRepository) TokenByID(ctx context.Context, tokenID int64) (*domain.VTTToken, error) {
	var t domain.VTTToken
	if err := r.db.GetContext(ctx, &t, tokenSelect+` WHERE t.id=$1`, tokenID); err != nil {
		return nil, notFound(err)
	}
	return &t, nil
}

func (r *VTTRepository) SceneByID(ctx context.Context, sceneID int64) (*domain.VTTScene, error) {
	var s domain.VTTScene
	if err := r.db.GetContext(ctx, &s, `SELECT `+sceneCols+` FROM vtt_scenes WHERE id=$1`, sceneID); err != nil {
		return nil, notFound(err)
	}
	return &s, nil
}

// ShopForObject returns the shop whose counter is this map object (0 when none).
func (r *VTTRepository) ShopForObject(ctx context.Context, objectID int64) (int64, error) {
	var id int64
	err := r.db.GetContext(ctx, &id, `SELECT COALESCE((SELECT id FROM shops WHERE object_id=$1), 0)`, objectID)
	return id, err
}

// CampaignGMs returns the user ids allowed to receive GM-only notifications of a campaign.
func (r *VTTRepository) CampaignGMs(ctx context.Context, campaignID int64) ([]int64, error) {
	ids := []int64{}
	err := r.db.SelectContext(ctx, &ids, `SELECT gm_user_id FROM campaigns WHERE id=$1
		UNION SELECT user_id FROM campaign_members WHERE campaign_id=$1 AND role='gm'`, campaignID)
	return ids, err
}
