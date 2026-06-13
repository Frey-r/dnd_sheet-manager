-- +goose Up
-- Foundry VTT integration: one-way mirror of game-state from Foundry.
-- See openspec/specs/foundry-integration.md.

-- ── foundry_uuid mapping + orphan flag on existing mirrored tables ──
ALTER TABLE characters       ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE characters       ADD COLUMN IF NOT EXISTS is_foundry_orphan BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inventory_items  ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE inventory_items  ADD COLUMN IF NOT EXISTS is_foundry_orphan BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE srd_monsters     ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE lore_entries     ADD COLUMN IF NOT EXISTS foundry_uuid TEXT;
ALTER TABLE lore_entries     ADD COLUMN IF NOT EXISTS is_foundry_orphan BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_foundry_uuid     ON characters(foundry_uuid)      WHERE foundry_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_foundry_uuid      ON inventory_items(foundry_uuid) WHERE foundry_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_srd_monsters_foundry_uuid   ON srd_monsters(foundry_uuid)    WHERE foundry_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lore_entries_foundry_uuid   ON lore_entries(foundry_uuid)    WHERE foundry_uuid IS NOT NULL;

-- ── NPC mirror table (Foundry actors of type "npc") ──
CREATE TABLE IF NOT EXISTS npcs (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    foundry_uuid TEXT,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(100) DEFAULT '',
    status VARCHAR(50) DEFAULT 'alive',
    avatar_url TEXT DEFAULT '',
    ac INT DEFAULT 10,
    hp INT DEFAULT 0,
    speed INT DEFAULT 30,
    description TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_foundry_orphan BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs(campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_npcs_foundry_uuid ON npcs(foundry_uuid) WHERE foundry_uuid IS NOT NULL;

-- ── Map mirror table (Foundry scenes) ──
CREATE TABLE IF NOT EXISTS maps (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    foundry_uuid TEXT,
    name VARCHAR(200) NOT NULL,
    location VARCHAR(200) DEFAULT '',
    image_url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_foundry_orphan BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maps_campaign ON maps(campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_maps_foundry_uuid ON maps(foundry_uuid) WHERE foundry_uuid IS NOT NULL;

-- ── Per-campaign sync state ──
CREATE TABLE IF NOT EXISTS foundry_sync_state (
    campaign_id BIGINT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'never',   -- never | running | ok | error
    last_synced_at TIMESTAMP WITH TIME ZONE,
    counts JSONB NOT NULL DEFAULT '{}',
    error TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS foundry_sync_state;
DROP TABLE IF EXISTS maps;
DROP TABLE IF EXISTS npcs;
DROP INDEX IF EXISTS idx_lore_entries_foundry_uuid;
DROP INDEX IF EXISTS idx_srd_monsters_foundry_uuid;
DROP INDEX IF EXISTS idx_inventory_foundry_uuid;
DROP INDEX IF EXISTS idx_characters_foundry_uuid;
ALTER TABLE lore_entries     DROP COLUMN IF EXISTS is_foundry_orphan;
ALTER TABLE lore_entries     DROP COLUMN IF EXISTS foundry_uuid;
ALTER TABLE srd_monsters     DROP COLUMN IF EXISTS foundry_uuid;
ALTER TABLE inventory_items  DROP COLUMN IF EXISTS is_foundry_orphan;
ALTER TABLE inventory_items  DROP COLUMN IF EXISTS foundry_uuid;
ALTER TABLE characters       DROP COLUMN IF EXISTS is_foundry_orphan;
ALTER TABLE characters       DROP COLUMN IF EXISTS foundry_uuid;
