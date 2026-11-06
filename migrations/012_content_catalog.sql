-- +goose Up
CREATE TABLE content_imports (
    id BIGSERIAL PRIMARY KEY,
    root_path_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    counts JSONB NOT NULL DEFAULT '{}',
    error TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE content_entities (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Unknown',
    page INTEGER,
    is_srd BOOLEAN NOT NULL DEFAULT FALSE,
    origin TEXT NOT NULL DEFAULT 'official' CHECK (origin IN ('official', 'homebrew')),
    data JSONB NOT NULL,
    search_text TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(entity_type, normalized_name, source)
);
CREATE INDEX idx_content_entities_type ON content_entities(entity_type);
CREATE INDEX idx_content_entities_source ON content_entities(source);
CREATE INDEX idx_content_entities_srd ON content_entities(is_srd);
CREATE INDEX idx_content_entities_search ON content_entities USING GIN(to_tsvector('simple', search_text));

CREATE TABLE content_references (
    entity_id BIGINT NOT NULL REFERENCES content_entities(id) ON DELETE CASCADE,
    reference_text TEXT NOT NULL,
    reference_type TEXT NOT NULL DEFAULT '',
    target_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL,
    PRIMARY KEY(entity_id, reference_text)
);
CREATE INDEX idx_content_references_target ON content_references(target_id);

ALTER TABLE srd_monsters ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE srd_monsters ADD COLUMN IF NOT EXISTS content_entity_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL;
ALTER TABLE srd_spells ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE srd_spells ADD COLUMN IF NOT EXISTS content_entity_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL;
ALTER TABLE srd_equipment ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE srd_equipment ADD COLUMN IF NOT EXISTS content_entity_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL;
ALTER TABLE srd_magic_items ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE srd_magic_items ADD COLUMN IF NOT EXISTS content_entity_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL;
ALTER TABLE srd_classes ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE srd_classes ADD COLUMN IF NOT EXISTS content_entity_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL;
ALTER TABLE srd_races ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE srd_races ADD COLUMN IF NOT EXISTS content_entity_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL;
ALTER TABLE srd_subclasses ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE srd_subclasses ADD COLUMN IF NOT EXISTS content_entity_id BIGINT REFERENCES content_entities(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_srd_monsters_unique_name;
DROP INDEX IF EXISTS idx_srd_spells_unique_name;
DROP INDEX IF EXISTS idx_srd_equipment_unique_name;
DROP INDEX IF EXISTS idx_srd_magic_items_unique_name;
ALTER TABLE srd_classes DROP CONSTRAINT IF EXISTS srd_classes_name_key;
ALTER TABLE srd_races DROP CONSTRAINT IF EXISTS srd_races_name_key;
CREATE UNIQUE INDEX idx_srd_monsters_identity ON srd_monsters(name, source);
CREATE UNIQUE INDEX idx_srd_spells_identity ON srd_spells(name, source);
CREATE UNIQUE INDEX idx_srd_equipment_identity ON srd_equipment(name, source);
CREATE UNIQUE INDEX idx_srd_magic_items_identity ON srd_magic_items(name, source);
CREATE UNIQUE INDEX idx_srd_classes_identity ON srd_classes(name, source);
CREATE UNIQUE INDEX idx_srd_races_identity ON srd_races(name, source);
CREATE UNIQUE INDEX idx_srd_subclasses_identity ON srd_subclasses(class_name, name, source);
-- Imported rule sets contain exact duplicates; keep the oldest row and repoint children.
UPDATE srd_rules r SET parent_rule_id = k.keep
FROM (SELECT id, MIN(id) OVER (PARTITION BY name, category) AS keep FROM srd_rules) k
WHERE r.parent_rule_id = k.id AND k.id <> k.keep;
DELETE FROM srd_rules a USING srd_rules b
WHERE a.name = b.name AND a.category = b.category AND a.id > b.id;
CREATE UNIQUE INDEX idx_srd_rules_identity ON srd_rules(name, category);

-- +goose Down
DROP INDEX IF EXISTS idx_srd_subclasses_identity;
DROP INDEX IF EXISTS idx_srd_races_identity;
DROP INDEX IF EXISTS idx_srd_classes_identity;
DROP INDEX IF EXISTS idx_srd_magic_items_identity;
DROP INDEX IF EXISTS idx_srd_equipment_identity;
DROP INDEX IF EXISTS idx_srd_spells_identity;
DROP INDEX IF EXISTS idx_srd_monsters_identity;
ALTER TABLE srd_subclasses DROP COLUMN IF EXISTS content_entity_id;
ALTER TABLE srd_subclasses DROP COLUMN IF EXISTS source;
ALTER TABLE srd_races DROP COLUMN IF EXISTS content_entity_id;
ALTER TABLE srd_races DROP COLUMN IF EXISTS source;
ALTER TABLE srd_classes DROP COLUMN IF EXISTS content_entity_id;
ALTER TABLE srd_classes DROP COLUMN IF EXISTS source;
ALTER TABLE srd_magic_items DROP COLUMN IF EXISTS content_entity_id;
ALTER TABLE srd_magic_items DROP COLUMN IF EXISTS source;
ALTER TABLE srd_equipment DROP COLUMN IF EXISTS content_entity_id;
ALTER TABLE srd_equipment DROP COLUMN IF EXISTS source;
ALTER TABLE srd_spells DROP COLUMN IF EXISTS content_entity_id;
ALTER TABLE srd_spells DROP COLUMN IF EXISTS source;
ALTER TABLE srd_monsters DROP COLUMN IF EXISTS content_entity_id;
ALTER TABLE srd_monsters DROP COLUMN IF EXISTS source;
DROP TABLE IF EXISTS content_references;
DROP TABLE IF EXISTS content_entities;
DROP TABLE IF EXISTS content_imports;
