package repository

import (
	"context"
	"fmt"

	"dnd-campaign-manager/internal/domain"
)

// Read-all helpers used by the Foundry exporter (cmd/foundry-export) and the
// reverse reference sync. Explicit column lists (JSONB cast to ::text) so they
// scan into the domain structs.

func (r *FoundryRepository) AllSpells(ctx context.Context) ([]domain.SRDSpell, error) {
	var out []domain.SRDSpell
	q := `SELECT id,name,level,school,casting_time,range,duration,concentration,ritual,
		components_v,components_s,components_m,material_desc,description,higher_levels,
		classes::text AS classes,damage_type,area_type,is_srd,created_at
		FROM srd_spells ORDER BY id`
	return out, r.db.SelectContext(ctx, &out, q)
}

func (r *FoundryRepository) AllMonsters(ctx context.Context) ([]domain.SRDMonster, error) {
	var out []domain.SRDMonster
	q := `SELECT id,name,size,type,subtype,alignment,ac,ac_type,hp,hit_dice,
		speed::text AS speed,str,dex,con,"int",wis,cha,cr,xp,senses,languages,
		traits::text AS traits,actions::text AS actions,legendary_actions::text AS legendary_actions,
		reactions::text AS reactions,resistances,immunities,vulnerabilities,condition_immunities,
		saving_throws::text AS saving_throws,skills::text AS skills,proficiency_bonus,is_srd,
		foundry_uuid,created_at
		FROM srd_monsters ORDER BY id`
	return out, r.db.SelectContext(ctx, &out, q)
}

func (r *FoundryRepository) AllEquipment(ctx context.Context) ([]domain.SRDEquipment, error) {
	var out []domain.SRDEquipment
	q := `SELECT id,name,category,cost_gp,cost_unit,weight,description,damage_dice,damage_type,
		weapon_category,weapon_range,range_normal,range_long,properties::text AS properties,
		ac_base,ac_dex_bonus,ac_max_bonus,str_minimum,stealth_disadvantage,armor_category,is_srd,created_at
		FROM srd_equipment ORDER BY id`
	return out, r.db.SelectContext(ctx, &out, q)
}

func (r *FoundryRepository) AllMagicItems(ctx context.Context) ([]domain.SRDMagicItem, error) {
	var out []domain.SRDMagicItem
	q := `SELECT id,name,rarity,requires_attunement,attunement_desc,description,category,is_srd,created_at
		FROM srd_magic_items ORDER BY id`
	return out, r.db.SelectContext(ctx, &out, q)
}

func (r *FoundryRepository) AllClasses(ctx context.Context) ([]domain.SRDClass, error) {
	var out []domain.SRDClass
	q := `SELECT id,name,hit_die,primary_ability,
		saving_throws::text AS saving_throws,armor_proficiencies::text AS armor_proficiencies,
		weapon_proficiencies::text AS weapon_proficiencies,tool_proficiencies::text AS tool_proficiencies,
		skill_choices::text AS skill_choices,starting_equipment,spellcasting_ability,description,is_srd,created_at
		FROM srd_classes ORDER BY id`
	return out, r.db.SelectContext(ctx, &out, q)
}

func (r *FoundryRepository) AllRaces(ctx context.Context) ([]domain.SRDRace, error) {
	var out []domain.SRDRace
	q := `SELECT id,name,speed,size,ability_bonuses::text AS ability_bonuses,traits::text AS traits,
		languages::text AS languages,subraces::text AS subraces,description,is_srd,created_at
		FROM srd_races ORDER BY id`
	return out, r.db.SelectContext(ctx, &out, q)
}

func (r *FoundryRepository) AllSubclasses(ctx context.Context) ([]domain.SRDSubclass, error) {
	var out []domain.SRDSubclass
	q := `SELECT id,class_name,name,description,foundry_uuid,is_srd,created_at
		FROM srd_subclasses ORDER BY id`
	return out, r.db.SelectContext(ctx, &out, q)
}

var srdUUIDTables = map[string]bool{
	"srd_spells": true, "srd_monsters": true, "srd_equipment": true,
	"srd_magic_items": true, "srd_classes": true, "srd_races": true, "srd_subclasses": true,
}

// SetSRDFoundryUUID stamps the deterministic Foundry compendium id onto an srd_* row
// so the reverse sync can map it. table is whitelisted.
func (r *FoundryRepository) SetSRDFoundryUUID(ctx context.Context, table string, id int64, uuid string) error {
	if !srdUUIDTables[table] {
		return fmt.Errorf("invalid srd table: %s", table)
	}
	_, err := r.db.ExecContext(ctx, fmt.Sprintf("UPDATE %s SET foundry_uuid=$1 WHERE id=$2", table), uuid, id)
	return err
}

// ── Reference upserts (Foundry → Postgres), keyed by foundry_uuid ──

