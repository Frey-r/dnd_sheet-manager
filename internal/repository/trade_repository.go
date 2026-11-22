package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

var (
	ErrInsufficientGold = errors.New("insufficient gold balance")
	ErrTradeUnavailable = errors.New("trade is no longer pending")
	ErrTradeItem        = errors.New("item cannot be traded (equipped, quest-bound, locked or not owned)")
	ErrTradeEmpty       = errors.New("a trade must include items or gold")
	// ErrTradeInvalidated is returned when accepting a trade finds one of its items gone
	// (user-stories.md: Trade Conflict). The offer is stored as invalidated.
	ErrTradeInvalidated = errors.New("Trade invalidated: item no longer available")
)

// InsufficientGoldError carries the amounts of a rejected trade. It matches
// ErrInsufficientGold with errors.Is. Messages follow user-stories.md: a trade
// reads "Insufficient gold: attempted 500, available 300"; a gold-only transfer
// reads "Insufficient gold balance".
type InsufficientGoldError struct {
	Attempted, Available int
	GoldOnly             bool
}

func (e *InsufficientGoldError) Error() string {
	if e.GoldOnly {
		return "Insufficient gold balance"
	}
	return fmt.Sprintf("Insufficient gold: attempted %d, available %d", e.Attempted, e.Available)
}

func (e *InsufficientGoldError) Is(target error) bool { return target == ErrInsufficientGold }

func decodeIDs(raw string) []int64 {
	var ids []int64
	_ = json.Unmarshal([]byte(raw), &ids)
	return ids
}

func tradeable(items []domain.InventoryItem, characterID int64, ids []int64, locked bool) bool {
	if len(items) != len(ids) {
		return false
	}
	seen := map[int64]bool{}
	for _, item := range items {
		if item.CharacterID != characterID || !item.IsTradeable || item.QuestBound || item.IsEquipped || item.TradeLocked != locked || seen[item.ID] {
			return false
		}
		seen[item.ID] = true
	}
	return true
}

func lockItems(ctx context.Context, tx *sqlx.Tx, ids []int64) ([]domain.InventoryItem, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	items := []domain.InventoryItem{}
	err := sqlx.SelectContext(ctx, tx, &items, `SELECT * FROM inventory_items WHERE id=ANY($1) ORDER BY id FOR UPDATE`, pq.Array(ids))
	return items, err
}

func (r *TradeRepository) CreateTransactional(ctx context.Context, offeror *domain.Character, recipient *domain.Character, req *domain.CreateTradeRequest) (*domain.TradeOffer, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	offer, err := createTradeTx(ctx, tx, offeror, recipient, req)
	if err != nil {
		return nil, err
	}
	return offer, tx.Commit()
}

// CounterTransactional rejects the original offer and files the counter-offer in one
// transaction: when the counter cannot be created (gold, items) the original stays pending.
func (r *TradeRepository) CounterTransactional(ctx context.Context, tradeID int64, offeror, recipient *domain.Character, req *domain.CreateTradeRequest) (*domain.TradeOffer, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	_, expired, err := finishTradeTx(ctx, tx, tradeID, domain.TradeRejected)
	if err != nil {
		return nil, err
	}
	if expired {
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return nil, ErrTradeUnavailable
	}
	offer, err := createTradeTx(ctx, tx, offeror, recipient, req)
	if err != nil {
		return nil, err
	}
	return offer, tx.Commit()
}

