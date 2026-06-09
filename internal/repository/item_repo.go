package repository

import (
	"context"
	"database/sql"
	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

type ItemRepository struct {
	db *sqlx.DB
}

func NewItemRepository(db *sqlx.DB) *ItemRepository {
	return &ItemRepository{db: db}
}

func (r *ItemRepository) Create(ctx context.Context, item *domain.InventoryItem) error {
	query := `
		INSERT INTO inventory_items (character_id, name, item_type, rarity, weight, quantity, description,
			is_equipped, slot_type, requires_attunement, is_attuned, is_tradeable, quest_bound, srd_ref_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowxContext(ctx, query,
		item.CharacterID, item.Name, item.ItemType, item.Rarity, item.Weight, item.Quantity,
		item.Description, item.IsEquipped, item.SlotType, item.RequiresAttunement,
		item.IsAttuned, item.IsTradeable, item.QuestBound, item.SRDRefID,
	).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)
}

func (r *ItemRepository) GetByID(ctx context.Context, id int64) (*domain.InventoryItem, error) {
	var item domain.InventoryItem
	query := `SELECT * FROM inventory_items WHERE id=$1`
	err := r.db.GetContext(ctx, &item, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &item, err
}

func (r *ItemRepository) GetByCharacter(ctx context.Context, characterID int64) ([]domain.InventoryItem, error) {
	var items []domain.InventoryItem
	query := `SELECT * FROM inventory_items WHERE character_id=$1 ORDER BY slot_type, name`
	err := r.db.SelectContext(ctx, &items, query, characterID)
	return items, err
}

func (r *ItemRepository) Update(ctx context.Context, item *domain.InventoryItem) error {
	query := `
		UPDATE inventory_items SET name=$1, quantity=$2, is_equipped=$3, slot_type=$4,
			is_attuned=$5, is_tradeable=$6, quest_bound=$7, updated_at=NOW()
		WHERE id=$8`
	_, err := r.db.ExecContext(ctx, query, item.Name, item.Quantity, item.IsEquipped,
		item.SlotType, item.IsAttuned, item.IsTradeable, item.QuestBound, item.ID)
	return err
}

func (r *ItemRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM inventory_items WHERE id=$1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *ItemRepository) LockItemsForTrade(ctx context.Context, itemIDs []int64, lock bool) error {
	if len(itemIDs) == 0 {
		return nil
	}
	query := `UPDATE inventory_items SET trade_locked=$1 WHERE id = ANY($2)`
	_, err := r.db.ExecContext(ctx, query, lock, itemIDs)
	return err
}

func (r *ItemRepository) GetByIDs(ctx context.Context, ids []int64) ([]domain.InventoryItem, error) {
	var items []domain.InventoryItem
	query := `SELECT * FROM inventory_items WHERE id = ANY($1)`
	err := r.db.SelectContext(ctx, &items, query, ids)
	return items, err
}

func (r *ItemRepository) TransferItems(ctx context.Context, itemIDs []int64, fromCharID, toCharID int64) error {
	if len(itemIDs) == 0 {
		return nil
	}
	query := `UPDATE inventory_items SET character_id=$1, trade_locked=false, updated_at=NOW() WHERE id = ANY($2) AND character_id=$3`
	_, err := r.db.ExecContext(ctx, query, toCharID, itemIDs, fromCharID)
	return err
}

func (r *ItemRepository) GetMarketplaceItems(ctx context.Context, campaignID int64) ([]domain.MarketplaceItem, error) {
	var items []domain.MarketplaceItem
	query := `SELECT * FROM marketplace_items WHERE campaign_id=$1 ORDER BY rarity, name`
	err := r.db.SelectContext(ctx, &items, query, campaignID)
	return items, err
}

func (r *ItemRepository) CreateMarketplaceItem(ctx context.Context, item *domain.MarketplaceItem) error {
	query := `
		INSERT INTO marketplace_items (campaign_id, name, item_type, rarity, price, weight, description, attunement_required, srd_ref_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`
	return r.db.QueryRowxContext(ctx, query,
		item.CampaignID, item.Name, item.ItemType, item.Rarity, item.Price,
		item.Weight, item.Description, item.AttunementRequired, item.SRDRefID,
	).Scan(&item.ID, &item.CreatedAt)
}

func (r *ItemRepository) GetMarketplaceItemByID(ctx context.Context, id int64) (*domain.MarketplaceItem, error) {
	var item domain.MarketplaceItem
	query := `SELECT * FROM marketplace_items WHERE id=$1`
	err := r.db.GetContext(ctx, &item, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &item, err
}

// Spell methods
func (r *ItemRepository) CreateSpell(ctx context.Context, s *domain.Spell) error {
	query := `
		INSERT INTO spells (character_id, name, level, school, casting_time, range, duration, description, components, damage_type, prepared, srd_ref_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at`
	return r.db.QueryRowxContext(ctx, query,
		s.CharacterID, s.Name, s.Level, s.School, s.CastingTime, s.Range,
		s.Duration, s.Description, s.Components, s.DamageType, s.Prepared, s.SRDRefID,
	).Scan(&s.ID, &s.CreatedAt)
}

func (r *ItemRepository) GetSpellsByCharacter(ctx context.Context, characterID int64) ([]domain.Spell, error) {
	var spells []domain.Spell
	query := `SELECT * FROM spells WHERE character_id=$1 ORDER BY level, name`
	err := r.db.SelectContext(ctx, &spells, query, characterID)
	return spells, err
}

func (r *ItemRepository) GetPreparedSpells(ctx context.Context, characterID int64) ([]domain.Spell, error) {
	var spells []domain.Spell
	query := `SELECT * FROM spells WHERE character_id=$1 AND prepared=true ORDER BY level, name`
	err := r.db.SelectContext(ctx, &spells, query, characterID)
	return spells, err
}

func (r *ItemRepository) UpdateSpell(ctx context.Context, s *domain.Spell) error {
	query := `UPDATE spells SET name=$1, prepared=$2 WHERE id=$3`
	_, err := r.db.ExecContext(ctx, query, s.Name, s.Prepared, s.ID)
	return err
}

func (r *ItemRepository) DeleteSpell(ctx context.Context, id int64) error {
	query := `DELETE FROM spells WHERE id=$1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}