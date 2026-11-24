package repository

import (
	"context"

	"dnd-campaign-manager/internal/domain"

	"github.com/lib/pq"
)

// SaveRouteState stores a token's route, its clock and its position (vtt-npc-routines.md §3).
func (r *VTTRepository) SaveRouteState(ctx context.Context, t *domain.VTTToken) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_tokens SET route=$2, route_paused=$3, route_elapsed_ms=$4, route_started_at=$5, x=$6, y=$7, updated_at=NOW() WHERE id=$1`,
		t.ID, t.Route, t.RoutePaused, t.RouteElapsedMs, t.RouteStartedAt, t.X, t.Y)
	return err
}

// RunningRouteScenes lists the scenes with at least one running route (partial index, §4).
func (r *VTTRepository) RunningRouteScenes(ctx context.Context) ([]int64, error) {
	ids := []int64{}
	err := r.db.SelectContext(ctx, &ids, `SELECT DISTINCT scene_id FROM vtt_tokens WHERE route_started_at IS NOT NULL`)
	return ids, err
}

// SaveRoutePositions stores the computed route positions of a scene in one statement. It does not
// touch updated_at: the exploration movement uses it to spot drags by other means.
func (r *VTTRepository) SaveRoutePositions(ctx context.Context, ids []int64, xs, ys []float64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_tokens AS t SET x=v.x, y=v.y
		FROM (SELECT unnest($1::bigint[]) AS id, unnest($2::float8[]) AS x, unnest($3::float8[]) AS y) AS v
		WHERE t.id = v.id`, pq.Array(ids), pq.Array(xs), pq.Array(ys))
	return err
}

// CampaignNPC is what a map token copies from a campaign NPC when it is placed.
type CampaignNPC struct {
	Name     string `db:"name"`
	ImageURL string `db:"image_url"`
	Combat   []byte `db:"combat"` // stats.combat (JSON) or NULL
}

// CampaignNPC loads an NPC of the campaign; another campaign's NPC is not found.
func (r *VTTRepository) CampaignNPC(ctx context.Context, campaignID, npcID int64) (*CampaignNPC, error) {
	var n CampaignNPC
	if err := r.db.GetContext(ctx, &n, `SELECT name, image_url, stats->'combat' AS combat FROM campaign_npcs WHERE campaign_id=$1 AND id=$2`, campaignID, npcID); err != nil {
		return nil, notFound(err)
	}
	return &n, nil
}

// NPCTokens lists every token linked to a campaign NPC, in every scene of the campaign.
func (r *VTTRepository) NPCTokens(ctx context.Context, campaignID int64) ([]domain.VTTToken, error) {
	tokens := []domain.VTTToken{}
	err := r.db.SelectContext(ctx, &tokens, tokenSelect+` WHERE t.campaign_id=$1 AND t.npc_id IS NOT NULL ORDER BY t.id`, campaignID)
	return tokens, err
}

// PlaceToken moves a token to a scene and position and sets its hidden flag (used by the agenda).
func (r *VTTRepository) PlaceToken(ctx context.Context, tokenID, sceneID int64, x, y float64, hidden bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE vtt_tokens SET scene_id=$2, x=$3, y=$4, hidden=$5, updated_at=NOW() WHERE id=$1`, tokenID, sceneID, x, y, hidden)
	return err
}
