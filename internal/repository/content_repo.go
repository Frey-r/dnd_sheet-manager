package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

type ContentRepository struct{ db *sqlx.DB }

func NewContentRepository(db *sqlx.DB) *ContentRepository { return &ContentRepository{db: db} }

func (r *ContentRepository) Search(ctx context.Context, filters domain.ContentFilters) (*domain.PaginatedResult[domain.ContentSummary], error) {
	filters.Limit, filters.Offset = defaultPagination(filters.Limit, filters.Offset)
	conditions := []string{}
	args := map[string]any{"limit": filters.Limit, "offset": filters.Offset}
	if filters.Query != "" {
		conditions = append(conditions, `to_tsvector('simple', search_text) @@ websearch_to_tsquery('simple', :query)`)
		args["query"] = filters.Query
	}
	if filters.Type != "" {
		conditions = append(conditions, `entity_type = :entity_type`)
		args["entity_type"] = filters.Type
	}
	if filters.Source != "" {
		conditions = append(conditions, `source = :source`)
		args["source"] = filters.Source
	}
	if filters.Origin != "" {
		conditions = append(conditions, `origin = :origin`)
		args["origin"] = filters.Origin
	}
	if filters.IsSRD != nil {
		conditions = append(conditions, `is_srd = :is_srd`)
		args["is_srd"] = *filters.IsSRD
	}
	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}
	var total int
	rows, err := r.db.NamedQueryContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM content_entities %s`, where), args)
	if err != nil {
		return nil, err
	}
	if rows.Next() {
		if err := rows.Scan(&total); err != nil {
			rows.Close()
			return nil, err
		}
	}
	rows.Close()
	items := []domain.ContentSummary{}
	rows, err = r.db.NamedQueryContext(ctx, fmt.Sprintf(`SELECT id,entity_type,name,source,page,is_srd,origin FROM content_entities %s ORDER BY entity_type,name,source LIMIT :limit OFFSET :offset`, where), args)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.ContentSummary
		if err := rows.StructScan(&item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return &domain.PaginatedResult[domain.ContentSummary]{Data: items, Total: total, Limit: filters.Limit, Offset: filters.Offset}, nil
}

func (r *ContentRepository) Get(ctx context.Context, id int64) (*domain.ContentEntity, error) {
	row := r.db.QueryRowxContext(ctx, `SELECT id,entity_type,name,source,page,is_srd,origin,data,source_file,created_at,updated_at FROM content_entities WHERE id=$1`, id)
	var entity domain.ContentEntity
	var data []byte
	if err := row.Scan(&entity.ID, &entity.Type, &entity.Name, &entity.Source, &entity.Page, &entity.IsSRD, &entity.Origin, &data, &entity.SourceFile, &entity.CreatedAt, &entity.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	entity.Data = data
	return &entity, nil
}

func (r *ContentRepository) Categories(ctx context.Context) ([]domain.ContentCategory, error) {
	items := []domain.ContentCategory{}
	err := r.db.SelectContext(ctx, &items, `SELECT entity_type,COUNT(*) AS count FROM content_entities GROUP BY entity_type ORDER BY entity_type`)
	return items, err
}

func (r *ContentRepository) Sources(ctx context.Context) ([]string, error) {
	items := []string{}
	err := r.db.SelectContext(ctx, &items, `SELECT source FROM content_entities GROUP BY source ORDER BY source`)
	return items, err
}
