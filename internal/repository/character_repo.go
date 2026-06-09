package repository

import (
	"context"
	"database/sql"
	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
)

type CharacterRepository struct {
	db *sqlx.DB
}

func NewCharacterRepository(db *sqlx.DB) *CharacterRepository {
	return &CharacterRepository{db: db}
}

func (r *CharacterRepository) Create(ctx context.Context, c *domain.Character) error {
	query := `
		INSERT INTO characters (user_id, campaign_id, name, race, class, level, background, alignment,
			str_score, dex_score, con_score, int_score, wis_score, cha_score,
			max_hp, current_hp, ac, speed, proficiency_bonus, spellcasting_ability)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowxContext(ctx, query,
		c.UserID, c.CampaignID, c.Name, c.Race, c.Class, c.Level, c.Background, c.Alignment,
		c.StrScore, c.DexScore, c.ConScore, c.IntScore, c.WisScore, c.ChaScore,
		c.MaxHP, c.CurrentHP, c.AC, c.Speed, c.ProficiencyBonus, c.SpellcastingAbility,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CharacterRepository) GetByID(ctx context.Context, id int64) (*domain.Character, error) {
	var c domain.Character
	query := `SELECT * FROM characters WHERE id = $1`
	err := r.db.GetContext(ctx, &c, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

func (r *CharacterRepository) GetByUserAndCampaign(ctx context.Context, userID, campaignID int64) (*domain.Character, error) {
	var c domain.Character
	query := `SELECT * FROM characters WHERE user_id=$1 AND campaign_id=$2`
	err := r.db.GetContext(ctx, &c, query, userID, campaignID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

func (r *CharacterRepository) ListByCampaign(ctx context.Context, campaignID int64) ([]domain.CharacterWithOwner, error) {
	var chars []domain.CharacterWithOwner
	query := `
		SELECT c.*, u.username
		FROM characters c
		JOIN users u ON c.user_id = u.id
		WHERE c.campaign_id = $1`
	err := r.db.SelectContext(ctx, &chars, query, campaignID)
	return chars, err
}

func (r *CharacterRepository) Update(ctx context.Context, c *domain.Character) error {
	query := `
		UPDATE characters SET name=$1, race=$2, class=$3, level=$4, background=$5, alignment=$6,
			str_score=$7, dex_score=$8, con_score=$9, int_score=$10, wis_score=$11, cha_score=$12,
			max_hp=$13, current_hp=$14, temp_hp=$15, ac=$16, speed=$17, proficiency_bonus=$18,
			inspiration=$19, xp=$20, gold=$21, personality_traits=$22, ideals=$23, bonds=$24,
			flaws=$25, backstory_text=$26, notes=$27, spellcasting_ability=$28, updated_at=NOW()
		WHERE id=$29`
	_, err := r.db.ExecContext(ctx, query, c.Name, c.Race, c.Class, c.Level, c.Background, c.Alignment,
		c.StrScore, c.DexScore, c.ConScore, c.IntScore, c.WisScore, c.ChaScore,
		c.MaxHP, c.CurrentHP, c.TempHP, c.AC, c.Speed, c.ProficiencyBonus,
		c.Inspiration, c.XP, c.Gold, c.PersonalityTraits, c.Ideals, c.Bonds,
		c.Flaws, c.BackstoryText, c.Notes, c.SpellcastingAbility, c.ID,
	)
	return err
}

func (r *CharacterRepository) UpdateHP(ctx context.Context, characterID int64, currentHP, tempHP int) error {
	query := `UPDATE characters SET current_hp=$1, temp_hp=$2, updated_at=NOW() WHERE id=$3`
	_, err := r.db.ExecContext(ctx, query, currentHP, tempHP, characterID)
	return err
}

func (r *CharacterRepository) UpdateGold(ctx context.Context, characterID int64, gold int) error {
	query := `UPDATE characters SET gold=$1, updated_at=NOW() WHERE id=$2`
	_, err := r.db.ExecContext(ctx, query, gold, characterID)
	return err
}

func (r *CharacterRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM characters WHERE id=$1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Feature methods
func (r *CharacterRepository) CreateFeature(ctx context.Context, f *domain.CharacterFeature) error {
	query := `
		INSERT INTO character_features (character_id, name, description, type, uses_per_rest, rest_type)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
	return r.db.QueryRowxContext(ctx, query, f.CharacterID, f.Name, f.Description, f.Type, f.UsesPerRest, f.RestType).Scan(&f.ID)
}

func (r *CharacterRepository) GetFeatures(ctx context.Context, characterID int64) ([]domain.CharacterFeature, error) {
	var features []domain.CharacterFeature
	query := `SELECT * FROM character_features WHERE character_id=$1`
	err := r.db.SelectContext(ctx, &features, query, characterID)
	return features, err
}

// Spell slot methods
func (r *CharacterRepository) GetSpellSlots(ctx context.Context, characterID int64) ([]domain.SpellSlot, error) {
	var slots []domain.SpellSlot
	query := `SELECT * FROM spell_slots WHERE character_id=$1 ORDER BY level`
	err := r.db.SelectContext(ctx, &slots, query, characterID)
	return slots, err
}

func (r *CharacterRepository) UpsertSpellSlot(ctx context.Context, slot *domain.SpellSlot) error {
	query := `
		INSERT INTO spell_slots (character_id, level, total, used)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (character_id, level) DO UPDATE SET total=$3, used=$4
		RETURNING id`
	return r.db.QueryRowxContext(ctx, query, slot.CharacterID, slot.Level, slot.Total, slot.Used).Scan(&slot.ID)
}

func (r *CharacterRepository) UseSpellSlot(ctx context.Context, characterID int64, level int) error {
	query := `UPDATE spell_slots SET used=used+1 WHERE character_id=$1 AND level=$2 AND used<total`
	_, err := r.db.ExecContext(ctx, query, characterID, level)
	return err
}

func (r *CharacterRepository) RestoreAllSpellSlots(ctx context.Context, characterID int64) error {
	query := `UPDATE spell_slots SET used=0 WHERE character_id=$1`
	_, err := r.db.ExecContext(ctx, query, characterID)
	return err
}