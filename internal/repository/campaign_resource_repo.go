package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

type CampaignResourceRepository struct{ db *sqlx.DB }

type resourceDefinition struct {
	table      string
	fields     []string
	jsonFields map[string]bool
}

var campaignResources = map[string]resourceDefinition{
	"npcs":   {table: "campaign_npcs", fields: []string{"name", "role", "status", "description", "stats"}, jsonFields: map[string]bool{"stats": true}},
	"maps":   {table: "campaign_maps", fields: []string{"name", "location", "image_url", "description", "pins"}, jsonFields: map[string]bool{"pins": true}},
	"events": {table: "campaign_events", fields: []string{"title", "description", "event_date", "event_time", "related_npcs", "related_locations"}, jsonFields: map[string]bool{"related_npcs": true, "related_locations": true}},
	"notes":  {table: "campaign_notes", fields: []string{"title", "content"}},
	"bot":    {table: "campaign_bot_settings", fields: []string{"enabled", "personality", "actions"}, jsonFields: map[string]bool{"actions": true}},
}

func NewCampaignResourceRepository(db *sqlx.DB) *CampaignResourceRepository {
	return &CampaignResourceRepository{db: db}
}

func resourceFor(kind string) (resourceDefinition, error) {
	resource, ok := campaignResources[kind]
	if !ok {
		return resource, ErrResourceNotFound
	}
	return resource, nil
}

func cleanRecord(row map[string]any, resource resourceDefinition) {
	for key, value := range row {
		if bytes, ok := value.([]byte); ok && resource.jsonFields[key] {
			var decoded any
			if json.Unmarshal(bytes, &decoded) == nil {
				row[key] = decoded
			}
		}
	}
}

func (r *CampaignResourceRepository) List(ctx context.Context, campaignID int64, kind string) ([]map[string]any, error) {
	resource, err := resourceFor(kind)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryxContext(ctx, fmt.Sprintf(`SELECT * FROM %s WHERE campaign_id=$1 ORDER BY id DESC`, resource.table), campaignID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		row := map[string]any{}
		if err := rows.MapScan(row); err != nil {
			return nil, err
		}
		cleanRecord(row, resource)
		result = append(result, row)
	}
	return result, rows.Err()
}

func (r *CampaignResourceRepository) Get(ctx context.Context, campaignID, id int64, kind string) (map[string]any, error) {
	resource, err := resourceFor(kind)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryxContext(ctx, fmt.Sprintf(`SELECT * FROM %s WHERE campaign_id=$1 AND id=$2`, resource.table), campaignID, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, ErrResourceNotFound
	}
	row := map[string]any{}
	if err := rows.MapScan(row); err != nil {
		return nil, err
	}
	cleanRecord(row, resource)
	return row, nil
}

func cleanInput(resource resourceDefinition, input map[string]any) (map[string]any, error) {
	clean := map[string]any{}
	for _, field := range resource.fields {
		value, exists := input[field]
		if !exists {
			continue
		}
		if resource.jsonFields[field] {
			data, err := json.Marshal(value)
			if err != nil {
				return nil, err
			}
			clean[field] = data
			continue
		}
		if text, ok := value.(string); ok {
			if len(text) > 1_000_000 {
				return nil, fmt.Errorf("field %s is too long", field)
			}
		}
		clean[field] = value
	}
	return clean, nil
}

func (r *CampaignResourceRepository) Create(ctx context.Context, campaignID, userID int64, kind string, input map[string]any) (map[string]any, error) {
	resource, err := resourceFor(kind)
	if err != nil {
		return nil, err
	}
	clean, err := cleanInput(resource, input)
	if err != nil {
		return nil, err
	}
	if kind == "bot" {
		return r.SaveBot(ctx, campaignID, clean)
	}
	clean["campaign_id"] = campaignID
	if kind == "notes" {
		clean["author_id"] = userID
	}
	columns, values, args := []string{}, []string{}, []any{}
	for column, value := range clean {
		columns = append(columns, column)
		values = append(values, fmt.Sprintf("$%d", len(args)+1))
		args = append(args, value)
	}
	var id int64
	query := fmt.Sprintf(`INSERT INTO %s (%s) VALUES (%s) RETURNING id`, resource.table, strings.Join(columns, ","), strings.Join(values, ","))
	if err := r.db.QueryRowContext(ctx, query, args...).Scan(&id); err != nil {
		return nil, err
	}
	return r.Get(ctx, campaignID, id, kind)
}