func createTradeTx(ctx context.Context, tx *sqlx.Tx, offeror *domain.Character, recipient *domain.Character, req *domain.CreateTradeRequest) (*domain.TradeOffer, error) {
	var offerorGold, recipientGold int
	if err := tx.QueryRowContext(ctx, `SELECT gold FROM characters WHERE id=$1 FOR UPDATE`, offeror.ID).Scan(&offerorGold); err != nil {
		return nil, err
	}
	if err := tx.QueryRowContext(ctx, `SELECT gold FROM characters WHERE id=$1 FOR UPDATE`, recipient.ID).Scan(&recipientGold); err != nil {
		return nil, err
	}
	goldOnly := len(req.OfferedItemIDs) == 0 && len(req.RequestedItemIDs) == 0
	if req.OfferedGold < 0 || req.RequestedGold < 0 {
		return nil, &InsufficientGoldError{Attempted: max(req.OfferedGold, req.RequestedGold), GoldOnly: goldOnly}
	}
	// Gold already promised in other pending offers is locked (architecture.md: Trade System).
	var reserved int
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(offered_gold), 0) FROM trade_offers
		WHERE offeror_character_id=$1 AND status='pending' AND expires_at > NOW()`, offeror.ID).Scan(&reserved); err != nil {
		return nil, err
	}
	if available := offerorGold - reserved; req.OfferedGold > available {
		return nil, &InsufficientGoldError{Attempted: req.OfferedGold, Available: max(available, 0), GoldOnly: goldOnly}
	}
	if req.RequestedGold > recipientGold {
		return nil, &InsufficientGoldError{Attempted: req.RequestedGold, Available: recipientGold, GoldOnly: goldOnly}
	}
	if req.OfferedGold == 0 && req.RequestedGold == 0 && len(req.OfferedItemIDs) == 0 && len(req.RequestedItemIDs) == 0 {
		return nil, ErrTradeEmpty
	}
	offered, err := lockItems(ctx, tx, req.OfferedItemIDs)
	if err != nil || !tradeable(offered, offeror.ID, req.OfferedItemIDs, false) {
		return nil, ErrTradeItem
	}
	requested, err := lockItems(ctx, tx, req.RequestedItemIDs)
	if err != nil || !tradeable(requested, recipient.ID, req.RequestedItemIDs, false) {
		return nil, ErrTradeItem
	}
	if len(req.OfferedItemIDs) > 0 {
		if _, err := tx.ExecContext(ctx, `UPDATE inventory_items SET trade_locked=true WHERE id=ANY($1)`, pq.Array(req.OfferedItemIDs)); err != nil {
			return nil, err
		}
	}
	offer := &domain.TradeOffer{CampaignID: offeror.CampaignID, OfferorCharacterID: offeror.ID, RecipientCharacterID: recipient.ID,
		OfferedItemIDs: mustJSON(req.OfferedItemIDs), OfferedGold: req.OfferedGold, RequestedItemIDs: mustJSON(req.RequestedItemIDs),
		RequestedGold: req.RequestedGold, Status: domain.TradePending, ExpiresAt: time.Now().Add(10 * time.Minute)}
	err = tx.QueryRowContext(ctx, `INSERT INTO trade_offers (campaign_id, offeror_character_id, recipient_character_id, offered_item_ids,
		offered_gold, requested_item_ids, requested_gold, status, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
		offer.CampaignID, offer.OfferorCharacterID, offer.RecipientCharacterID, offer.OfferedItemIDs, offer.OfferedGold,
		offer.RequestedItemIDs, offer.RequestedGold, offer.Status, offer.ExpiresAt).Scan(&offer.ID, &offer.CreatedAt)
	if err != nil {
		return nil, err
	}
	return offer, nil
}

func mustJSON(value any) string {
	data, _ := json.Marshal(value)
	return string(data)
}

