package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// Bastion persistence (openspec/specs/market-bastions.md §6).

var ErrBastionNotFound = errors.New("bastion resource not found")

type BastionRepository struct{ db *sqlx.DB }

func NewBastionRepository(db *sqlx.DB) *BastionRepository { return &BastionRepository{db: db} }

func bastionNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrBastionNotFound
	}
	return err
}

// ---------- Catalogue and events ----------

// EnsureCatalog clones the seeded defaults into the campaign the first time it is needed.
func (r *BastionRepository) EnsureCatalog(ctx context.Context, campaignID int64) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Serialise concurrent first opens of the same campaign.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1)`, 7210000+campaignID); err != nil {
		return err
	}
	var n int
	if err := tx.GetContext(ctx, &n, `SELECT COUNT(*) FROM bastion_catalog WHERE campaign_id=$1`, campaignID); err != nil {
		return err
	}
	if n == 0 {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO bastion_catalog (campaign_id, name, min_level, prerequisite, size, description, hirelings, orders, options, sort_order)
			SELECT $1, name, min_level, prerequisite, size, description, hirelings, orders, options, sort_order
			FROM bastion_catalog WHERE campaign_id IS NULL`, campaignID); err != nil {
			return err
		}
	}
	if err := tx.GetContext(ctx, &n, `SELECT COUNT(*) FROM bastion_events WHERE campaign_id=$1`, campaignID); err != nil {
		return err
	}
	if n == 0 {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO bastion_events (campaign_id, roll_min, roll_max, name, description, reward_dice, reward_mult_cp)
			SELECT $1, roll_min, roll_max, name, description, reward_dice, reward_mult_cp
			FROM bastion_events WHERE campaign_id IS NULL`, campaignID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *BastionRepository) Catalog(ctx context.Context, campaignID int64) ([]domain.BastionCatalogEntry, error) {
	if err := r.EnsureCatalog(ctx, campaignID); err != nil {
		return nil, err
	}
	out := []domain.BastionCatalogEntry{}
	err := r.db.SelectContext(ctx, &out, `SELECT * FROM bastion_catalog WHERE campaign_id=$1 ORDER BY min_level, sort_order, name`, campaignID)
	return out, err
}

func (r *BastionRepository) Events(ctx context.Context, campaignID int64) ([]domain.BastionEvent, error) {
	if err := r.EnsureCatalog(ctx, campaignID); err != nil {
		return nil, err
	}
	out := []domain.BastionEvent{}
	err := r.db.SelectContext(ctx, &out, `SELECT * FROM bastion_events WHERE campaign_id=$1 ORDER BY roll_min`, campaignID)
	return out, err
}

// SaveCatalog replaces the campaign's catalogue and events table: rows with an id are updated,
// rows with id 0 inserted and rows missing from the input removed.
func (r *BastionRepository) SaveCatalog(ctx context.Context, campaignID int64, entries []domain.BastionCatalogEntry, events []domain.BastionEvent) error {
	if err := r.EnsureCatalog(ctx, campaignID); err != nil {
		return err
	}
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	keep := []int64{}
	for i := range entries {
		e := &entries[i]
		if e.Orders == nil {
			e.Orders = pq.StringArray{}
		}
		if e.ID != 0 {
			res, err := tx.ExecContext(ctx, `
				UPDATE bastion_catalog SET name=$3, min_level=$4, prerequisite=$5, size=$6, description=$7, hirelings=$8, orders=$9, options=$10, sort_order=$11
				WHERE campaign_id=$1 AND id=$2`,
				campaignID, e.ID, e.Name, e.MinLevel, e.Prerequisite, e.Size, e.Description, e.Hirelings, e.Orders, e.Options, e.SortOrder)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n > 0 {
				keep = append(keep, e.ID)
				continue
			}
			e.ID = 0
		}
		if err := tx.QueryRowxContext(ctx, `
			INSERT INTO bastion_catalog (campaign_id, name, min_level, prerequisite, size, description, hirelings, orders, options, sort_order)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
			campaignID, e.Name, e.MinLevel, e.Prerequisite, e.Size, e.Description, e.Hirelings, e.Orders, e.Options, e.SortOrder).Scan(&e.ID); err != nil {
			return err
		}
		keep = append(keep, e.ID)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM bastion_catalog WHERE campaign_id=$1 AND NOT (id = ANY($2))`, campaignID, pq.Array(keep)); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM bastion_events WHERE campaign_id=$1`, campaignID); err != nil {
		return err
	}
	for i := range events {
		ev := &events[i]
		if err := tx.QueryRowxContext(ctx, `
			INSERT INTO bastion_events (campaign_id, roll_min, roll_max, name, description, reward_dice, reward_mult_cp)
			VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
			campaignID, ev.RollMin, ev.RollMax, ev.Name, ev.Description, ev.RewardDice, ev.RewardMultCP).Scan(&ev.ID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ---------- Bastions ----------

const bastionSelect = `
	SELECT b.*, c.name AS character_name, COALESCE(c.level, 1) AS character_level, c.user_id AS owner_user_id
	FROM bastions b JOIN characters c ON c.id = b.character_id`

// Bastions lists the campaign's Bastions in full; ownerUserID > 0 limits them to that player.
func (r *BastionRepository) Bastions(ctx context.Context, campaignID, ownerUserID int64) ([]domain.Bastion, error) {
	list := []domain.Bastion{}
	if err := r.db.SelectContext(ctx, &list, bastionSelect+` WHERE b.campaign_id=$1 AND ($2 = 0 OR c.user_id = $2) ORDER BY b.name`, campaignID, ownerUserID); err != nil {
		return nil, err
	}
	for i := range list {
		if err := r.loadDetail(ctx, &list[i]); err != nil {
			return nil, err
		}
	}
	return list, nil
}

// Bastion returns one Bastion of the campaign in full.
func (r *BastionRepository) Bastion(ctx context.Context, campaignID, id int64) (*domain.Bastion, error) {
	var b domain.Bastion
	if err := r.db.GetContext(ctx, &b, bastionSelect+` WHERE b.campaign_id=$1 AND b.id=$2`, campaignID, id); err != nil {
		return nil, bastionNotFound(err)
	}
	if err := r.loadDetail(ctx, &b); err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *BastionRepository) loadDetail(ctx context.Context, b *domain.Bastion) error {
	b.Facilities, b.Hirelings, b.Defenders = []domain.BastionFacility{}, []domain.BastionHireling{}, []domain.BastionDefender{}
	b.Warehouse, b.Construction, b.Log = []domain.WarehouseItem{}, []domain.BastionConstruction{}, []domain.BastionLogEntry{}
	steps := []struct {
		dst any
		q   string
	}{
		{&b.Facilities, `SELECT * FROM bastion_facilities WHERE bastion_id=$1 ORDER BY kind, id`},
		{&b.Hirelings, `SELECT * FROM bastion_hirelings WHERE bastion_id=$1 ORDER BY id`},
		{&b.Defenders, `SELECT * FROM bastion_defenders WHERE bastion_id=$1 ORDER BY id`},
		{&b.Warehouse, `SELECT * FROM bastion_warehouse WHERE bastion_id=$1 ORDER BY name, id`},
		{&b.Construction, `SELECT * FROM bastion_construction WHERE bastion_id=$1 ORDER BY id`},
		{&b.Log, `SELECT * FROM bastion_turn_log WHERE bastion_id=$1 ORDER BY turn_number DESC LIMIT 20`},
	}
	for _, s := range steps {
		if err := r.db.SelectContext(ctx, s.dst, s.q, b.ID); err != nil {
			return err
		}
	}
	return nil
}

// CharacterRef is the character data needed to found a Bastion.
type CharacterRef struct {
	ID     int64  `db:"id"`
	UserID int64  `db:"user_id"`
	Name   string `db:"name"`
	Level  int    `db:"level"`
}

// Character returns a character of the campaign.
func (r *BastionRepository) Character(ctx context.Context, campaignID, characterID int64) (*CharacterRef, error) {
	var c CharacterRef
	err := r.db.GetContext(ctx, &c, `SELECT id, user_id, name, COALESCE(level, 1) AS level FROM characters WHERE campaign_id=$1 AND id=$2`, campaignID, characterID)
	if err != nil {
		return nil, bastionNotFound(err)
	}
	return &c, nil
}

// CharacterOfUser returns the user's first character in the campaign.
func (r *BastionRepository) CharacterOfUser(ctx context.Context, campaignID, userID int64) (*CharacterRef, error) {
	var c CharacterRef
	err := r.db.GetContext(ctx, &c, `SELECT id, user_id, name, COALESCE(level, 1) AS level FROM characters WHERE campaign_id=$1 AND user_id=$2 ORDER BY id LIMIT 1`, campaignID, userID)
	if err != nil {
		return nil, bastionNotFound(err)
	}
	return &c, nil
}

// BasicSeed is a basic facility created with a new Bastion.
type BasicSeed struct{ Kind, Name, Size string }

var ErrBastionExists = errors.New("ese personaje ya tiene un bastión")

// CreateBastion founds a Bastion with its starting basic facilities.
func (r *BastionRepository) CreateBastion(ctx context.Context, b *domain.Bastion, seeds []BasicSeed) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	err = tx.QueryRowxContext(ctx, `INSERT INTO bastions (campaign_id, character_id, name, description) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
		b.CampaignID, b.CharacterID, b.Name, b.Description).Scan(&b.ID, &b.CreatedAt)
	if err != nil {
		var pe *pq.Error
		if errors.As(err, &pe) && pe.Code == "23505" {
			return ErrBastionExists
		}
		return err
	}
	for _, s := range seeds {
		if _, err := tx.ExecContext(ctx, `INSERT INTO bastion_facilities (bastion_id, kind, name, basic_kind, size) VALUES ($1,'basic',$2,$3,$4)`, b.ID, s.Name, s.Kind, s.Size); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *BastionRepository) UpdateBastion(ctx context.Context, campaignID, id int64, name, description string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE bastions SET name=$3, description=$4 WHERE campaign_id=$1 AND id=$2`, campaignID, id, name, description)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrBastionNotFound
	}
	return nil
}

// Facility returns a facility together with its Bastion header (no detail).
func (r *BastionRepository) Facility(ctx context.Context, campaignID, id int64) (*domain.BastionFacility, *domain.Bastion, error) {
	var f domain.BastionFacility
	if err := r.db.GetContext(ctx, &f, `SELECT f.* FROM bastion_facilities f JOIN bastions b ON b.id=f.bastion_id WHERE b.campaign_id=$1 AND f.id=$2`, campaignID, id); err != nil {
		return nil, nil, bastionNotFound(err)
	}
	var b domain.Bastion
	if err := r.db.GetContext(ctx, &b, bastionSelect+` WHERE b.id=$1`, f.BastionID); err != nil {
		return nil, nil, bastionNotFound(err)
	}
	return &f, &b, nil
}

// AddSpecialFacility adds a catalogue facility and its hirelings.
func (r *BastionRepository) AddSpecialFacility(ctx context.Context, bastionID int64, e domain.BastionCatalogEntry) (*domain.BastionFacility, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	f := domain.BastionFacility{BastionID: bastionID, Kind: "special", CatalogID: &e.ID, Name: e.Name, Size: e.Size}
	if err := tx.QueryRowxContext(ctx, `INSERT INTO bastion_facilities (bastion_id, kind, catalog_id, name, size) VALUES ($1,'special',$2,$3,$4) RETURNING id, created_at`,
		bastionID, e.ID, e.Name, e.Size).Scan(&f.ID, &f.CreatedAt); err != nil {
		return nil, err
	}
	for i := 1; i <= e.Hirelings; i++ {
		if _, err := tx.ExecContext(ctx, `INSERT INTO bastion_hirelings (bastion_id, facility_id, name) VALUES ($1,$2,$3)`,
			bastionID, f.ID, fmt.Sprintf("Empleado %d de %s", i, e.Name)); err != nil {
			return nil, err
		}
	}
	return &f, tx.Commit()
}

func (r *BastionRepository) DeleteFacility(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM bastion_facilities WHERE id=$1`, id)
	return err
}