func (r *CampaignResourceRepository) Update(ctx context.Context, campaignID, id, userID int64, kind string, input map[string]any) (map[string]any, error) {
	resource, err := resourceFor(kind)
	if err != nil {
		return nil, err
	}
	if kind == "bot" {
		clean, err := cleanInput(resource, input)
		if err != nil {
			return nil, err
		}
		return r.SaveBot(ctx, campaignID, clean)
	}
	clean, err := cleanInput(resource, input)
	if err != nil || len(clean) == 0 {
		return nil, fmt.Errorf("no valid fields to update")
	}
	sets, args := []string{}, []any{}
	for column, value := range clean {
		sets = append(sets, fmt.Sprintf("%s=$%d", column, len(args)+1))
		args = append(args, value)
	}
	args = append(args, campaignID, id)
	query := fmt.Sprintf(`UPDATE %s SET %s, updated_at=NOW() WHERE campaign_id=$%d AND id=$%d`, resource.table, strings.Join(sets, ","), len(args)-1, len(args))
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	if changed, _ := result.RowsAffected(); changed != 1 {
		return nil, ErrResourceNotFound
	}
	return r.Get(ctx, campaignID, id, kind)
}

func (r *CampaignResourceRepository) Delete(ctx context.Context, campaignID, id int64, kind string) error {
	resource, err := resourceFor(kind)
	if err != nil || kind == "bot" {
		return ErrResourceNotFound
	}
	result, err := r.db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM %s WHERE campaign_id=$1 AND id=$2`, resource.table), campaignID, id)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed != 1 {
		return ErrResourceNotFound
	}
	return nil
}

func (r *CampaignResourceRepository) SaveBot(ctx context.Context, campaignID int64, input map[string]any) (map[string]any, error) {
	row := map[string]any{"campaign_id": campaignID, "enabled": false, "personality": "", "actions": map[string]any{}}
	if err := r.db.QueryRowxContext(ctx, `SELECT enabled, personality, actions FROM campaign_bot_settings WHERE campaign_id=$1`, campaignID).MapScan(row); err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	clean, err := cleanInput(campaignResources["bot"], input)
	if err != nil {
		return nil, err
	}
	enabled, personality := row["enabled"], row["personality"]
	var actions any = "{}"
	if value, ok := clean["enabled"]; ok {
		enabled = value
	}
	if value, ok := clean["personality"]; ok {
		personality = value
	}
	if value, ok := clean["actions"]; ok {
		actions = value
	}
	if bytes, ok := actions.([]byte); ok {
		actions = json.RawMessage(bytes)
	}
	_, err = r.db.ExecContext(ctx, `INSERT INTO campaign_bot_settings (campaign_id, enabled, personality, actions) VALUES ($1,$2,$3,$4)
		ON CONFLICT (campaign_id) DO UPDATE SET enabled=$2, personality=$3, actions=$4, updated_at=NOW()`, campaignID, enabled, personality, actions)
	if err != nil {
		return nil, err
	}
	return r.GetBot(ctx, campaignID)
}

// GetBot returns the bot settings of a campaign (campaign_bot_settings has no id column).
func (r *CampaignResourceRepository) GetBot(ctx context.Context, campaignID int64) (map[string]any, error) {
	row := map[string]any{}
	err := r.db.QueryRowxContext(ctx, `SELECT * FROM campaign_bot_settings WHERE campaign_id=$1`, campaignID).MapScan(row)
	if err == sql.ErrNoRows {
		return nil, ErrResourceNotFound
	}
	cleanRecord(row, campaignResources["bot"])
	return row, err
}
