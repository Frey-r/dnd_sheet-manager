package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// Market persistence (openspec/specs/market-bastions.md §3–§5).

var (
	ErrMarketNotFound = errors.New("market resource not found")
	ErrOutOfStock     = errors.New("sin existencias")
	ErrNotEnoughItems = errors.New("no tienes suficientes unidades")
	ErrNotSellable    = errors.New("ese objeto no se puede vender")
)

type MarketRepository struct{ db *sqlx.DB }

func NewMarketRepository(db *sqlx.DB) *MarketRepository { return &MarketRepository{db: db} }

const shopSelect = `
	SELECT s.*, COALESCE(n.name, '') AS npc_name, COALESCE(v.name, '') AS scene_name,
	       (SELECT COUNT(*) FROM shop_items i WHERE i.shop_id = s.id AND i.stock <> 0) AS item_count
	FROM shops s
	LEFT JOIN campaign_npcs n ON n.id = s.npc_id
	LEFT JOIN vtt_scenes v ON v.id = s.scene_id`

func marketNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrMarketNotFound
	}
	return err
}

func (r *MarketRepository) Shops(ctx context.Context, campaignID int64) ([]domain.Shop, error) {
	shops := []domain.Shop{}
	err := r.db.SelectContext(ctx, &shops, shopSelect+` WHERE s.campaign_id=$1 ORDER BY s.name`, campaignID)
	return shops, err
}

func (r *MarketRepository) Shop(ctx context.Context, campaignID, id int64) (*domain.Shop, error) {
	var s domain.Shop
	if err := r.db.GetContext(ctx, &s, shopSelect+` WHERE s.campaign_id=$1 AND s.id=$2`, campaignID, id); err != nil {
		return nil, marketNotFound(err)
	}
	return &s, nil
}

// SaveShop inserts (ID 0) or updates a shop.
func (r *MarketRepository) SaveShop(ctx context.Context, s *domain.Shop) error {
	if s.BuysTypes == nil {
		s.BuysTypes = []string{}
	}
	if s.ID == 0 {
		return r.db.QueryRowxContext(ctx, `
			INSERT INTO shops (campaign_id, name, description, icon, npc_id, availability, scene_id, object_id, price_pct, buy_rate_pct, buys_types)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, created_at, updated_at`,
			s.CampaignID, s.Name, s.Description, s.Icon, s.NPCID, s.Availability, s.SceneID, s.ObjectID, s.PricePct, s.BuyRatePct, s.BuysTypes,
		).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
	}
	res, err := r.db.ExecContext(ctx, `
		UPDATE shops SET name=$3, description=$4, icon=$5, npc_id=$6, availability=$7, scene_id=$8, object_id=$9,
		       price_pct=$10, buy_rate_pct=$11, buys_types=$12, updated_at=NOW()
		WHERE campaign_id=$1 AND id=$2`,
		s.CampaignID, s.ID, s.Name, s.Description, s.Icon, s.NPCID, s.Availability, s.SceneID, s.ObjectID, s.PricePct, s.BuyRatePct, s.BuysTypes)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrMarketNotFound
	}
	return nil
}

func (r *MarketRepository) DeleteShop(ctx context.Context, campaignID, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM shops WHERE campaign_id=$1 AND id=$2`, campaignID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrMarketNotFound
	}
	return nil
}

func (r *MarketRepository) ShopItems(ctx context.Context, shopID int64) ([]domain.ShopItem, error) {
	items := []domain.ShopItem{}
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM shop_items WHERE shop_id=$1 ORDER BY item_type, name`, shopID)
	return items, err
}

// ShopItem returns an item of a shop of the campaign.
func (r *MarketRepository) ShopItem(ctx context.Context, campaignID, id int64) (*domain.ShopItem, error) {
	var it domain.ShopItem
	err := r.db.GetContext(ctx, &it, `SELECT i.* FROM shop_items i JOIN shops s ON s.id=i.shop_id WHERE s.campaign_id=$1 AND i.id=$2`, campaignID, id)
	if err != nil {
		return nil, marketNotFound(err)
	}
	return &it, nil
}

