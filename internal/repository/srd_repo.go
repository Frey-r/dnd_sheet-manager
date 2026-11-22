package repository

import (
	"database/sql"
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

// notShadowedLegacySQL hides legacy monster rows (imported before the content catalog: no
// content_entity_id, not homebrew) when the catalog has a creature with the same name, so
// the bestiary and encounter builder do not list "Goblin" twice. Nothing is deleted: the row
// stays reachable by id for combats and tokens that reference it, and legacy rows without a
// catalog equivalent stay visible.
const notShadowedLegacySQL = `NOT (srd_monsters.content_entity_id IS NULL AND srd_monsters.created_by IS NULL
	AND EXISTS (SELECT 1 FROM srd_monsters cat WHERE cat.content_entity_id IS NOT NULL
		AND LOWER(cat.name) = LOWER(srd_monsters.name)))`

// crNumericSQL converts the text cr column to a number. Catalog monsters can have an empty or
// non-numeric CR ("" for summons/variants, "Unknown"); those become NULL and drop out of CR
// filters instead of failing the whole query with "invalid input syntax for type real".
const crNumericSQL = `(CASE WHEN cr = '1/8' THEN 0.125 WHEN cr = '1/4' THEN 0.25 WHEN cr = '1/2' THEN 0.5
	WHEN cr ~ '^[0-9]+(\.[0-9]+)?$' THEN CAST(cr AS REAL) END)`

// sanitizeFTSQuery cleans a raw user query for PostgreSQL FTS.
func sanitizeFTSQuery(query string) string {
	// Remove special FTS characters
	cleaned := strings.Map(func(r rune) rune {
		switch r {
		case '*', '"', '\'', ':', '(', ')', '^', '~', '{', '}', '<', '>', '!', '&', '|', '\\':
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

	conditions := []string{notShadowedLegacySQL}
	args := map[string]interface{}{}

	rankExpr := "CAST(0 AS float8)"
	orderBy := "name ASC"
	if filters.Query != "" {
		fts := sanitizeFTSQuery(filters.Query)
		if fts != "" {
			conditions = append(conditions, "search_vector @@ to_tsquery('english', :fts_query)")
			args["fts_query"] = fts
			args["name_query"] = strings.TrimSpace(filters.Query)
			args["name_prefix"] = strings.TrimSpace(filters.Query) + "%"
			rankExpr = "CAST(ts_rank(search_vector, to_tsquery('english', :fts_query)) AS float8)"
			// With the full catalog, lore text mentioning a word often outranks the creature
			// itself ("Goblin" below NPCs that talk about goblins): exact and prefix name
			// matches come first, then FTS relevance.
			orderBy = "(LOWER(name) = LOWER(:name_query)) DESC, (name ILIKE :name_prefix) DESC, rank DESC, name ASC"
		}
	}
	if filters.CR != "" {
		conditions = append(conditions, "cr = :cr")
		args["cr"] = filters.CR
	}
	if filters.CRMin > 0 || filters.HasCRMin {
		conditions = append(conditions, crNumericSQL+` >= :cr_min`)
		args["cr_min"] = filters.CRMin
	}
	if filters.CRMax > 0 || filters.HasCRMax {
		conditions = append(conditions, crNumericSQL+` <= :cr_max`)
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
		"SELECT id, name, size, type, cr, xp, hp, ac, is_srd, source, (created_by IS NOT NULL) AS is_homebrew, %s AS rank FROM srd_monsters %s ORDER BY %s LIMIT :limit OFFSET :offset",
		rankExpr, where, orderBy,
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
		saving_throws::text, skills::text, proficiency_bonus, is_srd, created_at,
		source, created_by, (created_by IS NOT NULL) AS is_homebrew
		FROM srd_monsters WHERE id = $1`, id)
	if err != nil {
		return nil, fmt.Errorf("get monster %d: %w", id, err)
	}
	return &monster, nil
}

// GetMonstersByCRRange returns monsters within a CR range, for encounter building.
func (r *SRDRepository) GetMonstersByCRRange(crMin, crMax float64, monsterType string) ([]domain.SRDMonster, error) {
	conditions := []string{
		crNumericSQL + ` >= $1`,
		crNumericSQL + ` <= $2`,
		notShadowedLegacySQL,
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

	rankExpr := "CAST(0 AS float8)"
	orderBy := "level ASC, name ASC"
	if filters.Query != "" {
		fts := sanitizeFTSQuery(filters.Query)
		if fts != "" {
			conditions = append(conditions, "search_vector @@ to_tsquery('english', :fts_query)")
			args["fts_query"] = fts
			rankExpr = "CAST(ts_rank(search_vector, to_tsquery('english', :fts_query)) AS float8)"
			orderBy = "rank DESC, level ASC, name ASC"
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
		// Case-insensitive match on the class list, bound as a plain parameter (building the
		// JSON with Sprintf broke on quotes and missed "wizard" vs "Wizard").
		conditions = append(conditions, spellHasClassSQL(":class_name"))
		args["class_name"] = filters.ClassName
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
		"SELECT id, name, level, school, casting_time, concentration, ritual, is_srd, %s AS rank FROM srd_spells %s ORDER BY %s LIMIT :limit OFFSET :offset",
		rankExpr, where, orderBy,
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
		 CAST(properties AS text), ac_base, ac_dex_bonus, ac_max_bonus, str_minimum, stealth_disadvantage,
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
	err := r.db.Select(&classes, `SELECT id, name, source, hit_die, primary_ability, saving_throws::text,
		armor_proficiencies::text, weapon_proficiencies::text, tool_proficiencies::text,
		skill_choices::text, starting_equipment, spellcasting_ability, description, is_srd, created_at
		FROM srd_classes ORDER BY name ASC, source ASC`)
	if err != nil {
		return nil, fmt.Errorf("list classes: %w", err)
	}
	return classes, nil
}

// spellHasClassSQL matches a spell whose class list contains param, ignoring case.
func spellHasClassSQL(param string) string {
	return `EXISTS (SELECT 1 FROM jsonb_array_elements_text(CAST(classes AS jsonb)) AS cls WHERE LOWER(cls) = LOWER(` + param + `))`
}

// editionPreference orders same-named catalog rows deterministically: the 2024 core books
// first, then the 2014 ones, then everything else by id (the full 5etools catalog holds e.g.
// "Wizard" from both PHB and XPHB).
const editionPreference = `CASE source WHEN 'XPHB' THEN 0 WHEN 'PHB' THEN 1 ELSE 2 END, id`

// GetClassByName returns a class by name with its features and spell slots.
func (r *SRDRepository) GetClassByName(name string) (*domain.SRDClass, error) {
	var class domain.SRDClass
	err := r.db.Get(&class, `SELECT id, name, source, hit_die, primary_ability, saving_throws::text,
		armor_proficiencies::text, weapon_proficiencies::text, tool_proficiencies::text,
		skill_choices::text, starting_equipment, spellcasting_ability, description, is_srd, created_at
		FROM srd_classes WHERE LOWER(name) = LOWER($1)
		ORDER BY `+editionPreference+` LIMIT 1`, name)
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
	err := r.db.Select(&races, `SELECT id, name, source, speed, size, ability_bonuses::text, traits::text,
		languages::text, subraces::text, description, is_srd, created_at
		FROM srd_races ORDER BY name ASC, source ASC`)
	if err != nil {
		return nil, fmt.Errorf("list races: %w", err)
	}
	return races, nil
}

// GetRaceByName returns a race by name.
func (r *SRDRepository) GetRaceByName(name string) (*domain.SRDRace, error) {
	var race domain.SRDRace
	err := r.db.Get(&race, `SELECT id, name, source, speed, size, ability_bonuses::text, traits::text,
		languages::text, subraces::text, description, is_srd, created_at
		FROM srd_races WHERE LOWER(name) = LOWER($1)
		ORDER BY `+editionPreference+` LIMIT 1`, name)
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

// -- Homebrew monsters (is_srd = FALSE) --

const homebrewInsertSQL = `INSERT INTO srd_monsters (name, size, type, subtype, alignment, ac, ac_type, hp, hit_dice,
	speed, str, dex, con, "int", wis, cha, cr, xp, senses, languages, traits, actions, legendary_actions, reactions,
	resistances, immunities, vulnerabilities, condition_immunities, saving_throws, skills, proficiency_bonus, is_srd, created_by, source)
	VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,
	$25,$26,$27,$28,$29::jsonb,$30::jsonb,$31,FALSE,$32,'Homebrew') RETURNING id`

// CreateHomebrewMonster inserts a custom monster with is_srd = FALSE owned by ownerID.
func (r *SRDRepository) CreateHomebrewMonster(m *domain.SRDMonster, ownerID int64) (int64, error) {
	var id int64
	err := r.db.QueryRow(homebrewInsertSQL, m.Name, m.Size, m.Type, m.Subtype, m.Alignment, m.AC, m.ACType, m.HP, m.HitDice,
		m.Speed, m.STR, m.DEX, m.CON, m.INT, m.WIS, m.CHA, m.CR, m.XP, m.Senses, m.Languages,
		m.Traits, m.Actions, m.LegendaryActions, m.Reactions, m.Resistances, m.Immunities, m.Vulnerabilities,
		m.ConditionImmunities, m.SavingThrows, m.Skills, m.ProficiencyBonus, ownerID).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("create homebrew monster: %w", err)
	}
	return id, nil
}

// UpdateHomebrewMonster updates a homebrew monster owned by ownerID (any homebrew when
// asAdmin); returns sql.ErrNoRows when the id is missing, an SRD entry or someone else's.
func (r *SRDRepository) UpdateHomebrewMonster(id int64, m *domain.SRDMonster, ownerID int64, asAdmin bool) error {
	res, err := r.db.Exec(`UPDATE srd_monsters SET name=$2, size=$3, type=$4, subtype=$5, alignment=$6, ac=$7, ac_type=$8, hp=$9,
		hit_dice=$10, speed=$11::jsonb, str=$12, dex=$13, con=$14, "int"=$15, wis=$16, cha=$17, cr=$18, xp=$19, senses=$20,
		languages=$21, traits=$22::jsonb, actions=$23::jsonb, legendary_actions=$24::jsonb, reactions=$25::jsonb,
		resistances=$26, immunities=$27, vulnerabilities=$28, condition_immunities=$29, saving_throws=$30::jsonb,
		skills=$31::jsonb, proficiency_bonus=$32 WHERE id=$1 AND created_by IS NOT NULL AND ($34 OR created_by = $33)`,
		id, m.Name, m.Size, m.Type, m.Subtype, m.Alignment, m.AC, m.ACType, m.HP, m.HitDice,
		m.Speed, m.STR, m.DEX, m.CON, m.INT, m.WIS, m.CHA, m.CR, m.XP, m.Senses, m.Languages,
		m.Traits, m.Actions, m.LegendaryActions, m.Reactions, m.Resistances, m.Immunities, m.Vulnerabilities,
		m.ConditionImmunities, m.SavingThrows, m.Skills, m.ProficiencyBonus, ownerID, asAdmin)
	if err != nil {
		return fmt.Errorf("update homebrew monster %d: %w", id, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteHomebrewMonster deletes a homebrew monster owned by ownerID (any homebrew when
// asAdmin); returns sql.ErrNoRows when missing, SRD or someone else's.
func (r *SRDRepository) DeleteHomebrewMonster(id, ownerID int64, asAdmin bool) error {
	res, err := r.db.Exec(`DELETE FROM srd_monsters WHERE id=$1 AND created_by IS NOT NULL AND ($3 OR created_by = $2)`, id, ownerID, asAdmin)
	if err != nil {
		return fmt.Errorf("delete homebrew monster %d: %w", id, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// -- Spell planner --

// GetSpellsForClass returns spells available to a class up to maxLevel (full rows).
func (r *SRDRepository) GetSpellsForClass(className string, maxLevel int) ([]domain.SRDSpell, error) {
	spells := []domain.SRDSpell{}
	// One row per spell name: the full catalog holds each spell once per edition (PHB, XPHB...),
	// so keep the preferred edition and drop the reprints.
	err := r.db.Select(&spells, `SELECT id, name, level, school, casting_time, range, duration,
		concentration, ritual, components_v, components_s, components_m, material_desc,
		description, higher_levels, classes, damage_type, area_type, is_srd, created_at
		FROM (SELECT DISTINCT ON (LOWER(name)) id, name, level, school, casting_time, range, duration,
			concentration, ritual, components_v, components_s, components_m, material_desc,
			description, higher_levels, classes::text AS classes, damage_type, area_type, is_srd, created_at
			FROM srd_spells WHERE `+spellHasClassSQL("$1")+` AND level <= $2
			ORDER BY LOWER(name), `+editionPreference+`) s
		ORDER BY level ASC, name ASC`, className, maxLevel)
	if err != nil {
		return nil, fmt.Errorf("spells for class %s: %w", className, err)
	}
	return spells, nil
}
