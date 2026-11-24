package repository

import (
	"context"
	"database/sql"
	"errors"
)

// ErrInsufficientPurse: the NPC does not have that many coins (npc-agenda.md §5).
var ErrInsufficientPurse = errors.New("el PNJ no tiene tantas monedas")

// SetNPCHP stores the current HP of a campaign NPC; every token linked to it shows it (§3).
func (r *VTTRepository) SetNPCHP(ctx context.Context, npcID int64, hp int) error {
	_, err := r.db.ExecContext(ctx, `UPDATE campaign_npcs SET hp_current=$2, updated_at=NOW() WHERE id=$1`, npcID, max(0, hp))
	return err
}

// AdjustPurse adds amount (or sets it when set) to an NPC purse; it never goes below zero.
func (r *MarketRepository) AdjustPurse(ctx context.Context, campaignID, npcID, amount int64, set bool) (int64, error) {
	if set && amount < 0 {
		return 0, ErrInsufficientPurse
	}
	q := `UPDATE campaign_npcs SET purse_cp = purse_cp + $3, updated_at=NOW() WHERE campaign_id=$1 AND id=$2 AND purse_cp + $3 >= 0 RETURNING purse_cp`
	if set {
		q = `UPDATE campaign_npcs SET purse_cp = $3, updated_at=NOW() WHERE campaign_id=$1 AND id=$2 RETURNING purse_cp`
	}
	var purse int64
	err := r.db.GetContext(ctx, &purse, q, campaignID, npcID, amount)
	if errors.Is(err, sql.ErrNoRows) {
		if _, nerr := r.NPCInCampaign(ctx, campaignID, npcID); nerr != nil {
			return 0, nerr
		}
		return 0, ErrInsufficientPurse
	}
	return purse, err
}

// characterInCampaign locks nothing; it only proves the character belongs to the campaign.
func characterInCampaign(ctx context.Context, q sqlGetter, campaignID, characterID int64) error {
	var id int64
	err := q.GetContext(ctx, &id, `SELECT id FROM characters WHERE id=$1 AND campaign_id=$2`, characterID, campaignID)
	return marketNotFound(err)
}

type sqlGetter interface {
	GetContext(ctx context.Context, dest any, query string, args ...any) error
}

// GiveNPCItem moves qty of an NPC item to a character's inventory in one transaction (§5).
func (r *MarketRepository) GiveNPCItem(ctx context.Context, campaignID, itemID, characterID int64, qty int) error {
	if qty < 1 {
		return ErrNotEnoughItems
	}
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var it struct {
		Name        string `db:"name"`
		Quantity    int    `db:"quantity"`
		ValueCP     *int64 `db:"value_cp"`
		Description string `db:"description"`
	}
	err = tx.GetContext(ctx, &it, `SELECT i.name, i.quantity, i.value_cp, i.description FROM npc_items i
		JOIN campaign_npcs n ON n.id = i.npc_id WHERE n.campaign_id=$1 AND i.id=$2 FOR UPDATE OF i`, campaignID, itemID)
	if err != nil {
		return marketNotFound(err)
	}
	if qty > it.Quantity {
		return ErrNotEnoughItems
	}
	if err := characterInCampaign(ctx, tx, campaignID, characterID); err != nil {
		return err
	}
	if qty == it.Quantity {
		_, err = tx.ExecContext(ctx, `DELETE FROM npc_items WHERE id=$1`, itemID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE npc_items SET quantity = quantity - $2 WHERE id=$1`, itemID, qty)
	}
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO inventory_items (character_id, name, quantity, description, is_tradeable, value_cp)
		VALUES ($1,$2,$3,$4,true,$5)`, characterID, it.Name, qty, it.Description, it.ValueCP); err != nil {
		return err
	}
	return tx.Commit()
}

// GiveNPCCoins moves cp copper from an NPC purse to a character wallet (as gold/silver/copper).
func (r *MarketRepository) GiveNPCCoins(ctx context.Context, campaignID, npcID, characterID, cp int64) error {
	if cp < 1 {
		return ErrInsufficientPurse
	}
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var purse int64
	if err := tx.GetContext(ctx, &purse, `SELECT purse_cp FROM campaign_npcs WHERE campaign_id=$1 AND id=$2 FOR UPDATE`, campaignID, npcID); err != nil {
		return marketNotFound(err)
	}
	if purse < cp {
		return ErrInsufficientPurse
	}
	if err := characterInCampaign(ctx, tx, campaignID, characterID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE campaign_npcs SET purse_cp = purse_cp - $2, updated_at=NOW() WHERE id=$1`, npcID, cp); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE characters SET gold = gold + $2, silver = silver + $3, copper = copper + $4, updated_at=NOW() WHERE id=$1`,
		characterID, cp/100, cp%100/10, cp%10); err != nil {
		return err
	}
	return tx.Commit()
}