func (r *TradeRepository) AcceptTransactional(ctx context.Context, tradeID int64) (*domain.TradeOffer, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var offer domain.TradeOffer
	if err := tx.QueryRowxContext(ctx, `SELECT * FROM trade_offers WHERE id=$1 FOR UPDATE`, tradeID).StructScan(&offer); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrResourceNotFound
		}
		return nil, err
	}
	if offer.Status != domain.TradePending {
		return nil, ErrTradeUnavailable
	}
	if !offer.ExpiresAt.After(time.Now()) {
		// Expired but not swept yet: close it now so its items are released.
		if err := releaseTrade(ctx, tx, &offer, domain.TradeExpired); err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return nil, ErrTradeUnavailable
	}
	chars := []domain.Character{}
	if err := tx.SelectContext(ctx, &chars, `SELECT * FROM characters WHERE id=ANY($1) ORDER BY id FOR UPDATE`, pq.Array([]int64{offer.OfferorCharacterID, offer.RecipientCharacterID})); err != nil || len(chars) != 2 {
		return nil, ErrTradeUnavailable
	}
	byID := map[int64]*domain.Character{chars[0].ID: &chars[0], chars[1].ID: &chars[1]}
	offeror, recipient := byID[offer.OfferorCharacterID], byID[offer.RecipientCharacterID]
	// decodeIDs, not a string compare: omitted item lists are stored as "null", not "[]".
	goldOnly := len(decodeIDs(offer.OfferedItemIDs)) == 0 && len(decodeIDs(offer.RequestedItemIDs)) == 0
	if offer.OfferedGold > offeror.Gold {
		return nil, &InsufficientGoldError{Attempted: offer.OfferedGold, Available: offeror.Gold, GoldOnly: goldOnly}
	}
	if offer.RequestedGold > recipient.Gold {
		return nil, &InsufficientGoldError{Attempted: offer.RequestedGold, Available: recipient.Gold, GoldOnly: goldOnly}
	}
	offeredIDs, requestedIDs := decodeIDs(offer.OfferedItemIDs), decodeIDs(offer.RequestedItemIDs)
	offered, err := lockItems(ctx, tx, offeredIDs)
	if err != nil {
		return nil, err
	}
	requested, err := lockItems(ctx, tx, requestedIDs)
	if err != nil {
		return nil, err
	}
	if !tradeable(offered, offeror.ID, offeredIDs, true) || !tradeable(requested, recipient.ID, requestedIDs, false) {
		// Conflict: an item left the inventory (or became untradeable) since the offer.
		// The trade is invalidated and the offeror's locks released (user-stories.md).
		if err := releaseTrade(ctx, tx, &offer, domain.TradeInvalidated); err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return nil, ErrTradeInvalidated
	}
	if _, err := tx.ExecContext(ctx, `UPDATE characters SET gold=gold+$1 WHERE id=$2`, offer.RequestedGold-offer.OfferedGold, offeror.ID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE characters SET gold=gold+$1 WHERE id=$2`, offer.OfferedGold-offer.RequestedGold, recipient.ID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE inventory_items SET character_id=$1, trade_locked=false, updated_at=NOW() WHERE id=ANY($2)`, recipient.ID, pq.Array(offeredIDs)); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE inventory_items SET character_id=$1, is_equipped=false, updated_at=NOW() WHERE id=ANY($2)`, offeror.ID, pq.Array(requestedIDs)); err != nil {
		return nil, err
	}
	offer.Status = domain.TradeAccepted
	if _, err := tx.ExecContext(ctx, `UPDATE trade_offers SET status=$1 WHERE id=$2`, offer.Status, offer.ID); err != nil {
		return nil, err
	}
	return &offer, tx.Commit()
}

// releaseTrade unlocks the offered items and stores the final status of a pending offer.
func releaseTrade(ctx context.Context, tx *sqlx.Tx, offer *domain.TradeOffer, status domain.TradeStatus) error {
	if _, err := tx.ExecContext(ctx, `UPDATE inventory_items SET trade_locked=false WHERE id=ANY($1)`, pq.Array(decodeIDs(offer.OfferedItemIDs))); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE trade_offers SET status=$1 WHERE id=$2`, status, offer.ID); err != nil {
		return err
	}
	offer.Status = status
	return nil
}