func (r *MarketRepository) SaveShopItem(ctx context.Context, it *domain.ShopItem) error {
	if it.ID == 0 {
		return r.db.QueryRowxContext(ctx, `
			INSERT INTO shop_items (shop_id, name, item_type, rarity, price_cp, weight, description, attunement_required, srd_ref_id, srd_kind, stock)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, created_at, updated_at`,
			it.ShopID, it.Name, it.ItemType, it.Rarity, it.PriceCP, it.Weight, it.Description, it.AttunementRequired, it.SRDRefID, it.SRDKind, it.Stock,
		).Scan(&it.ID, &it.CreatedAt, &it.UpdatedAt)
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE shop_items SET name=$2, item_type=$3, rarity=$4, price_cp=$5, weight=$6, description=$7,
		       attunement_required=$8, stock=$9, updated_at=NOW()
		WHERE id=$1`,
		it.ID, it.Name, it.ItemType, it.Rarity, it.PriceCP, it.Weight, it.Description, it.AttunementRequired, it.Stock)
	return err
}

func (r *MarketRepository) DeleteShopItem(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM shop_items WHERE id=$1`, id)
	return err
}

// ShopForObject returns the shop linked to a map object (0 when none).
func (r *MarketRepository) ShopForObject(ctx context.Context, objectID int64) (int64, error) {
	var id int64
	err := r.db.GetContext(ctx, &id, `SELECT id FROM shops WHERE object_id=$1`, objectID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return id, err
}

// ActiveSceneID returns the campaign's active scene (0 when none).
func (r *MarketRepository) ActiveSceneID(ctx context.Context, campaignID int64) (int64, error) {
	var id int64
	err := r.db.GetContext(ctx, &id, `SELECT id FROM vtt_scenes WHERE campaign_id=$1 AND is_active`, campaignID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return id, err
}

// NearObject reports whether the user's character token stands within reach (1.5 cells) of a
// map object, on the object's scene.
func (r *MarketRepository) NearObject(ctx context.Context, objectID, userID int64) (bool, int64, error) {
	var row struct {
		SceneID int64 `db:"scene_id"`
		Near    bool  `db:"near"`
	}
	err := r.db.GetContext(ctx, &row, `
		SELECT o.scene_id,
		       EXISTS (SELECT 1 FROM vtt_tokens t
		               WHERE t.scene_id = o.scene_id AND t.owner_user_id = $2 AND t.character_id IS NOT NULL
		                 AND sqrt(power(t.x - o.x, 2) + power(t.y - o.y, 2)) <= sc.grid_size_px * 1.5) AS near
		FROM vtt_objects o JOIN vtt_scenes sc ON sc.id = o.scene_id
		WHERE o.id = $1`, objectID, userID)
	if err != nil {
		return false, 0, marketNotFound(err)
	}
	return row.Near, row.SceneID, nil
}

// CharacterOf returns the user's character in the campaign.
func (r *MarketRepository) CharacterOf(ctx context.Context, campaignID, userID int64) (int64, error) {
	var id int64
	err := r.db.GetContext(ctx, &id, `SELECT id FROM characters WHERE campaign_id=$1 AND user_id=$2 ORDER BY id LIMIT 1`, campaignID, userID)
	return id, marketNotFound(err)
}

// CharacterInCampaign checks that a character belongs to the campaign.
func (r *MarketRepository) CharacterInCampaign(ctx context.Context, campaignID, characterID int64) (int64, error) {
	var id int64
	err := r.db.GetContext(ctx, &id, `SELECT id FROM characters WHERE campaign_id=$1 AND id=$2`, campaignID, characterID)
	return id, marketNotFound(err)
}

// Wallet coins of a character, locked for update inside tx.
type walletRow struct {
	Gold   int `db:"gold"`
	Silver int `db:"silver"`
	Copper int `db:"copper"`
}

func lockWallet(ctx context.Context, tx *sqlx.Tx, characterID int64) (walletRow, error) {
	var w walletRow
	err := tx.GetContext(ctx, &w, `SELECT gold, silver, copper FROM characters WHERE id=$1 FOR UPDATE`, characterID)
	return w, marketNotFound(err)
}

func saveWallet(ctx context.Context, tx *sqlx.Tx, characterID int64, w walletRow) error {
	_, err := tx.ExecContext(ctx, `UPDATE characters SET gold=$2, silver=$3, copper=$4, updated_at=NOW() WHERE id=$1`, characterID, w.Gold, w.Silver, w.Copper)
	return err
}

// WalletFunc transforms coins; it returns an error to abort the transaction.
type WalletFunc func(gold, silver, copper int) (int, int, int, error)

// Buy moves qty units of a shop item to the character, charging unitPrice each.
func (r *MarketRepository) Buy(ctx context.Context, itemID, characterID int64, qty int, unitPrice int64, pay WalletFunc) (*domain.ShopItem, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var it domain.ShopItem
	if err := tx.GetContext(ctx, &it, `SELECT * FROM shop_items WHERE id=$1 FOR UPDATE`, itemID); err != nil {
		return nil, marketNotFound(err)
	}
	if it.Stock != -1 && it.Stock < qty {
		return nil, ErrOutOfStock
	}
	w, err := lockWallet(ctx, tx, characterID)
	if err != nil {
		return nil, err
	}
	g, s, c, err := pay(w.Gold, w.Silver, w.Copper)
	if err != nil {
		return nil, err
	}
	if err := saveWallet(ctx, tx, characterID, walletRow{g, s, c}); err != nil {
		return nil, err
	}
	if it.Stock != -1 {
		if _, err := tx.ExecContext(ctx, `UPDATE shop_items SET stock=stock-$2, updated_at=NOW() WHERE id=$1`, it.ID, qty); err != nil {
			return nil, err
		}
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO inventory_items (character_id, name, item_type, rarity, weight, quantity, description, requires_attunement, is_tradeable, srd_ref_id, value_cp)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,
		characterID, it.Name, it.ItemType, it.Rarity, it.Weight, qty, it.Description, it.AttunementRequired, srdEquipmentRef(it), it.PriceCP)
	if err != nil {
		return nil, err
	}
	return &it, tx.Commit()
}

// srdEquipmentRef keeps the inventory's srd_ref_id (an srd_equipment FK) only for equipment.
func srdEquipmentRef(it domain.ShopItem) *int64 {
	if it.SRDKind != nil && *it.SRDKind == "equipment" {
		return it.SRDRefID
	}
	return nil
}

// SellResult describes a completed sale to a shop.
type SellResult struct {
	Name     string
	Qty      int
	ValueCP  int64
	PayoutCP int64
}

// SellToShop sells qty units of an inventory item to a shop paying floor(value × ratePct / 100)
// per unit. buysTypes empty = the shop buys anything.
func (r *MarketRepository) SellToShop(ctx context.Context, shopID, inventoryID, characterID int64, qty, ratePct int, buysTypes []string) (*SellResult, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var inv domain.InventoryItem
	if err := tx.GetContext(ctx, &inv, `SELECT * FROM inventory_items WHERE id=$1 AND character_id=$2 FOR UPDATE`, inventoryID, characterID); err != nil {
		return nil, marketNotFound(err)
	}
	if inv.QuestBound || inv.TradeLocked || inv.IsEquipped || !inv.IsTradeable || inv.ValueCP == nil || *inv.ValueCP <= 0 {
		return nil, ErrNotSellable
	}
	if !typeAccepted(buysTypes, string(inv.ItemType)) || ratePct <= 0 {
		return nil, ErrNotSellable
	}
	if inv.Quantity < qty {
		return nil, ErrNotEnoughItems
	}
	w, err := lockWallet(ctx, tx, characterID)
	if err != nil {
		return nil, err
	}
	payout := *inv.ValueCP * int64(ratePct) / 100 * int64(qty)
	w.Gold += int(payout / 100)
	w.Silver += int(payout % 100 / 10)
	w.Copper += int(payout % 10)
	if err := saveWallet(ctx, tx, characterID, w); err != nil {
		return nil, err
	}
	if inv.Quantity == qty {
		_, err = tx.ExecContext(ctx, `DELETE FROM inventory_items WHERE id=$1`, inv.ID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE inventory_items SET quantity=quantity-$2, updated_at=NOW() WHERE id=$1`, inv.ID, qty)
	}
	if err != nil {
		return nil, err
	}
	// The shop now offers it at full value; stack with an identical line when present.
	res, err := tx.ExecContext(ctx, `UPDATE shop_items SET stock=stock+$4, updated_at=NOW()
		WHERE id = (SELECT id FROM shop_items WHERE shop_id=$1 AND lower(name)=lower($2) AND price_cp=$3 AND stock >= 0 LIMIT 1)`,
		shopID, inv.Name, *inv.ValueCP, qty)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		var kind *string
		if inv.SRDRefID != nil {
			k := "equipment"
			kind = &k
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO shop_items (shop_id, name, item_type, rarity, price_cp, weight, description, attunement_required, srd_ref_id, srd_kind, stock)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			shopID, inv.Name, inv.ItemType, inv.Rarity, *inv.ValueCP, inv.Weight, inv.Description, inv.RequiresAttunement, inv.SRDRefID, kind, qty); err != nil {
			return nil, err
		}
	}
	return &SellResult{Name: inv.Name, Qty: qty, ValueCP: *inv.ValueCP, PayoutCP: payout}, tx.Commit()
}

func typeAccepted(types []string, itemType string) bool {
	if len(types) == 0 {
		return true
	}
	for _, t := range types {
		if strings.EqualFold(t, itemType) {
			return true
		}
	}
	return false
}

// SellableItem is an inventory line a shop could buy.
type SellableItem struct {
	ID       int64  `db:"id" json:"id"`
	Name     string `db:"name" json:"name"`
	ItemType string `db:"item_type" json:"item_type"`
	Quantity int    `db:"quantity" json:"quantity"`
	ValueCP  *int64 `db:"value_cp" json:"value_cp"`
	Blocked  bool   `db:"blocked" json:"blocked"`
}

func (r *MarketRepository) Sellable(ctx context.Context, characterID int64) ([]SellableItem, error) {
	items := []SellableItem{}
	err := r.db.SelectContext(ctx, &items, `
		SELECT id, name, item_type, quantity, value_cp,
		       (quest_bound OR trade_locked OR is_equipped OR NOT is_tradeable) AS blocked
		FROM inventory_items WHERE character_id=$1 ORDER BY name`, characterID)
	return items, err
}

// ---------- NPC belongings ----------

func (r *MarketRepository) NPCInCampaign(ctx context.Context, campaignID, npcID int64) (string, error) {
	var name string
	err := r.db.GetContext(ctx, &name, `SELECT name FROM campaign_npcs WHERE campaign_id=$1 AND id=$2`, campaignID, npcID)
	return name, marketNotFound(err)
}

func (r *MarketRepository) NPCItems(ctx context.Context, npcID int64) ([]domain.NPCItem, error) {
	items := []domain.NPCItem{}
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM npc_items WHERE npc_id=$1 ORDER BY location, name`, npcID)
	return items, err
}

func (r *MarketRepository) SaveNPCItem(ctx context.Context, it *domain.NPCItem) error {
	it.Location = strings.ToLower(it.Location)
	if it.Location != "home" {
		it.Location = "inventory"
	}
	if it.Quantity < 1 {
		it.Quantity = 1
	}
	if it.Location == "home" {
		it.Equipped = false // only what the NPC carries can be equipped (npc-agenda.md §7)
	}
	if it.ID == 0 {
		return r.db.QueryRowxContext(ctx, `
			INSERT INTO npc_items (npc_id, name, quantity, value_cp, description, location, source, equipped)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
			it.NPCID, it.Name, it.Quantity, it.ValueCP, it.Description, it.Location, it.Source, it.Equipped).Scan(&it.ID, &it.CreatedAt)
	}
	_, err := r.db.ExecContext(ctx, `UPDATE npc_items SET name=$2, quantity=$3, value_cp=$4, description=$5, location=$6, source=$7, equipped=$8 WHERE id=$1`,
		it.ID, it.Name, it.Quantity, it.ValueCP, it.Description, it.Location, it.Source, it.Equipped)
	return err
}

// NPCItem returns an NPC item if its NPC belongs to the campaign.
func (r *MarketRepository) NPCItem(ctx context.Context, campaignID, id int64) (*domain.NPCItem, error) {
	var it domain.NPCItem
	err := r.db.GetContext(ctx, &it, `SELECT i.* FROM npc_items i JOIN campaign_npcs n ON n.id=i.npc_id WHERE n.campaign_id=$1 AND i.id=$2`, campaignID, id)
	if err != nil {
		return nil, marketNotFound(err)
	}
	return &it, nil
}

func (r *MarketRepository) DeleteNPCItem(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM npc_items WHERE id=$1`, id)
	return err
}

// ---------- Haggling over a cart ----------

var (
	ErrOfferActive   = errors.New("ya tienes un pedido en curso; espera al vendedor o retíralo")
	ErrOfferResolved = errors.New("ese pedido ya no está activo")
)

const offerSelect = `
	SELECT o.*, s.name AS shop_name, c.name AS character_name, COALESCE(n.name, '') AS npc_name
	FROM shop_offers o
	JOIN shops s ON s.id = o.shop_id
	JOIN characters c ON c.id = o.character_id
	LEFT JOIN campaign_npcs n ON n.id = s.npc_id`

// CreateOffer stores the offer and its cart lines.
func (r *MarketRepository) CreateOffer(ctx context.Context, o *domain.ShopOffer) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	err = tx.QueryRowxContext(ctx, `
		INSERT INTO shop_offers (campaign_id, shop_id, item_id, character_id, user_id, qty, list_cp, offered_cp, message, skill, roll_total, roll_detail)
		VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, status, created_at`,
		o.CampaignID, o.ShopID, o.CharacterID, o.UserID, o.Qty, o.ListCP, o.OfferedCP, o.Message, o.Skill, o.RollTotal, o.RollDetail,
	).Scan(&o.ID, &o.Status, &o.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "shop_offers_one_active") {
			return ErrOfferActive
		}
		return err
	}
	for i := range o.Lines {
		l := &o.Lines[i]
		l.OfferID = o.ID
		if err := tx.QueryRowxContext(ctx, `INSERT INTO shop_offer_lines (offer_id, item_id, name, qty, unit_list_cp) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			o.ID, l.ItemID, l.Name, l.Qty, l.UnitListCP).Scan(&l.ID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// withLines loads the cart lines of the offers and builds their summaries.
func (r *MarketRepository) withLines(ctx context.Context, offers []domain.ShopOffer) ([]domain.ShopOffer, error) {
	if len(offers) == 0 {
		return offers, nil
	}
	ids := make([]int64, len(offers))
	for i, o := range offers {
		ids[i] = o.ID
	}
	lines := []domain.ShopOfferLine{}
	if err := r.db.SelectContext(ctx, &lines, `SELECT * FROM shop_offer_lines WHERE offer_id = ANY($1) ORDER BY id`, pq.Array(ids)); err != nil {
		return nil, err
	}
	by := map[int64][]domain.ShopOfferLine{}
	for _, l := range lines {
		by[l.OfferID] = append(by[l.OfferID], l)
	}
	for i := range offers {
		offers[i].Lines = by[offers[i].ID]
		if offers[i].Lines == nil {
			offers[i].Lines = []domain.ShopOfferLine{}
		}
		parts := []string{}
		for _, l := range offers[i].Lines {
			if l.Qty > 1 {
				parts = append(parts, fmt.Sprintf("%d × %s", l.Qty, l.Name))
			} else {
				parts = append(parts, l.Name)
			}
		}
		offers[i].Summary = strings.Join(parts, ", ")
	}
	return offers, nil
}

// ActiveOffers lists pending/countered offers of a campaign (oldest first); userID > 0 limits
// them to that player.
func (r *MarketRepository) ActiveOffers(ctx context.Context, campaignID, userID int64) ([]domain.ShopOffer, error) {
	offers := []domain.ShopOffer{}
	q := offerSelect + ` WHERE o.campaign_id=$1 AND o.status IN ('pending','countered') AND ($2 = 0 OR o.user_id = $2) ORDER BY o.created_at`
	if err := r.db.SelectContext(ctx, &offers, q, campaignID, userID); err != nil {
		return nil, err
	}
	return r.withLines(ctx, offers)
}

// RecentOffers returns the player's offers resolved in the last minutes (to show the outcome).
func (r *MarketRepository) RecentOffers(ctx context.Context, campaignID, userID int64) ([]domain.ShopOffer, error) {
	offers := []domain.ShopOffer{}
	q := offerSelect + ` WHERE o.campaign_id=$1 AND o.user_id=$2 AND o.resolved_at > NOW() - INTERVAL '10 minutes' ORDER BY o.resolved_at DESC LIMIT 5`
	if err := r.db.SelectContext(ctx, &offers, q, campaignID, userID); err != nil {
		return nil, err
	}
	return r.withLines(ctx, offers)
}

func (r *MarketRepository) Offer(ctx context.Context, campaignID, id int64) (*domain.ShopOffer, error) {
	offers := []domain.ShopOffer{}
	if err := r.db.SelectContext(ctx, &offers, offerSelect+` WHERE o.campaign_id=$1 AND o.id=$2`, campaignID, id); err != nil {
		return nil, err
	}
	if len(offers) == 0 {
		return nil, ErrMarketNotFound
	}
	offers, err := r.withLines(ctx, offers)
	if err != nil {
		return nil, err
	}
	return &offers[0], nil
}

// SetOfferStatus moves an active offer to a new status (guarded against races).
func (r *MarketRepository) SetOfferStatus(ctx context.Context, id int64, from []string, status string, counter *int64, note string) error {
	resolved := status != "pending" && status != "countered"
	res, err := r.db.ExecContext(ctx, `
		UPDATE shop_offers SET status=$2, counter_cp=COALESCE($3, counter_cp), note=$4,
		       resolved_at=CASE WHEN $5 THEN NOW() ELSE resolved_at END
		WHERE id=$1 AND status = ANY($6)`, id, status, counter, note, resolved, pq.Array(from))
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrOfferResolved
	}
	return nil
}

// CloseOffer executes the cart purchase at the agreed total and marks the offer accepted, in one
// transaction: every line's stock is checked, the wallet is charged via pay, items go to the
// inventory valued at their list price.
func (r *MarketRepository) CloseOffer(ctx context.Context, o *domain.ShopOffer, from []string, agreedCP int64, pay WalletFunc) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, `UPDATE shop_offers SET status='accepted', agreed_cp=$2, resolved_at=NOW() WHERE id=$1 AND status = ANY($3)`,
		o.ID, agreedCP, pq.Array(from))
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrOfferResolved
	}
	for _, l := range o.Lines {
		if l.ItemID == nil {
			return ErrOutOfStock
		}
		var it domain.ShopItem
		if err := tx.GetContext(ctx, &it, `SELECT * FROM shop_items WHERE id=$1 FOR UPDATE`, *l.ItemID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrOutOfStock
			}
			return err
		}
		if it.Stock != -1 && it.Stock < l.Qty {
			return fmt.Errorf("%w: %s", ErrOutOfStock, it.Name)
		}
		if it.Stock != -1 {
			if _, err := tx.ExecContext(ctx, `UPDATE shop_items SET stock=stock-$2, updated_at=NOW() WHERE id=$1`, it.ID, l.Qty); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO inventory_items (character_id, name, item_type, rarity, weight, quantity, description, requires_attunement, is_tradeable, srd_ref_id, value_cp)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,
			o.CharacterID, it.Name, it.ItemType, it.Rarity, it.Weight, l.Qty, it.Description, it.AttunementRequired, srdEquipmentRef(it), it.PriceCP); err != nil {
			return err
		}
	}
	w, err := lockWallet(ctx, tx, o.CharacterID)
	if err != nil {
		return err
	}
	g, s, c, err := pay(w.Gold, w.Silver, w.Copper)
	if err != nil {
		return err
	}
	if err := saveWallet(ctx, tx, o.CharacterID, walletRow{g, s, c}); err != nil {
		return err
	}
	return tx.Commit()
}

// ---------- Appraisal (market-bastions.md §4) ----------

// UnvaluedItem is a party inventory line without a known value.
type UnvaluedItem struct {
	ID            int64  `db:"id" json:"id"`
	CharacterID   int64  `db:"character_id" json:"character_id"`
	CharacterName string `db:"character_name" json:"character_name"`
	Name          string `db:"name" json:"name"`
	ItemType      string `db:"item_type" json:"item_type"`
	Rarity        string `db:"rarity" json:"rarity"`
	Quantity      int    `db:"quantity" json:"quantity"`
	ValueCP       *int64 `db:"value_cp" json:"value_cp"`
}

// AppraisalItems lists the party's inventory (items without value first).
func (r *MarketRepository) AppraisalItems(ctx context.Context, campaignID int64) ([]UnvaluedItem, error) {
	items := []UnvaluedItem{}
	err := r.db.SelectContext(ctx, &items, `
		SELECT i.id, i.character_id, c.name AS character_name, i.name, i.item_type, i.rarity, COALESCE(i.quantity, 1) AS quantity, i.value_cp
		FROM inventory_items i JOIN characters c ON c.id = i.character_id
		WHERE c.campaign_id=$1 ORDER BY (i.value_cp IS NOT NULL), c.name, i.name LIMIT 500`, campaignID)
	return items, err
}

// SetItemValue appraises an inventory item of the campaign (nil clears the value).
func (r *MarketRepository) SetItemValue(ctx context.Context, campaignID, itemID int64, valueCP *int64) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE inventory_items SET value_cp=$3, updated_at=NOW()
		WHERE id=$2 AND character_id IN (SELECT id FROM characters WHERE campaign_id=$1)`, campaignID, itemID, valueCP)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrMarketNotFound
	}
	return nil
}