func (r *FoundryRepository) UpsertSRDSpell(ctx context.Context, s domain.SRDSpell, foundryUUID string, isSRD bool) error {
	q := `INSERT INTO srd_spells (name, level, school, description, concentration, ritual,
			components_v, components_s, components_m, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, level=EXCLUDED.level, school=EXCLUDED.school, description=EXCLUDED.description,
			concentration=EXCLUDED.concentration, ritual=EXCLUDED.ritual,
			components_v=EXCLUDED.components_v, components_s=EXCLUDED.components_s, components_m=EXCLUDED.components_m`
	_, err := r.db.ExecContext(ctx, q, s.Name, s.Level, s.School, s.Description, s.Concentration, s.Ritual,
		s.ComponentsV, s.ComponentsS, s.ComponentsM, isSRD, foundryUUID)
	return err
}

func (r *FoundryRepository) UpsertSRDMonster(ctx context.Context, m domain.SRDMonster, isSRD bool) error {
	q := `INSERT INTO srd_monsters (name, size, type, alignment, ac, hp, hit_dice, str, dex, con, "int", wis, cha, cr, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, size=EXCLUDED.size, type=EXCLUDED.type, alignment=EXCLUDED.alignment,
			ac=EXCLUDED.ac, hp=EXCLUDED.hp, hit_dice=EXCLUDED.hit_dice, str=EXCLUDED.str, dex=EXCLUDED.dex,
			con=EXCLUDED.con, "int"=EXCLUDED."int", wis=EXCLUDED.wis, cha=EXCLUDED.cha, cr=EXCLUDED.cr`
	_, err := r.db.ExecContext(ctx, q, m.Name, m.Size, m.Type, m.Alignment, m.AC, m.HP, m.HitDice,
		m.STR, m.DEX, m.CON, m.INT, m.WIS, m.CHA, m.CR, isSRD, m.FoundryUUID)
	return err
}

func (r *FoundryRepository) UpsertSRDEquipment(ctx context.Context, e domain.SRDEquipment, foundryUUID string, isSRD bool) error {
	q := `INSERT INTO srd_equipment (name, category, cost_gp, cost_unit, weight, description, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, category=EXCLUDED.category, cost_gp=EXCLUDED.cost_gp,
			cost_unit=EXCLUDED.cost_unit, weight=EXCLUDED.weight, description=EXCLUDED.description`
	_, err := r.db.ExecContext(ctx, q, e.Name, e.Category, e.CostGP, e.CostUnit, e.Weight, e.Description, isSRD, foundryUUID)
	return err
}

func (r *FoundryRepository) UpsertSRDMagicItem(ctx context.Context, mi domain.SRDMagicItem, foundryUUID string, isSRD bool) error {
	q := `INSERT INTO srd_magic_items (name, rarity, requires_attunement, description, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, rarity=EXCLUDED.rarity, requires_attunement=EXCLUDED.requires_attunement,
			description=EXCLUDED.description`
	_, err := r.db.ExecContext(ctx, q, mi.Name, mi.Rarity, mi.RequiresAttunement, mi.Description, isSRD, foundryUUID)
	return err
}

func (r *FoundryRepository) UpsertSRDClass(ctx context.Context, c domain.SRDClass, foundryUUID string, isSRD bool) error {
	q := `INSERT INTO srd_classes (name, hit_die, spellcasting_ability, description, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, hit_die=EXCLUDED.hit_die, spellcasting_ability=EXCLUDED.spellcasting_ability,
			description=EXCLUDED.description`
	_, err := r.db.ExecContext(ctx, q, c.Name, c.HitDie, c.SpellcastingAbility, c.Description, isSRD, foundryUUID)
	return err
}

func (r *FoundryRepository) UpsertSRDSubclass(ctx context.Context, sc domain.SRDSubclass, isSRD bool) error {
	q := `INSERT INTO srd_subclasses (class_name, name, description, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			class_name=EXCLUDED.class_name, name=EXCLUDED.name, description=EXCLUDED.description`
	_, err := r.db.ExecContext(ctx, q, sc.ClassName, sc.Name, sc.Description, isSRD, sc.FoundryUUID)
	return err
}

func (r *FoundryRepository) UpsertSRDRace(ctx context.Context, rc domain.SRDRace, foundryUUID string, isSRD bool) error {
	q := `INSERT INTO srd_races (name, speed, size, description, is_srd, foundry_uuid)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (foundry_uuid) WHERE foundry_uuid IS NOT NULL DO UPDATE SET
			name=EXCLUDED.name, speed=EXCLUDED.speed, size=EXCLUDED.size, description=EXCLUDED.description`
	_, err := r.db.ExecContext(ctx, q, rc.Name, rc.Speed, orDefaultSize(rc.Size), rc.Description, isSRD, foundryUUID)
	return err
}

func orDefaultSize(s string) string {
	if s == "" {
		return "Medium"
	}
	return s
}
