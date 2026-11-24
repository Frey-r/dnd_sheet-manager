package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

// ErrVTTNotFound is returned when a scene or token does not exist in the campaign.
var ErrVTTNotFound = errors.New("vtt resource not found")

type VTTRepository struct{ db *sqlx.DB }

func NewVTTRepository(db *sqlx.DB) *VTTRepository { return &VTTRepository{db: db} }

const sceneCols = `id,campaign_id,name,map_url,width_px,height_px,grid_size_px,grid_offset_x,grid_offset_y,feet_per_cell,ambient_light,fog_enabled,walls,lights,mode,exploration_pace,zones,is_active,created_at,updated_at`
const tokenCols = `id,scene_id,campaign_id,name,kind,character_id,owner_user_id,image_url,color,x,y,size_cells,hp,max_hp,ac,hidden,vision_ft,darkvision_ft,blindsight_ft,light_bright_ft,light_dim_ft,speed_ft,passive_perception,stealth_bonus,dex_mod,sneaking,detects,created_at,updated_at,npc_id,disposition,route,route_paused,route_elapsed_ms,route_started_at`

const (
	npcSheetHP    = `CASE WHEN jsonb_typeof(n.stats->'combat'->'hp') = 'number' THEN (n.stats->'combat'->>'hp')::numeric::int END`
	npcSheetMaxHP = `CASE WHEN jsonb_typeof(n.stats->'combat'->'max_hp') = 'number' THEN (n.stats->'combat'->>'max_hp')::numeric::int END`
	npcHP         = `CASE WHEN n.id IS NULL THEN t.hp ELSE COALESCE(n.hp_current, ` + npcSheetHP + `, t.hp) END`
	npcMaxHP      = `CASE WHEN n.id IS NULL THEN t.max_hp ELSE COALESCE(` + npcSheetMaxHP + `, t.max_hp) END`
)

// tokenSelect joins the linked campaign NPC's relation and appearance (vtt-npc-routines.md §1–§2).
// Tokens linked to a campaign NPC show the NPC's HP: hp_current, else its combat sheet (npc-agenda.md §3).
var tokenSelect = `SELECT ` + strings.Replace(strings.Replace("t."+strings.ReplaceAll(tokenCols, ",", ",t."),
	"t.hp,", npcHP+" AS hp,", 1), "t.max_hp,", npcMaxHP+" AS max_hp,", 1) + `, n.status AS npc_status, n.appearance AS npc_appearance, n.race AS npc_race, n.class AS npc_class
	FROM vtt_tokens t LEFT JOIN campaign_npcs n ON n.id = t.npc_id`

func notFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrVTTNotFound
	}
	return err
}

func (r *VTTRepository) ListScenes(ctx context.Context, campaignID int64, activeOnly bool) ([]domain.VTTScene, error) {
	scenes := []domain.VTTScene{}
	q := `SELECT ` + sceneCols + ` FROM vtt_scenes WHERE campaign_id=$1`
	if activeOnly {
		q += ` AND is_active`
	}
	err := r.db.SelectContext(ctx, &scenes, q+` ORDER BY is_active DESC, updated_at DESC`, campaignID)
	return scenes, err
}

func (r *VTTRepository) GetScene(ctx context.Context, campaignID, sceneID int64) (*domain.VTTScene, error) {
	var s domain.VTTScene
	err := r.db.GetContext(ctx, &s, `SELECT `+sceneCols+` FROM vtt_scenes WHERE campaign_id=$1 AND id=$2`, campaignID, sceneID)
	if err != nil {
		return nil, notFound(err)
	}
	return &s, nil
}

func (r *VTTRepository) ActiveScene(ctx context.Context, campaignID int64) (*domain.VTTScene, error) {
	var s domain.VTTScene
	err := r.db.GetContext(ctx, &s, `SELECT `+sceneCols+` FROM vtt_scenes WHERE campaign_id=$1 AND is_active`, campaignID)
	if err != nil {
		return nil, notFound(err)
	}
	return &s, nil
}

