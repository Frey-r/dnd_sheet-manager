package repository

import (
	"fmt"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"github.com/jmoiron/sqlx"
)

// SRDRepository handles all SRD reference data queries.
type SRDRepository struct {
	db *sqlx.DB
}

// NewSRDRepository creates a new SRDRepository.
func NewSRDRepository(db *sqlx.DB) *SRDRepository {
	return &SRDRepository{db: db}
}

// sanitizeFTSQuery cleans a raw user query for PostgreSQL FTS.
func sanitizeFTSQuery(query string) string {
	// Remove special FTS characters
	cleaned := strings.Map(func(r rune) rune {
		switch r {
		case '*', '"', ':', '(', ')', '^', '~', '{', '}', '<', '>', '!', '&', '|', '\\':
			return -1
		default:
			return r
		}
	}, query)
	tokens := strings.Fields(cleaned)
	if len(tokens) == 0 {
		return ""
	}
	// Wrap each token in quotes and join with &
	quoted := make([]string, len(tokens))
	for i, t := range tokens {
		quoted[i] = fmt.Sprintf("'%s':*", strings.ToLower(t))
	}
	return strings.Join(quoted, " & ")
}

// defaultPagination applies defaults to limit/offset.
func defaultPagination(limit, offset int) (int, int) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// ── Monsters ────────────────────────────────────────────────