// StartConstruction queues a construction; pay (nil for free work) charges the owner in the same
// transaction.
func (r *BastionRepository) StartConstruction(ctx context.Context, c *domain.BastionConstruction, characterID int64, pay WalletFunc) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if pay != nil {
		if err := chargeWallet(ctx, tx, characterID, pay); err != nil {
			return err
		}
	}
	if err := tx.QueryRowxContext(ctx, `
		INSERT INTO bastion_construction (bastion_id, kind, facility_id, basic_kind, target_size, days_left, total_days, cost_cp)
		VALUES ($1,$2,$3,$4,$5,$6,$6,$7) RETURNING id, created_at`,
		c.BastionID, c.Kind, c.FacilityID, c.BasicKind, c.TargetSize, c.TotalDays, c.CostCP).Scan(&c.ID, &c.CreatedAt); err != nil {
		return err
	}
	c.DaysLeft = c.TotalDays
	return tx.Commit()
}

func chargeWallet(ctx context.Context, tx *sqlx.Tx, characterID int64, fn WalletFunc) error {
	w, err := lockWallet(ctx, tx, characterID)
	if err != nil {
		return err
	}
	g, s, c, err := fn(w.Gold, w.Silver, w.Copper)
	if err != nil {
		return err
	}
	return saveWallet(ctx, tx, characterID, walletRow{g, s, c})
}