func (r *VTTRepository) CreateScene(ctx context.Context, s *domain.VTTScene) error {
	return r.db.QueryRowxContext(ctx, `INSERT INTO vtt_scenes(campaign_id,name,map_url,width_px,height_px,grid_size_px,grid_offset_x,grid_offset_y,feet_per_cell,ambient_light,fog_enabled,walls,lights,mode,exploration_pace,zones)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING `+sceneCols,
		s.CampaignID, s.Name, s.MapURL, s.WidthPx, s.HeightPx, s.GridSizePx, s.GridOffsetX, s.GridOffsetY, s.FeetPerCell, s.AmbientLight, s.FogEnabled, s.Walls, s.Lights, s.Mode, s.Pace, s.Zones).StructScan(s)
}

func (r *VTTRepository) UpdateScene(ctx context.Context, s *domain.VTTScene) error {
	err := r.db.QueryRowxContext(ctx, `UPDATE vtt_scenes SET name=$3,map_url=$4,width_px=$5,height_px=$6,grid_size_px=$7,grid_offset_x=$8,grid_offset_y=$9,feet_per_cell=$10,ambient_light=$11,fog_enabled=$12,walls=$13,lights=$14,mode=$15,exploration_pace=$16,zones=$17,updated_at=NOW()
		WHERE campaign_id=$1 AND id=$2 RETURNING `+sceneCols,
		s.CampaignID, s.ID, s.Name, s.MapURL, s.WidthPx, s.HeightPx, s.GridSizePx, s.GridOffsetX, s.GridOffsetY, s.FeetPerCell, s.AmbientLight, s.FogEnabled, s.Walls, s.Lights, s.Mode, s.Pace, s.Zones).StructScan(s)
	return notFound(err)
}

func (r *VTTRepository) DeleteScene(ctx context.Context, campaignID, sceneID int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM vtt_scenes WHERE campaign_id=$1 AND id=$2`, campaignID, sceneID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrVTTNotFound
	}
	return nil
}

// ActivateScene makes sceneID the only active scene of the campaign, atomically.
func (r *VTTRepository) ActivateScene(ctx context.Context, campaignID, sceneID int64) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `UPDATE vtt_scenes SET is_active=FALSE WHERE campaign_id=$1 AND is_active`, campaignID); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `UPDATE vtt_scenes SET is_active=TRUE, updated_at=NOW() WHERE campaign_id=$1 AND id=$2`, campaignID, sceneID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrVTTNotFound
	}
	return tx.Commit()
}

func (r *VTTRepository) ListTokens(ctx context.Context, sceneID int64, includeHidden bool) ([]domain.VTTToken, error) {
	tokens := []domain.VTTToken{}
	q := tokenSelect + ` WHERE t.scene_id=$1`
	if !includeHidden {
		q += ` AND NOT t.hidden`
	}
	err := r.db.SelectContext(ctx, &tokens, q+` ORDER BY t.id`, sceneID)
	return tokens, err
}

func (r *VTTRepository) GetToken(ctx context.Context, campaignID, tokenID int64) (*domain.VTTToken, error) {
	var t domain.VTTToken
	err := r.db.GetContext(ctx, &t, tokenSelect+` WHERE t.campaign_id=$1 AND t.id=$2`, campaignID, tokenID)
	if err != nil {
		return nil, notFound(err)
	}
	return &t, nil
}

func (r *VTTRepository) CreateToken(ctx context.Context, t *domain.VTTToken) error {
	return r.db.QueryRowxContext(ctx, `INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,character_id,owner_user_id,image_url,color,x,y,size_cells,hp,max_hp,ac,hidden,vision_ft,darkvision_ft,blindsight_ft,light_bright_ft,light_dim_ft,speed_ft,passive_perception,stealth_bonus,dex_mod,sneaking,detects,npc_id,disposition)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING `+tokenCols,
		t.SceneID, t.CampaignID, t.Name, t.Kind, t.CharacterID, t.OwnerUserID, t.ImageURL, t.Color, t.X, t.Y, t.SizeCells, t.HP, t.MaxHP, t.AC, t.Hidden, t.VisionFt, t.DarkvisionFt, t.BlindsightFt, t.LightBrightFt, t.LightDimFt,
		t.SpeedFt, t.PassivePerc, t.StealthBonus, t.DexMod, t.Sneaking, t.Detects, t.NpcID, t.Disposition).StructScan(t)
}

func (r *VTTRepository) UpdateToken(ctx context.Context, t *domain.VTTToken) error {
	err := r.db.QueryRowxContext(ctx, `UPDATE vtt_tokens SET name=$3,kind=$4,character_id=$5,owner_user_id=$6,image_url=$7,color=$8,x=$9,y=$10,size_cells=$11,hp=$12,max_hp=$13,ac=$14,hidden=$15,vision_ft=$16,darkvision_ft=$17,blindsight_ft=$18,light_bright_ft=$19,light_dim_ft=$20,speed_ft=$21,passive_perception=$22,stealth_bonus=$23,dex_mod=$24,sneaking=$25,detects=$26,npc_id=$27,disposition=$28,updated_at=NOW()
		WHERE campaign_id=$1 AND id=$2 RETURNING `+tokenCols,
		t.CampaignID, t.ID, t.Name, t.Kind, t.CharacterID, t.OwnerUserID, t.ImageURL, t.Color, t.X, t.Y, t.SizeCells, t.HP, t.MaxHP, t.AC, t.Hidden, t.VisionFt, t.DarkvisionFt, t.BlindsightFt, t.LightBrightFt, t.LightDimFt,
		t.SpeedFt, t.PassivePerc, t.StealthBonus, t.DexMod, t.Sneaking, t.Detects, t.NpcID, t.Disposition).StructScan(t)
	return notFound(err)
}

func (r *VTTRepository) MoveToken(ctx context.Context, campaignID, tokenID int64, x, y float64) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_tokens SET x=$3, y=$4, updated_at=NOW() WHERE campaign_id=$1 AND id=$2`, campaignID, tokenID, x, y)
	return err
}

