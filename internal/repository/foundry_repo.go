package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

// FoundryRepository persists the one-way mirror of Foundry game-state.
// All upserts key on foundry_uuid and follow the "Foundry wins" policy
// (see openspec/specs/foundry-integration.md).
type FoundryRepository struct {
	db *sqlx.DB
	tx *sqlx.Tx // set only on the transaction-scoped copy handed to InTx callbacks
}

func NewFoundryRepository(db *sqlx.DB) *FoundryRepository {
	return &FoundryRepository{db: db}
}

// ext returns the active transaction when inside InTx, otherwise the pool.
func (r *FoundryRepository) ext() sqlx.ExtContext {
	if r.tx != nil {
		return r.tx
	}
	return r.db
}

// InTx runs fn against a transaction-scoped repository: it commits when fn returns
// nil and rolls everything back otherwise (resilience.md: each entity type is
// committed atomically or rolled back).
func (r *FoundryRepository) InTx(ctx context.Context, fn func(tx *FoundryRepository) error) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(&FoundryRepository{db: r.db, tx: tx}); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// MarkOrphans flags the rows of one entity group as orphaned; upserts of the same
// transaction clear the flag again. Groups: "actors", "scenes", "journal".
func (r *FoundryRepository) MarkOrphans(ctx context.Context, campaignID int64, group string) error {
	var stmts []string
	switch group {
	case "actors":
		stmts = []string{
			`UPDATE characters      SET is_foundry_orphan=TRUE WHERE campaign_id=$1 AND foundry_uuid IS NOT NULL`,
			`UPDATE npcs            SET is_foundry_orphan=TRUE WHERE campaign_id=$1`,
			`UPDATE inventory_items SET is_foundry_orphan=TRUE WHERE foundry_uuid IS NOT NULL AND character_id IN (SELECT id FROM characters WHERE campaign_id=$1)`,
		}
	case "scenes":
		stmts = []string{`UPDATE maps SET is_foundry_orphan=TRUE WHERE campaign_id=$1`}
	case "journal":
		stmts = []string{`UPDATE lore_entries SET is_foundry_orphan=TRUE WHERE campaign_id=$1 AND foundry_uuid IS NOT NULL`}
	}
	for _, s := range stmts {
		if _, err := r.ext().ExecContext(ctx, s, campaignID); err != nil {
			return err
		}
	}
	return nil
}

// ── Orphan marking ──────────────────────────────────────────
// Called at the start of a sync; every successful upsert clears the flag, so
// rows that no longer exist in Foundry stay flagged is_foundry_orphan = TRUE.

func (r *FoundryRepository) MarkAllOrphan(ctx context.Context, campaignID int64) error {
	stmts := []string{
		`UPDATE characters      SET is_foundry_orphan=TRUE WHERE campaign_id=$1 AND foundry_uuid IS NOT NULL`,
		`UPDATE npcs            SET is_foundry_orphan=TRUE WHERE campaign_id=$1`,
		`UPDATE maps            SET is_foundry_orphan=TRUE WHERE campaign_id=$1`,
		`UPDATE lore_entries    SET is_foundry_orphan=TRUE WHERE campaign_id=$1 AND foundry_uuid IS NOT NULL`,
		`UPDATE inventory_items SET is_foundry_orphan=TRUE WHERE foundry_uuid IS NOT NULL AND character_id IN (SELECT id FROM characters WHERE campaign_id=$1)`,
	}
	for _, s := range stmts {
		if _, err := r.ext().ExecContext(ctx, s, campaignID); err != nil {
			return err
		}
	}
	return nil
}

// ── Upserts ─────────────────────────────────────────────────