// SetOrder stores (or clears, when order is empty) a facility order, adjusting the owner's
// wallet in the same transaction.
func (r *BastionRepository) SetOrder(ctx context.Context, facilityID int64, order string, option domain.JSONB, turns int, characterID int64, adjust WalletFunc) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if adjust != nil {
		if err := chargeWallet(ctx, tx, characterID, adjust); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE bastion_facilities SET order_name=$2, order_option=$3, turns_left=$4 WHERE id=$1`, facilityID, order, option, turns); err != nil {
		return err
	}
	return tx.Commit()
}

// ---------- Turns ----------

// NextTurnNumber is the number of the next Bastion turn of the campaign.
func (r *BastionRepository) NextTurnNumber(ctx context.Context, campaignID int64) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n, `SELECT COALESCE(MAX(turn_number), 0) + 1 FROM bastion_turn_log WHERE campaign_id=$1`, campaignID)
	return n, err
}

// ApplyTurn persists the results of a Bastion turn atomically.
func (r *BastionRepository) ApplyTurn(ctx context.Context, campaignID int64, results []domain.BastionTurnResult, payGold func(gold, silver, copper int, cp int64) (int, int, int)) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, res := range results {
		for _, f := range res.Facilities {
			if _, err := tx.ExecContext(ctx, `UPDATE bastion_facilities SET order_name=$2, order_option=$3, turns_left=$4 WHERE id=$1`, f.ID, f.OrderName, f.OrderOption, f.TurnsLeft); err != nil {
				return err
			}
		}
		for _, it := range res.Items {
			// Stack with an identical warehouse line.
			upd, err := tx.ExecContext(ctx, `UPDATE bastion_warehouse SET quantity=quantity+$5
				WHERE id = (SELECT id FROM bastion_warehouse WHERE bastion_id=$1 AND lower(name)=lower($2) AND value_cp=$3 AND item_type=$4 LIMIT 1)`,
				it.BastionID, it.Name, it.ValueCP, it.ItemType, it.Quantity)
			if err != nil {
				return err
			}
			if n, _ := upd.RowsAffected(); n == 0 {
				if _, err := tx.ExecContext(ctx, `INSERT INTO bastion_warehouse (bastion_id, name, item_type, rarity, quantity, value_cp, description, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
					it.BastionID, it.Name, it.ItemType, it.Rarity, it.Quantity, it.ValueCP, it.Description, it.Source); err != nil {
					return err
				}
			}
		}
		for _, d := range res.Defenders {
			if _, err := tx.ExecContext(ctx, `INSERT INTO bastion_defenders (bastion_id, name, source) VALUES ($1,$2,$3)`, d.BastionID, d.Name, d.Source); err != nil {
				return err
			}
		}
		for _, c := range res.Construction {
			if !c.Done {
				if _, err := tx.ExecContext(ctx, `UPDATE bastion_construction SET days_left=$2 WHERE id=$1`, c.ID, c.DaysLeft); err != nil {
					return err
				}
				continue
			}
			var con domain.BastionConstruction
			if err := tx.GetContext(ctx, &con, `SELECT * FROM bastion_construction WHERE id=$1`, c.ID); err != nil {
				return err
			}
			if con.Kind == "enlarge" && con.FacilityID != nil {
				_, err = tx.ExecContext(ctx, `UPDATE bastion_facilities SET size=$2 WHERE id=$1`, *con.FacilityID, con.TargetSize)
			} else {
				_, err = tx.ExecContext(ctx, `INSERT INTO bastion_facilities (bastion_id, kind, name, basic_kind, size) VALUES ($1,'basic',$2,$3,$4)`,
					con.BastionID, basicName(con.BasicKind), con.BasicKind, con.TargetSize)
			}
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `DELETE FROM bastion_construction WHERE id=$1`, c.ID); err != nil {
				return err
			}
		}
		if res.GoldCP > 0 && payGold != nil {
			w, err := lockWallet(ctx, tx, res.CharacterID)
			if err != nil {
				return err
			}
			g, s, c := payGold(w.Gold, w.Silver, w.Copper, res.GoldCP)
			if err := saveWallet(ctx, tx, res.CharacterID, walletRow{g, s, c}); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO bastion_turn_log (bastion_id, campaign_id, turn_number, entries, event_name, event_roll) VALUES ($1,$2,$3,$4,$5,$6)`,
			res.BastionID, campaignID, res.TurnNumber, pq.StringArray(res.Log), res.EventName, res.EventRoll); err != nil {
			return err
		}
	}
	return tx.Commit()
}

var basicLabels = map[string]string{
	"bedroom": "Dormitorio", "dining": "Comedor", "parlor": "Salón",
	"courtyard": "Patio", "kitchen": "Cocina", "storage": "Almacenamiento",
}

func basicName(kind string) string {
	if n, ok := basicLabels[kind]; ok {
		return n
	}
	return kind
}

// ---------- Warehouse ----------

// NPCRef is a campaign NPC that may buy Bastion goods.
type NPCRef struct {
	ID   int64  `db:"id"`
	Name string `db:"name"`
}

func (r *BastionRepository) NPCs(ctx context.Context, campaignID int64) ([]NPCRef, error) {
	out := []NPCRef{}
	err := r.db.SelectContext(ctx, &out, `SELECT id, name FROM campaign_npcs WHERE campaign_id=$1 ORDER BY id`, campaignID)
	return out, err
}

// SalePct is the campaign's Bastion sale payout percentage.
func (r *BastionRepository) SalePct(ctx context.Context, campaignID int64) (int, error) {
	var pct int
	err := r.db.GetContext(ctx, &pct, `SELECT bastion_sale_pct FROM campaigns WHERE id=$1`, campaignID)
	return pct, bastionNotFound(err)
}

// WarehouseSale is what a sale decided once the item row is locked.
type WarehouseSale struct {
	PayoutCP int64
	NPCID    *int64
	Location string
	Source   string
}

// SellWarehouse removes qty units, pays the owner and, for an NPC buyer, hands over the goods.
// plan runs under the row lock with the stored item and returns what the sale pays.
func (r *BastionRepository) SellWarehouse(ctx context.Context, bastionID, warehouseID int64, qty int, characterID int64,
	plan func(it domain.WarehouseItem) WarehouseSale, receive func(gold, silver, copper int, cp int64) (int, int, int)) (*domain.WarehouseItem, *WarehouseSale, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()
	var it domain.WarehouseItem
	if err := tx.GetContext(ctx, &it, `SELECT * FROM bastion_warehouse WHERE id=$1 AND bastion_id=$2 FOR UPDATE`, warehouseID, bastionID); err != nil {
		return nil, nil, bastionNotFound(err)
	}
	if qty < 1 || it.Quantity < qty {
		return nil, nil, ErrNotEnoughItems
	}
	sale := plan(it)
	if err := removeWarehouse(ctx, tx, it, qty); err != nil {
		return nil, nil, err
	}
	w, err := lockWallet(ctx, tx, characterID)
	if err != nil {
		return nil, nil, err
	}
	g, s, c := receive(w.Gold, w.Silver, w.Copper, sale.PayoutCP)
	if err := saveWallet(ctx, tx, characterID, walletRow{g, s, c}); err != nil {
		return nil, nil, err
	}
	if sale.NPCID != nil {
		if _, err := tx.ExecContext(ctx, `INSERT INTO npc_items (npc_id, name, quantity, value_cp, description, location, source) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			*sale.NPCID, it.Name, qty, it.ValueCP, it.Description, sale.Location, sale.Source); err != nil {
			return nil, nil, err
		}
	}
	return &it, &sale, tx.Commit()
}