func (r *VTTRepository) DeleteToken(ctx context.Context, campaignID, tokenID int64) (int64, error) {
	var sceneID int64
	err := r.db.GetContext(ctx, &sceneID, `DELETE FROM vtt_tokens WHERE campaign_id=$1 AND id=$2 RETURNING scene_id`, campaignID, tokenID)
	return sceneID, notFound(err)
}

// CharacterHP returns current and max HP of linked characters, keyed by character id.
func (r *VTTRepository) CharacterHP(ctx context.Context, campaignID int64) (map[int64][2]int, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, current_hp, max_hp FROM characters WHERE campaign_id=$1`, campaignID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64][2]int{}
	for rows.Next() {
		var id int64
		var cur, max int
		if err := rows.Scan(&id, &cur, &max); err != nil {
			return nil, err
		}
		out[id] = [2]int{cur, max}
	}
	return out, rows.Err()
}

// MonsterBasics returns the fields needed to drop a bestiary monster on the table.
type MonsterBasics struct {
	Name   string `db:"name"`
	Size   string `db:"size"`
	AC     int    `db:"ac"`
	HP     int    `db:"hp"`
	Dex    int    `db:"dex"`
	Speed  string `db:"speed"`
	Senses string `db:"senses"`
}

func (r *VTTRepository) Monster(ctx context.Context, monsterID int64) (*MonsterBasics, error) {
	var m MonsterBasics
	err := r.db.GetContext(ctx, &m, `SELECT name, size, ac, hp, dex, speed::text AS speed, COALESCE(senses,'') AS senses FROM srd_monsters WHERE id=$1`, monsterID)
	if err != nil {
		return nil, notFound(err)
	}
	return &m, nil
}

// CharacterOwner returns the owning user and race of a character in the campaign.
func (r *VTTRepository) CharacterOwner(ctx context.Context, campaignID, characterID int64) (int64, string, error) {
	var row struct {
		UserID int64  `db:"user_id"`
		Race   string `db:"race"`
	}
	err := r.db.GetContext(ctx, &row, `SELECT user_id, race FROM characters WHERE campaign_id=$1 AND id=$2`, campaignID, characterID)
	return row.UserID, row.Race, notFound(err)
}