// finishTradeTx closes a pending offer inside tx. A pending offer past its TTL is stored as
// expired regardless of the requested status and reported through the bool.
func finishTradeTx(ctx context.Context, tx *sqlx.Tx, tradeID int64, status domain.TradeStatus) (*domain.TradeOffer, bool, error) {
	var offer domain.TradeOffer
	if err := tx.QueryRowxContext(ctx, `SELECT * FROM trade_offers WHERE id=$1 FOR UPDATE`, tradeID).StructScan(&offer); err != nil {
		if err == sql.ErrNoRows {
			return nil, false, ErrResourceNotFound
		}
		return nil, false, err
	}
	if offer.Status != domain.TradePending {
		return nil, false, ErrTradeUnavailable
	}
	expired := offer.ExpiresAt.Before(time.Now())
	if expired {
		status = domain.TradeExpired
	}
	if err := releaseTrade(ctx, tx, &offer, status); err != nil {
		return nil, false, err
	}
	return &offer, expired, nil
}

// FinishTransactional moves a pending offer to rejected/cancelled/expired and releases its
// locks. Closing an offer already past its TTL stores it as expired and reports
// ErrTradeUnavailable (unless expiry was the requested outcome).
func (r *TradeRepository) FinishTransactional(ctx context.Context, tradeID int64, status domain.TradeStatus) (*domain.TradeOffer, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	offer, expired, err := finishTradeTx(ctx, tx, tradeID, status)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	if expired && status != domain.TradeExpired {
		return offer, ErrTradeUnavailable
	}
	return offer, nil
}

func (r *TradeRepository) ListForUser(ctx context.Context, userID int64) ([]domain.TradeOffer, error) {
	offers := []domain.TradeOffer{}
	err := r.db.SelectContext(ctx, &offers, `SELECT DISTINCT t.* FROM trade_offers t JOIN characters a ON a.id=t.offeror_character_id
		JOIN characters b ON b.id=t.recipient_character_id JOIN campaign_members cm ON cm.campaign_id=t.campaign_id
		WHERE cm.user_id=$1 AND (a.user_id=$1 OR b.user_id=$1 OR cm.role='gm') ORDER BY t.created_at DESC`, userID)
	if err != nil || len(offers) == 0 {
		return offers, err
	}
	ids := []int64{}
	for _, offer := range offers {
		ids = append(ids, decodeIDs(offer.OfferedItemIDs)...)
		ids = append(ids, decodeIDs(offer.RequestedItemIDs)...)
	}
	items := []domain.TradeItemRef{}
	if len(ids) > 0 {
		if err := r.db.SelectContext(ctx, &items, `SELECT id, name, COALESCE(quantity, 1) AS quantity FROM inventory_items WHERE id=ANY($1)`, pq.Array(ids)); err != nil {
			return nil, err
		}
	}
	domain.NameTradeItems(offers, items, decodeIDs)
	return offers, nil
}

func (r *TradeRepository) Purchase(ctx context.Context, campaignID, itemID, characterID int64) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var item domain.MarketplaceItem
	if err := tx.QueryRowxContext(ctx, `SELECT * FROM marketplace_items WHERE id=$1 AND campaign_id=$2 FOR UPDATE`, itemID, campaignID).StructScan(&item); err != nil {
		if err == sql.ErrNoRows {
			return ErrResourceNotFound
		}
		return err
	}
	if item.Stock < 1 {
		return ErrTradeItem
	}
	result, err := tx.ExecContext(ctx, `UPDATE characters SET gold=gold-$1, updated_at=NOW() WHERE id=$2 AND campaign_id=$3 AND gold >= $1`, item.Price, characterID, campaignID)
	if err != nil {
		return err
	}
	if changed, _ := result.RowsAffected(); changed != 1 {
		return ErrInsufficientGold
	}
	if _, err := tx.ExecContext(ctx, `UPDATE marketplace_items SET stock=stock-1 WHERE id=$1`, item.ID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO inventory_items (character_id, name, item_type, rarity, weight, quantity, description, requires_attunement, is_tradeable, srd_ref_id)
		VALUES ($1,$2,$3,$4,$5,1,$6,$7,true,$8)`, characterID, item.Name, item.ItemType, item.Rarity, item.Weight, item.Description, item.AttunementRequired, item.SRDRefID)
	if err != nil {
		return err
	}
	return tx.Commit()
}