// SearchMonsters queries srd_monsters with filters, FTS, and pagination.
func (r *SRDRepository) SearchMonsters(filters domain.MonsterFilters) (*domain.PaginatedResult[domain.MonsterListItem], error) {
	filters.Limit, filters.Offset = defaultPagination(filters.Limit, filters.Offset)

	conditions := []string{}
	args := map[string]interface{}{}

	if filters.Query != "" {
		fts := sanitizeFTSQuery(filters.Query)
		if fts != "" {
			conditions = append(conditions, "search_vector @@ to_tsquery('english', :fts_query)")
			args["fts_query"] = fts
		}
	}
	if filters.CR != "" {
		conditions = append(conditions, "cr = :cr")
		args["cr"] = filters.CR
	}
	if filters.CRMin > 0 {
		conditions = append(conditions, `CASE WHEN cr = '1/8' THEN 0.125 WHEN cr = '1/4' THEN 0.25 WHEN cr = '1/2' THEN 0.5 ELSE CAST(cr AS REAL) END >= :cr_min`)
		args["cr_min"] = filters.CRMin
	}
	if filters.CRMax > 0 {
		conditions = append(conditions, `CASE WHEN cr = '1/8' THEN 0.125 WHEN cr = '1/4' THEN 0.25 WHEN cr = '1/2' THEN 0.5 ELSE CAST(cr AS REAL) END <= :cr_max`)
		args["cr_max"] = filters.CRMax
	}
	if filters.Type != "" {
		conditions = append(conditions, "LOWER(type) = LOWER(:type)")
		args["type"] = filters.Type
	}
	if filters.Size != "" {
		conditions = append(conditions, "LOWER(size) = LOWER(:size)")
		args["size"] = filters.Size
	}
	if filters.IsSRD != nil {
		conditions = append(conditions, "is_srd = :is_srd")
		args["is_srd"] = *filters.IsSRD
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM srd_monsters %s", where)
	var total int
	countRow, err := r.db.NamedQuery(countQuery, args)
	if err != nil {
		return nil, fmt.Errorf("count monsters: %w", err)
	}
	defer countRow.Close()
	if countRow.Next() {
		if err := countRow.Scan(&total); err != nil {
			return nil, fmt.Errorf("scan count: %w", err)
		}
	}

	// Fetch page
	args["limit"] = filters.Limit
	args["offset"] = filters.Offset
	dataQuery := fmt.Sprintf(
		"SELECT id, name, size, type, cr, xp, hp, ac, is_srd FROM srd_monsters %s ORDER BY name ASC LIMIT :limit OFFSET :offset",
		where,
	)

	rows, err := r.db.NamedQuery(dataQuery, args)
	if err != nil {
		return nil, fmt.Errorf("search monsters: %w", err)
	}
	defer rows.Close()

	items := []domain.MonsterListItem{}
	for rows.Next() {
		var item domain.MonsterListItem
		if err := rows.StructScan(&item); err != nil {
			return nil, fmt.Errorf("scan monster: %w", err)
		}
		items = append(items, item)
	}

	return &domain.PaginatedResult[domain.MonsterListItem]{
		Data:   items,
		Total:  total,
		Limit:  filters.Limit,
		Offset: filters.Offset,
	}, nil
}

// GetMonster returns a single monster by ID with all fields.
func (r *SRDRepository) GetMonster(id int64) (*domain.SRDMonster, error) {
	var monster domain.SRDMonster
	err := r.db.Get(&monster, `SELECT id, name, size, type, subtype, alignment, ac, ac_type, hp, hit_dice, 
		speed::text, str, dex, con, "int", wis, cha, cr, xp, senses, languages, 
		traits::text, actions::text, legendary_actions::text, reactions::text,
		resistances, immunities, vulnerabilities, condition_immunities,
		saving_throws::text, skills::text, proficiency_bonus, is_srd, created_at
		FROM srd_monsters WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get monster %d: %w", id, err)
	}
	return &monster, nil
}

// GetMonstersByCRRange returns monsters within a CR range, for encounter building.
func (r *SRDRepository) GetMonstersByCRRange(crMin, crMax float64, monsterType string) ([]domain.SRDMonster, error) {
	conditions := []string{
		`CASE WHEN cr = '1/8' THEN 0.125 WHEN cr = '1/4' THEN 0.25 WHEN cr = '1/2' THEN 0.5 ELSE CAST(cr AS REAL) END >= $1`,
		`CASE WHEN cr = '1/8' THEN 0.125 WHEN cr = '1/4' THEN 0.25 WHEN cr = '1/2' THEN 0.5 ELSE CAST(cr AS REAL) END <= $2`,
	}
	args := []interface{}{crMin, crMax}

	if monsterType != "" {
		conditions = append(conditions, "LOWER(type) = LOWER($3)")
		args = append(args, monsterType)
	}

	query := fmt.Sprintf(`SELECT id, name, size, type, subtype, alignment, ac, ac_type, hp, hit_dice, 
		speed::text, str, dex, con, "int", wis, cha, cr, xp, senses, languages, 
		traits::text, actions::text, legendary_actions::text, reactions::text,
		resistances, immunities, vulnerabilities, condition_immunities,
		saving_throws::text, skills::text, proficiency_bonus, is_srd, created_at
		FROM srd_monsters WHERE %s ORDER BY xp ASC`,
		strings.Join(conditions, " AND "),
	)

	monsters := []domain.SRDMonster{}
	if err := r.db.Select(&monsters, query, args...); err != nil {
		return nil, fmt.Errorf("get monsters by CR range: %w", err)
	}
	return monsters, nil
}

// ── Spells ──────────────────────────────────────────────────

// SearchSpells queries srd_spells with filters, FTS, and pagination.
func (r *SRDRepository) SearchSpells(filters domain.SpellFilters) (*domain.PaginatedResult[domain.SpellListItem], error) {
	filters.Limit, filters.Offset = defaultPagination(filters.Limit, filters.Offset)

	conditions := []string{}
	args := map[string]interface{}{}

	if filters.Query != "" {
		fts := sanitizeFTSQuery(filters.Query)
		if fts != "" {
			conditions = append(conditions, "search_vector @@ to_tsquery('english', :fts_query)")
			args["fts_query"] = fts
		}
	}
	if filters.Level != nil {
		conditions = append(conditions, "level = :level")
		args["level"] = *filters.Level
	}
	if filters.School != "" {
		conditions = append(conditions, "LOWER(school) = LOWER(:school)")
		args["school"] = filters.School
	}
	if filters.ClassName != "" {
		conditions = append(conditions, "classes::jsonb @> :class_json::jsonb")
		args["class_json"] = fmt.Sprintf(`["%s"]`, filters.ClassName)
	}
	if filters.Concentration != nil {
		conditions = append(conditions, "concentration = :concentration")
		args["concentration"] = *filters.Concentration
	}
	if filters.Ritual != nil {
		conditions = append(conditions, "ritual = :ritual")
		args["ritual"] = *filters.Ritual
	}
	if filters.IsSRD != nil {
		conditions = append(conditions, "is_srd = :is_srd")
		args["is_srd"] = *filters.IsSRD
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countRow, err := r.db.NamedQuery(fmt.Sprintf("SELECT COUNT(*) FROM srd_spells %s", where), args)
	if err != nil {
		return nil, fmt.Errorf("count spells: %w", err)
	}
	defer countRow.Close()
	if countRow.Next() {
		if err := countRow.Scan(&total); err != nil {
			return nil, fmt.Errorf("scan count: %w", err)
		}
	}

	args["limit"] = filters.Limit
	args["offset"] = filters.Offset
	dataQuery := fmt.Sprintf(
		"SELECT id, name, level, school, casting_time, concentration, ritual, is_srd FROM srd_spells %s ORDER BY level ASC, name ASC LIMIT :limit OFFSET :offset",
		where,
	)

	rows, err := r.db.NamedQuery(dataQuery, args)
	if err != nil {
		return nil, fmt.Errorf("search spells: %w", err)
	}
	defer rows.Close()

	items := []domain.SpellListItem{}
	for rows.Next() {
		var item domain.SpellListItem
		if err := rows.StructScan(&item); err != nil {
			return nil, fmt.Errorf("scan spell: %w", err)
		}
		items = append(items, item)
	}

	return &domain.PaginatedResult[domain.SpellListItem]{
		Data:   items,
		Total:  total,
		Limit:  filters.Limit,
		Offset: filters.Offset,
	}, nil
}

// GetSpell returns a single spell by ID with all fields.
func (r *SRDRepository) GetSpell(id int64) (*domain.SRDSpell, error) {
	var spell domain.SRDSpell
	err := r.db.Get(&spell, `SELECT id, name, level, school, casting_time, range, duration,
		concentration, ritual, components_v, components_s, components_m, material_desc,
		description, higher_levels, classes::text, damage_type, area_type, is_srd, created_at
		FROM srd_spells WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get spell %d: %w", id, err)
	}
	return &spell, nil
}

// ── Equipment ───────────────────────────────────────────────

// SearchEquipment queries srd_equipment with filters, FTS, and pagination.
func (r *SRDRepository) SearchEquipment(filters domain.EquipmentFilters) (*domain.PaginatedResult[domain.SRDEquipment], error) {
	filters.Limit, filters.Offset = defaultPagination(filters.Limit, filters.Offset)

	conditions := []string{}
	args := map[string]interface{}{}

	if filters.Query != "" {
		fts := sanitizeFTSQuery(filters.Query)
		if fts != "" {
			conditions = append(conditions, "search_vector @@ to_tsquery('english', :fts_query)")
			args["fts_query"] = fts
		}
	}
	if filters.Category != "" {
		conditions = append(conditions, "LOWER(category) = LOWER(:category)")
		args["category"] = filters.Category
	}
	if filters.IsSRD != nil {
		conditions = append(conditions, "is_srd = :is_srd")
		args["is_srd"] = *filters.IsSRD
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countRow, err := r.db.NamedQuery(fmt.Sprintf("SELECT COUNT(*) FROM srd_equipment %s", where), args)
	if err != nil {
		return nil, fmt.Errorf("count equipment: %w", err)
	}
	defer countRow.Close()
	if countRow.Next() {
		if err := countRow.Scan(&total); err != nil {
			return nil, fmt.Errorf("scan count: %w", err)
		}
	}

	args["limit"] = filters.Limit
	args["offset"] = filters.Offset
	dataQuery := fmt.Sprintf(
		`SELECT id, name, category, cost_gp, cost_unit, weight, description,
		 damage_dice, damage_type, weapon_category, weapon_range, range_normal, range_long,
		 properties::text, ac_base, ac_dex_bonus, ac_max_bonus, str_minimum, stealth_disadvantage,
		 armor_category, is_srd, created_at
		 FROM srd_equipment %s ORDER BY name ASC LIMIT :limit OFFSET :offset`, where)

	rows, err := r.db.NamedQuery(dataQuery, args)
	if err != nil {
		return nil, fmt.Errorf("search equipment: %w", err)
	}
	defer rows.Close()

	items := []domain.SRDEquipment{}
	for rows.Next() {
		var item domain.SRDEquipment
		if err := rows.StructScan(&item); err != nil {
			return nil, fmt.Errorf("scan equipment: %w", err)
		}
		items = append(items, item)
	}

	return &domain.PaginatedResult[domain.SRDEquipment]{
		Data:   items,
		Total:  total,
		Limit:  filters.Limit,
		Offset: filters.Offset,
	}, nil
}

// GetEquipment returns a single equipment item by ID.
func (r *SRDRepository) GetEquipment(id int64) (*domain.SRDEquipment, error) {
	var item domain.SRDEquipment
	err := r.db.Get(&item, `SELECT id, name, category, cost_gp, cost_unit, weight, description,
		damage_dice, damage_type, weapon_category, weapon_range, range_normal, range_long,
		properties::text, ac_base, ac_dex_bonus, ac_max_bonus, str_minimum, stealth_disadvantage,
		armor_category, is_srd, created_at
		FROM srd_equipment WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get equipment %d: %w", id, err)
	}
	return &item, nil
}

// ── Magic Items ─────────────────────────────────────────────

// SearchMagicItems queries srd_magic_items with filters, FTS, and pagination.
func (r *SRDRepository) SearchMagicItems(filters domain.MagicItemFilters) (*domain.PaginatedResult[domain.SRDMagicItem], error) {
	filters.Limit, filters.Offset = defaultPagination(filters.Limit, filters.Offset)

	conditions := []string{}
	args := map[string]interface{}{}

	if filters.Query != "" {
		fts := sanitizeFTSQuery(filters.Query)
		if fts != "" {
			conditions = append(conditions, "search_vector @@ to_tsquery('english', :fts_query)")
			args["fts_query"] = fts
		}
	}
	if filters.Rarity != "" {
		conditions = append(conditions, "LOWER(rarity) = LOWER(:rarity)")
		args["rarity"] = filters.Rarity
	}
	if filters.IsSRD != nil {
		conditions = append(conditions, "is_srd = :is_srd")
		args["is_srd"] = *filters.IsSRD
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countRow, err := r.db.NamedQuery(fmt.Sprintf("SELECT COUNT(*) FROM srd_magic_items %s", where), args)
	if err != nil {
		return nil, fmt.Errorf("count magic items: %w", err)
	}
	defer countRow.Close()
	if countRow.Next() {
		if err := countRow.Scan(&total); err != nil {
			return nil, fmt.Errorf("scan count: %w", err)
		}
	}

	args["limit"] = filters.Limit
	args["offset"] = filters.Offset
	dataQuery := fmt.Sprintf(
		"SELECT id, name, rarity, requires_attunement, attunement_desc, description, category, is_srd, created_at FROM srd_magic_items %s ORDER BY name ASC LIMIT :limit OFFSET :offset",
		where,
	)

	rows, err := r.db.NamedQuery(dataQuery, args)
	if err != nil {
		return nil, fmt.Errorf("search magic items: %w", err)
	}
	defer rows.Close()

	items := []domain.SRDMagicItem{}
	for rows.Next() {
		var item domain.SRDMagicItem
		if err := rows.StructScan(&item); err != nil {
			return nil, fmt.Errorf("scan magic item: %w", err)
		}
		items = append(items, item)
	}

	return &domain.PaginatedResult[domain.SRDMagicItem]{
		Data:   items,
		Total:  total,
		Limit:  filters.Limit,
		Offset: filters.Offset,
	}, nil
}

// GetMagicItem returns a single magic item by ID.
func (r *SRDRepository) GetMagicItem(id int64) (*domain.SRDMagicItem, error) {
	var item domain.SRDMagicItem
	err := r.db.Get(&item, `SELECT id, name, rarity, requires_attunement, attunement_desc, description, category, is_srd, created_at
		FROM srd_magic_items WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get magic item %d: %w", id, err)
	}
	return &item, nil
}

// ── Classes ─────────────────────────────────────────────────

// ListClasses returns all SRD classes.
func (r *SRDRepository) ListClasses() ([]domain.SRDClass, error) {
	classes := []domain.SRDClass{}
	err := r.db.Select(&classes, `SELECT id, name, hit_die, primary_ability, saving_throws::text,
		armor_proficiencies::text, weapon_proficiencies::text, tool_proficiencies::text,
		skill_choices::text, starting_equipment, spellcasting_ability, description, is_srd, created_at
		FROM srd_classes ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list classes: %w", err)
	}
	return classes, nil
}

// GetClassByName returns a class by name with its features and spell slots.
func (r *SRDRepository) GetClassByName(name string) (*domain.SRDClass, error) {
	var class domain.SRDClass
	err := r.db.Get(&class, `SELECT id, name, hit_die, primary_ability, saving_throws::text,
		armor_proficiencies::text, weapon_proficiencies::text, tool_proficiencies::text,
		skill_choices::text, starting_equipment, spellcasting_ability, description, is_srd, created_at
		FROM srd_classes WHERE LOWER(name) = LOWER($1)`, name)
	if err != nil {
		return nil, fmt.Errorf("get class %s: %w", name, err)
	}

	// Load features
	err = r.db.Select(&class.Features, `SELECT id, class_id, name, level, description, created_at
		FROM srd_class_features WHERE class_id = $1 ORDER BY level ASC, name ASC`, class.ID)
	if err != nil {
		return nil, fmt.Errorf("get class features: %w", err)
	}

	// Load spell slots
	err = r.db.Select(&class.SpellSlots, `SELECT id, class_id, class_level, cantrips_known, spells_known,
		slot_1, slot_2, slot_3, slot_4, slot_5, slot_6, slot_7, slot_8, slot_9
		FROM srd_class_spell_slots WHERE class_id = $1 ORDER BY class_level ASC`, class.ID)
	if err != nil {
		return nil, fmt.Errorf("get class spell slots: %w", err)
	}

	return &class, nil
}

// ── Races ───────────────────────────────────────────────────

// ListRaces returns all SRD races.
func (r *SRDRepository) ListRaces() ([]domain.SRDRace, error) {
	races := []domain.SRDRace{}
	err := r.db.Select(&races, `SELECT id, name, speed, size, ability_bonuses::text, traits::text,
		languages::text, subraces::text, description, is_srd, created_at
		FROM srd_races ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list races: %w", err)
	}
	return races, nil
}

// GetRaceByName returns a race by name.
func (r *SRDRepository) GetRaceByName(name string) (*domain.SRDRace, error) {
	var race domain.SRDRace
	err := r.db.Get(&race, `SELECT id, name, speed, size, ability_bonuses::text, traits::text,
		languages::text, subraces::text, description, is_srd, created_at
		FROM srd_races WHERE LOWER(name) = LOWER($1)`, name)
	if err != nil {
		return nil, fmt.Errorf("get race %s: %w", name, err)
	}
	return &race, nil
}

// ── Conditions ──────────────────────────────────────────────

// ListConditions returns all SRD conditions.
func (r *SRDRepository) ListConditions() ([]domain.SRDCondition, error) {
	conditions := []domain.SRDCondition{}
	err := r.db.Select(&conditions, `SELECT id, name, description, effects::text, is_srd, created_at
		FROM srd_conditions ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("list conditions: %w", err)
	}
	return conditions, nil
}

// ── Rules ───────────────────────────────────────────────────

// SearchRules queries srd_rules with FTS and pagination.
func (r *SRDRepository) SearchRules(filters domain.RulesFilters) (*domain.PaginatedResult[domain.SRDRule], error) {
	filters.Limit, filters.Offset = defaultPagination(filters.Limit, filters.Offset)

	conditions := []string{}
	args := map[string]interface{}{}

	if filters.Query != "" {
		fts := sanitizeFTSQuery(filters.Query)
		if fts != "" {
			conditions = append(conditions, "search_vector @@ to_tsquery('english', :fts_query)")
			args["fts_query"] = fts
		}
	}
	if filters.Category != "" {
		conditions = append(conditions, "LOWER(category) = LOWER(:category)")
		args["category"] = filters.Category
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countRow, err := r.db.NamedQuery(fmt.Sprintf("SELECT COUNT(*) FROM srd_rules %s", where), args)
	if err != nil {
		return nil, fmt.Errorf("count rules: %w", err)
	}
	defer countRow.Close()
	if countRow.Next() {
		if err := countRow.Scan(&total); err != nil {
			return nil, fmt.Errorf("scan count: %w", err)
		}
	}

	args["limit"] = filters.Limit
	args["offset"] = filters.Offset
	dataQuery := fmt.Sprintf(
		"SELECT id, name, category, content, parent_rule_id, is_srd, created_at FROM srd_rules %s ORDER BY name ASC LIMIT :limit OFFSET :offset",
		where,
	)

	rows, err := r.db.NamedQuery(dataQuery, args)
	if err != nil {
		return nil, fmt.Errorf("search rules: %w", err)
	}
	defer rows.Close()

	items := []domain.SRDRule{}
	for rows.Next() {
		var item domain.SRDRule
		if err := rows.StructScan(&item); err != nil {
			return nil, fmt.Errorf("scan rule: %w", err)
		}
		items = append(items, item)
	}

	return &domain.PaginatedResult[domain.SRDRule]{
		Data:   items,
		Total:  total,
		Limit:  filters.Limit,
		Offset: filters.Offset,
	}, nil
}