func (r *FoundryRepository) UpsertCharacter(ctx context.Context, c *domain.Character) (int64, error) {
	query := `
		INSERT INTO characters (user_id, campaign_id, name, race, class, level, background, alignment,
			str_score, dex_score, con_score, int_score, wis_score, cha_score,
			max_hp, current_hp, temp_hp, ac, speed, backstory_text, foundry_uuid, is_foundry_orphan)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,FALSE)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, race=EXCLUDED.race, class=EXCLUDED.class, level=EXCLUDED.level,
			background=EXCLUDED.background, alignment=EXCLUDED.alignment,
			str_score=EXCLUDED.str_score, dex_score=EXCLUDED.dex_score, con_score=EXCLUDED.con_score,
			int_score=EXCLUDED.int_score, wis_score=EXCLUDED.wis_score, cha_score=EXCLUDED.cha_score,
			max_hp=EXCLUDED.max_hp, current_hp=EXCLUDED.current_hp, temp_hp=EXCLUDED.temp_hp,
			ac=EXCLUDED.ac, speed=EXCLUDED.speed, backstory_text=EXCLUDED.backstory_text,
			is_foundry_orphan=FALSE, updated_at=NOW()
		RETURNING id`
	var id int64
	err := r.ext().QueryRowxContext(ctx, query,
		c.UserID, c.CampaignID, c.Name, c.Race, c.Class, c.Level, c.Background, c.Alignment,
		c.StrScore, c.DexScore, c.ConScore, c.IntScore, c.WisScore, c.ChaScore,
		c.MaxHP, c.CurrentHP, c.TempHP, c.AC, c.Speed, c.BackstoryText, c.FoundryUUID,
	).Scan(&id)
	return id, err
}

func (r *FoundryRepository) UpsertItem(ctx context.Context, it *domain.InventoryItem) error {
	query := `
		INSERT INTO inventory_items (character_id, name, item_type, rarity, weight, quantity, description,
			is_equipped, requires_attunement, is_attuned, is_tradeable, foundry_uuid, is_foundry_orphan)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			character_id=EXCLUDED.character_id, name=EXCLUDED.name, item_type=EXCLUDED.item_type,
			rarity=EXCLUDED.rarity, weight=EXCLUDED.weight, quantity=EXCLUDED.quantity,
			description=EXCLUDED.description, is_equipped=EXCLUDED.is_equipped,
			requires_attunement=EXCLUDED.requires_attunement, is_attuned=EXCLUDED.is_attuned,
			is_foundry_orphan=FALSE, updated_at=NOW()`
	_, err := r.ext().ExecContext(ctx, query,
		it.CharacterID, it.Name, it.ItemType, it.Rarity, it.Weight, it.Quantity, it.Description,
		it.IsEquipped, it.RequiresAttunement, it.IsAttuned, it.IsTradeable, it.FoundryUUID,
	)
	return err
}

func (r *FoundryRepository) UpsertNPC(ctx context.Context, n *domain.NPC) error {
	query := `
		INSERT INTO npcs (campaign_id, foundry_uuid, name, role, status, avatar_url, ac, hp, speed, description, is_foundry_orphan)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, role=EXCLUDED.role, status=EXCLUDED.status, avatar_url=EXCLUDED.avatar_url,
			ac=EXCLUDED.ac, hp=EXCLUDED.hp, speed=EXCLUDED.speed, description=EXCLUDED.description,
			is_foundry_orphan=FALSE, updated_at=NOW()`
	_, err := r.ext().ExecContext(ctx, query,
		n.CampaignID, n.FoundryUUID, n.Name, n.Role, n.Status, n.AvatarURL, n.AC, n.HP, n.Speed, n.Description,
	)
	return err
}

func (r *FoundryRepository) UpsertMap(ctx context.Context, m *domain.Map) error {
	query := `
		INSERT INTO maps (campaign_id, foundry_uuid, name, location, image_url, is_foundry_orphan)
		VALUES ($1,$2,$3,$4,$5,FALSE)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, location=EXCLUDED.location, image_url=EXCLUDED.image_url,
			is_foundry_orphan=FALSE, updated_at=NOW()`
	_, err := r.ext().ExecContext(ctx, query, m.CampaignID, m.FoundryUUID, m.Name, m.Location, m.ImageURL)
	return err
}

// UpsertLore mirrors a journal entry. It returns the lore id and whether the entry needs a
// (re-)embedding: true for a new row or when the journal text changed. A re-sync never touches
// lore_tier, so a tier the GM changed in the app is kept (foundry-integration.md).
func (r *FoundryRepository) UpsertLore(ctx context.Context, l *domain.LoreEntry) (int64, bool, error) {
	query := `
		WITH prev AS (SELECT content_text FROM lore_entries WHERE foundry_uuid = $5)
		INSERT INTO lore_entries (campaign_id, content_text, lore_tier, title, foundry_uuid, is_foundry_orphan)
		VALUES ($1,$2,$3,$4,$5,FALSE)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			content_text=EXCLUDED.content_text, title=EXCLUDED.title,
			is_foundry_orphan=FALSE, updated_at=NOW()
		RETURNING id, (xmax = 0 OR lore_entries.content_text IS DISTINCT FROM (SELECT content_text FROM prev)) AS needs_embedding`
	var id int64
	var needsEmbedding bool
	err := r.ext().QueryRowxContext(ctx, query,
		l.CampaignID, l.ContentText, l.LoreTier, l.Title, l.FoundryUUID,
	).Scan(&id, &needsEmbedding)
	return id, needsEmbedding, err
}

