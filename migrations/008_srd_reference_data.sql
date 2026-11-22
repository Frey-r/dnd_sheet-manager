-- +goose Up
-- 008_srd_reference_data.sql
-- D&D 5e SRD Ground-Truth Reference Tables
-- Source: SRD 5.1 (CC-BY-4.0) via dnd-oracle / 5e-bits/5e-database

-- ============================================================
-- SRD Monsters (334 entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_monsters (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    size TEXT NOT NULL,
    type TEXT NOT NULL,
    subtype TEXT DEFAULT '',
    alignment TEXT NOT NULL DEFAULT '',
    ac INTEGER NOT NULL DEFAULT 10,
    ac_type TEXT DEFAULT '',
    hp INTEGER NOT NULL DEFAULT 1,
    hit_dice TEXT NOT NULL DEFAULT '1d8',
    speed JSONB NOT NULL DEFAULT '{}',
    str INTEGER NOT NULL DEFAULT 10,
    dex INTEGER NOT NULL DEFAULT 10,
    con INTEGER NOT NULL DEFAULT 10,
    "int" INTEGER NOT NULL DEFAULT 10,
    wis INTEGER NOT NULL DEFAULT 10,
    cha INTEGER NOT NULL DEFAULT 10,
    cr TEXT NOT NULL DEFAULT '0',
    xp INTEGER NOT NULL DEFAULT 0,
    senses TEXT DEFAULT '',
    languages TEXT DEFAULT '',
    traits JSONB DEFAULT '[]',
    actions JSONB DEFAULT '[]',
    legendary_actions JSONB DEFAULT '[]',
    reactions JSONB DEFAULT '[]',
    resistances TEXT DEFAULT '',
    immunities TEXT DEFAULT '',
    vulnerabilities TEXT DEFAULT '',
    condition_immunities TEXT DEFAULT '',
    saving_throws JSONB DEFAULT '{}',
    skills JSONB DEFAULT '{}',
    proficiency_bonus INTEGER DEFAULT 2,
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_monsters_unique_name ON srd_monsters(name) WHERE is_srd = TRUE;

CREATE INDEX IF NOT EXISTS idx_srd_monsters_name ON srd_monsters(name);
CREATE INDEX IF NOT EXISTS idx_srd_monsters_cr ON srd_monsters(cr);
CREATE INDEX IF NOT EXISTS idx_srd_monsters_type ON srd_monsters(type);
CREATE INDEX IF NOT EXISTS idx_srd_monsters_size ON srd_monsters(size);
CREATE INDEX IF NOT EXISTS idx_srd_monsters_is_srd ON srd_monsters(is_srd);
CREATE INDEX IF NOT EXISTS idx_srd_monsters_fts ON srd_monsters USING GIN(search_vector);

-- Auto-update search_vector on insert/update
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION srd_monsters_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.type, '') || ' ' || COALESCE(NEW.subtype, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_srd_monsters_search ON srd_monsters;
CREATE TRIGGER trg_srd_monsters_search
    BEFORE INSERT OR UPDATE ON srd_monsters
    FOR EACH ROW EXECUTE FUNCTION srd_monsters_search_trigger();

-- ============================================================
-- SRD Spells (319 entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_spells (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 9),
    school TEXT NOT NULL DEFAULT '',
    casting_time TEXT NOT NULL DEFAULT '',
    range TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    concentration BOOLEAN NOT NULL DEFAULT FALSE,
    ritual BOOLEAN NOT NULL DEFAULT FALSE,
    components_v BOOLEAN NOT NULL DEFAULT FALSE,
    components_s BOOLEAN NOT NULL DEFAULT FALSE,
    components_m BOOLEAN NOT NULL DEFAULT FALSE,
    material_desc TEXT DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    higher_levels TEXT DEFAULT '',
    classes JSONB DEFAULT '[]',
    damage_type TEXT DEFAULT '',
    area_type TEXT DEFAULT '',
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_spells_unique_name ON srd_spells(name) WHERE is_srd = TRUE;

CREATE INDEX IF NOT EXISTS idx_srd_spells_name ON srd_spells(name);
CREATE INDEX IF NOT EXISTS idx_srd_spells_level ON srd_spells(level);
CREATE INDEX IF NOT EXISTS idx_srd_spells_school ON srd_spells(school);
CREATE INDEX IF NOT EXISTS idx_srd_spells_concentration ON srd_spells(concentration);
CREATE INDEX IF NOT EXISTS idx_srd_spells_ritual ON srd_spells(ritual);
CREATE INDEX IF NOT EXISTS idx_srd_spells_is_srd ON srd_spells(is_srd);
CREATE INDEX IF NOT EXISTS idx_srd_spells_fts ON srd_spells USING GIN(search_vector);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION srd_spells_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.school, '') || ' ' || COALESCE(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_srd_spells_search ON srd_spells;
CREATE TRIGGER trg_srd_spells_search
    BEFORE INSERT OR UPDATE ON srd_spells
    FOR EACH ROW EXECUTE FUNCTION srd_spells_search_trigger();

-- ============================================================
-- SRD Equipment (237 entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_equipment (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    cost_gp DECIMAL(10,2) DEFAULT 0,
    cost_unit TEXT DEFAULT 'gp',
    weight DECIMAL(10,2) DEFAULT 0,
    description TEXT DEFAULT '',
    -- Weapon fields
    damage_dice TEXT DEFAULT '',
    damage_type TEXT DEFAULT '',
    weapon_category TEXT DEFAULT '',
    weapon_range TEXT DEFAULT '',
    range_normal INTEGER DEFAULT 0,
    range_long INTEGER DEFAULT 0,
    properties JSONB DEFAULT '[]',
    -- Armor fields
    ac_base INTEGER DEFAULT NULL,
    ac_dex_bonus BOOLEAN DEFAULT NULL,
    ac_max_bonus INTEGER DEFAULT NULL,
    str_minimum INTEGER DEFAULT NULL,
    stealth_disadvantage BOOLEAN DEFAULT FALSE,
    armor_category TEXT DEFAULT '',
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_equipment_unique_name ON srd_equipment(name) WHERE is_srd = TRUE;

CREATE INDEX IF NOT EXISTS idx_srd_equipment_name ON srd_equipment(name);
CREATE INDEX IF NOT EXISTS idx_srd_equipment_category ON srd_equipment(category);
CREATE INDEX IF NOT EXISTS idx_srd_equipment_is_srd ON srd_equipment(is_srd);
CREATE INDEX IF NOT EXISTS idx_srd_equipment_fts ON srd_equipment USING GIN(search_vector);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION srd_equipment_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.category, '') || ' ' || COALESCE(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_srd_equipment_search ON srd_equipment;
CREATE TRIGGER trg_srd_equipment_search
    BEFORE INSERT OR UPDATE ON srd_equipment
    FOR EACH ROW EXECUTE FUNCTION srd_equipment_search_trigger();

-- ============================================================
-- SRD Magic Items (239 entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_magic_items (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    requires_attunement BOOLEAN DEFAULT FALSE,
    attunement_desc TEXT DEFAULT '',
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_magic_items_unique_name ON srd_magic_items(name) WHERE is_srd = TRUE;

CREATE INDEX IF NOT EXISTS idx_srd_magic_items_name ON srd_magic_items(name);
CREATE INDEX IF NOT EXISTS idx_srd_magic_items_rarity ON srd_magic_items(rarity);
CREATE INDEX IF NOT EXISTS idx_srd_magic_items_is_srd ON srd_magic_items(is_srd);
CREATE INDEX IF NOT EXISTS idx_srd_magic_items_fts ON srd_magic_items USING GIN(search_vector);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION srd_magic_items_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.rarity, '') || ' ' || COALESCE(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_srd_magic_items_search ON srd_magic_items;
CREATE TRIGGER trg_srd_magic_items_search
    BEFORE INSERT OR UPDATE ON srd_magic_items
    FOR EACH ROW EXECUTE FUNCTION srd_magic_items_search_trigger();

-- ============================================================
-- SRD Classes (12 entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_classes (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    hit_die INTEGER NOT NULL DEFAULT 8,
    primary_ability TEXT DEFAULT '',
    saving_throws JSONB DEFAULT '[]',
    armor_proficiencies JSONB DEFAULT '[]',
    weapon_proficiencies JSONB DEFAULT '[]',
    tool_proficiencies JSONB DEFAULT '[]',
    skill_choices JSONB DEFAULT '{}',
    starting_equipment TEXT DEFAULT '',
    spellcasting_ability TEXT DEFAULT '',
    description TEXT DEFAULT '',
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class features per level
CREATE TABLE IF NOT EXISTS srd_class_features (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES srd_classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 20),
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srd_class_features_class ON srd_class_features(class_id);
CREATE INDEX IF NOT EXISTS idx_srd_class_features_level ON srd_class_features(level);

-- Spell slots per class per level
CREATE TABLE IF NOT EXISTS srd_class_spell_slots (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES srd_classes(id) ON DELETE CASCADE,
    class_level INTEGER NOT NULL CHECK (class_level BETWEEN 1 AND 20),
    cantrips_known INTEGER DEFAULT 0,
    spells_known INTEGER DEFAULT 0,
    slot_1 INTEGER DEFAULT 0,
    slot_2 INTEGER DEFAULT 0,
    slot_3 INTEGER DEFAULT 0,
    slot_4 INTEGER DEFAULT 0,
    slot_5 INTEGER DEFAULT 0,
    slot_6 INTEGER DEFAULT 0,
    slot_7 INTEGER DEFAULT 0,
    slot_8 INTEGER DEFAULT 0,
    slot_9 INTEGER DEFAULT 0,
    UNIQUE(class_id, class_level)
);

CREATE INDEX IF NOT EXISTS idx_srd_class_spell_slots_class ON srd_class_spell_slots(class_id);

-- ============================================================
-- SRD Races (9 entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_races (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    speed INTEGER NOT NULL DEFAULT 30,
    size TEXT NOT NULL DEFAULT 'Medium',
    ability_bonuses JSONB DEFAULT '{}',
    traits JSONB DEFAULT '[]',
    languages JSONB DEFAULT '[]',
    subraces JSONB DEFAULT '[]',
    description TEXT DEFAULT '',
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SRD Conditions (15 entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_conditions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    effects JSONB DEFAULT '[]',
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SRD Rules (33 sections)
-- ============================================================
CREATE TABLE IF NOT EXISTS srd_rules (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    parent_rule_id BIGINT REFERENCES srd_rules(id) ON DELETE SET NULL,
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srd_rules_name ON srd_rules(name);
CREATE INDEX IF NOT EXISTS idx_srd_rules_category ON srd_rules(category);
CREATE INDEX IF NOT EXISTS idx_srd_rules_fts ON srd_rules USING GIN(search_vector);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION srd_rules_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.category, '') || ' ' || COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_srd_rules_search ON srd_rules;
CREATE TRIGGER trg_srd_rules_search
    BEFORE INSERT OR UPDATE ON srd_rules
    FOR EACH ROW EXECUTE FUNCTION srd_rules_search_trigger();

-- ============================================================
-- Add srd_ref_id columns to existing campaign tables
-- ============================================================
ALTER TABLE spells ADD COLUMN IF NOT EXISTS srd_ref_id BIGINT REFERENCES srd_spells(id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS srd_ref_id BIGINT REFERENCES srd_equipment(id) ON DELETE SET NULL;
ALTER TABLE marketplace_items ADD COLUMN IF NOT EXISTS srd_ref_id BIGINT REFERENCES srd_equipment(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE marketplace_items DROP COLUMN IF EXISTS srd_ref_id;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS srd_ref_id;
ALTER TABLE spells DROP COLUMN IF EXISTS srd_ref_id;
DROP TABLE IF EXISTS srd_rules CASCADE;
DROP TABLE IF EXISTS srd_conditions CASCADE;
DROP TABLE IF EXISTS srd_races CASCADE;
DROP TABLE IF EXISTS srd_class_spell_slots CASCADE;
DROP TABLE IF EXISTS srd_class_features CASCADE;
DROP TABLE IF EXISTS srd_classes CASCADE;
DROP TABLE IF EXISTS srd_magic_items CASCADE;
DROP TABLE IF EXISTS srd_equipment CASCADE;
DROP TABLE IF EXISTS srd_spells CASCADE;
DROP TABLE IF EXISTS srd_monsters CASCADE;
DROP FUNCTION IF EXISTS srd_rules_search_trigger();
DROP FUNCTION IF EXISTS srd_magic_items_search_trigger();
DROP FUNCTION IF EXISTS srd_equipment_search_trigger();
DROP FUNCTION IF EXISTS srd_spells_search_trigger();
DROP FUNCTION IF EXISTS srd_monsters_search_trigger();