func removeWarehouse(ctx context.Context, tx *sqlx.Tx, it domain.WarehouseItem, qty int) error {
	var err error
	if it.Quantity == qty {
		_, err = tx.ExecContext(ctx, `DELETE FROM bastion_warehouse WHERE id=$1`, it.ID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE bastion_warehouse SET quantity=quantity-$2 WHERE id=$1`, it.ID, qty)
	}
	return err
}

// TakeWarehouse moves qty units to the owner's inventory keeping their value.
func (r *BastionRepository) TakeWarehouse(ctx context.Context, bastionID, warehouseID int64, qty int, characterID int64) (*domain.WarehouseItem, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var it domain.WarehouseItem
	if err := tx.GetContext(ctx, &it, `SELECT * FROM bastion_warehouse WHERE id=$1 AND bastion_id=$2 FOR UPDATE`, warehouseID, bastionID); err != nil {
		return nil, bastionNotFound(err)
	}
	if qty < 1 || it.Quantity < qty {
		return nil, ErrNotEnoughItems
	}
	if err := removeWarehouse(ctx, tx, it, qty); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO inventory_items (character_id, name, item_type, rarity, weight, quantity, description, is_tradeable, value_cp)
		VALUES ($1,$2,$3,$4,0,$5,$6,true,$7)`,
		characterID, it.Name, it.ItemType, it.Rarity, qty, it.Description, it.ValueCP); err != nil {
		return nil, err
	}
	return &it, tx.Commit()
}
