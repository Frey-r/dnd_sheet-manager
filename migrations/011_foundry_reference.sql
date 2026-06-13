-- +goose Up
-- Reference-data unification with Foundry: foundry_uuid mapping on srd_* catalogs
-- + subclasses table. See openspec/specs/foundry-integration.md.

ALTER TABLE srd_spells      ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE srd_equipment   ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE srd_magic_items ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE srd_classes     ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE srd_races       ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_spells_foundry_uuid      ON srd_spells(foundry_uuid)      WHERE foundry_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_equipment_foundry_uuid   ON srd_equipment(foundry_uuid)   WHERE foundry_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_magic_items_foundry_uuid ON srd_magic_items(foundry_uuid) WHERE foundry_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_classes_foundry_uuid     ON srd_classes(foundry_uuid)     WHERE foundry_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_races_foundry_uuid       ON srd_races(foundry_uuid)       WHERE foundry_uuid IS NOT NULL;

CREATE TABLE IF NOT EXISTS srd_subclasses (
    id BIGSERIAL PRIMARY KEY,
    class_name TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    foundry_uuid TEXT,
    is_srd BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_srd_subclasses_class ON srd_subclasses(class_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_subclasses_foundry_uuid ON srd_subclasses(foundry_uuid) WHERE foundry_uuid IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS srd_subclasses;
DROP INDEX IF EXISTS idx_srd_races_foundry_uuid;
DROP INDEX IF EXISTS idx_srd_classes_foundry_uuid;
DROP INDEX IF EXISTS idx_srd_magic_items_foundry_uuid;
DROP INDEX IF EXISTS idx_srd_equipment_foundry_uuid;
DROP INDEX IF EXISTS idx_srd_spells_foundry_uuid;
ALTER TABLE srd_races       DROP COLUMN IF EXISTS foundry_uuid;
ALTER TABLE srd_classes     DROP COLUMN IF EXISTS foundry_uuid;
ALTER TABLE srd_magic_items DROP COLUMN IF EXISTS foundry_uuid;
ALTER TABLE srd_equipment   DROP COLUMN IF EXISTS foundry_uuid;
ALTER TABLE srd_spells      DROP COLUMN IF EXISTS foundry_uuid;