func (r *FoundryRepository) UpsertMonster(ctx context.Context, m *domain.SRDMonster) error {
	query := `
		INSERT INTO srd_monsters (name, size, type, alignment, ac, hp, hit_dice, str, dex, con, "int", wis, cha, cr, xp, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,FALSE,$16)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, size=EXCLUDED.size, type=EXCLUDED.type, alignment=EXCLUDED.alignment,
			ac=EXCLUDED.ac, hp=EXCLUDED.hp, hit_dice=EXCLUDED.hit_dice, str=EXCLUDED.str, dex=EXCLUDED.dex, con=EXCLUDED.con,
			"int"=EXCLUDED."int", wis=EXCLUDED.wis, cha=EXCLUDED.cha, cr=EXCLUDED.cr, xp=EXCLUDED.xp`
	_, err := r.ext().ExecContext(ctx, query,
		m.Name, m.Size, m.Type, m.Alignment, m.AC, m.HP, m.HitDice,
		m.STR, m.DEX, m.CON, m.INT, m.WIS, m.CHA, m.CR, m.XP, m.FoundryUUID,
	)
	return err
}

// ── Sync state ──────────────────────────────────────────────

func (r *FoundryRepository) BeginSync(ctx context.Context, campaignID int64) error {
	query := `
		INSERT INTO foundry_sync_state (campaign_id, status, updated_at)
		VALUES ($1, 'running', NOW())
		ON CONFLICT (campaign_id) DO UPDATE SET status='running', error='', updated_at=NOW()`
	_, err := r.db.ExecContext(ctx, query, campaignID)
	return err
}

func (r *FoundryRepository) FinishSync(ctx context.Context, campaignID int64, status string, counts domain.SyncCounts, syncErr string) error {
	countsJSON, _ := json.Marshal(counts)
	query := `
		INSERT INTO foundry_sync_state (campaign_id, status, last_synced_at, counts, error, updated_at)
		VALUES ($1, $2, NOW(), $3, $4, NOW())
		ON CONFLICT (campaign_id) DO UPDATE SET
			status=EXCLUDED.status, last_synced_at=EXCLUDED.last_synced_at,
			counts=EXCLUDED.counts, error=EXCLUDED.error, updated_at=NOW()`
	_, err := r.db.ExecContext(ctx, query, campaignID, status, countsJSON, syncErr)
	return err
}

func (r *FoundryRepository) GetSyncState(ctx context.Context, campaignID int64) (*domain.FoundrySyncState, error) {
	var s domain.FoundrySyncState
	query := `SELECT campaign_id, status, last_synced_at, counts, error, updated_at FROM foundry_sync_state WHERE campaign_id=$1`
	err := r.db.GetContext(ctx, &s, query, campaignID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &s, err
}

// FinishReference records the outcome of a compendium reference sync in
// foundry_sync_state without clobbering the per-campaign sync counts: the
// reference tally is merged into counts under the "reference" key.
func (r *FoundryRepository) FinishReference(ctx context.Context, campaignID int64, status string, counts map[string]int, syncErr string) error {
	countsJSON, _ := json.Marshal(map[string]any{"reference": counts})
	query := `
		INSERT INTO foundry_sync_state (campaign_id, status, last_synced_at, counts, error, updated_at)
		VALUES ($1, $2, NOW(), $3, $4, NOW())
		ON CONFLICT (campaign_id) DO UPDATE SET
			status=EXCLUDED.status, last_synced_at=EXCLUDED.last_synced_at,
			counts=foundry_sync_state.counts || EXCLUDED.counts, error=EXCLUDED.error, updated_at=NOW()`
	_, err := r.db.ExecContext(ctx, query, campaignID, status, countsJSON, syncErr)
	return err
}
