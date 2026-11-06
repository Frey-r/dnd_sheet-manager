-- +goose Up
-- Scene modes, exploration objects, milestones and local combats (openspec/specs/vtt-modes.md).
ALTER TABLE vtt_scenes ADD COLUMN IF NOT EXISTS mode VARCHAR(12) NOT NULL DEFAULT 'exploration' CHECK (mode IN ('narrative', 'exploration', 'combat'));
ALTER TABLE vtt_scenes ADD COLUMN IF NOT EXISTS exploration_pace DOUBLE PRECISION NOT NULL DEFAULT 2 CHECK (exploration_pace BETWEEN 1 AND 4);
ALTER TABLE vtt_scenes ADD COLUMN IF NOT EXISTS zones JSONB NOT NULL DEFAULT '[]';

ALTER TABLE vtt_tokens ADD COLUMN IF NOT EXISTS speed_ft INT NOT NULL DEFAULT 30 CHECK (speed_ft >= 0);
ALTER TABLE vtt_tokens ADD COLUMN IF NOT EXISTS passive_perception INT NOT NULL DEFAULT 10;
ALTER TABLE vtt_tokens ADD COLUMN IF NOT EXISTS stealth_bonus INT NOT NULL DEFAULT 0;
ALTER TABLE vtt_tokens ADD COLUMN IF NOT EXISTS dex_mod INT NOT NULL DEFAULT 0;
ALTER TABLE vtt_tokens ADD COLUMN IF NOT EXISTS sneaking BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vtt_tokens ADD COLUMN IF NOT EXISTS detects BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE campaign_milestones (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    achieved BOOLEAN NOT NULL DEFAULT FALSE,
    achieved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campaign_milestones_campaign_idx ON campaign_milestones(campaign_id);

CREATE TABLE vtt_objects (
    id BIGSERIAL PRIMARY KEY,
    scene_id BIGINT NOT NULL REFERENCES vtt_scenes(id) ON DELETE CASCADE,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    icon VARCHAR(40) NOT NULL DEFAULT 'inventory_2',
    x DOUBLE PRECISION NOT NULL DEFAULT 0,
    y DOUBLE PRECISION NOT NULL DEFAULT 0,
    discover_dc INT NOT NULL DEFAULT 0,
    requirements JSONB NOT NULL DEFAULT '{}',
    loot_kind VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (loot_kind IN ('fixed', 'table')),
    loot JSONB NOT NULL DEFAULT '{}',
    per_character BOOLEAN NOT NULL DEFAULT FALSE,
    depleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX vtt_objects_scene_idx ON vtt_objects(scene_id);

CREATE TABLE vtt_object_attempts (
    object_id BIGINT NOT NULL REFERENCES vtt_objects(id) ON DELETE CASCADE,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    success BOOLEAN NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (object_id, character_id)
);

CREATE TABLE vtt_combats (
    id BIGSERIAL PRIMARY KEY,
    scene_id BIGINT NOT NULL REFERENCES vtt_scenes(id) ON DELETE CASCADE,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    round INT NOT NULL DEFAULT 1,
    turn_index INT NOT NULL DEFAULT 0,
    turn_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    turn_seconds INT NOT NULL DEFAULT 30,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    remaining_ms INT NOT NULL DEFAULT 30000,
    center_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    center_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX vtt_combats_scene_idx ON vtt_combats(scene_id) WHERE status = 'active';

CREATE TABLE vtt_combatants (
    id BIGSERIAL PRIMARY KEY,
    combat_id BIGINT NOT NULL REFERENCES vtt_combats(id) ON DELETE CASCADE,
    token_id BIGINT NOT NULL REFERENCES vtt_tokens(id) ON DELETE CASCADE,
    initiative INT NOT NULL DEFAULT 0,
    is_player BOOLEAN NOT NULL DEFAULT FALSE,
    movement_used_ft INT NOT NULL DEFAULT 0,
    dashed BOOLEAN NOT NULL DEFAULT FALSE,
    pending BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (combat_id, token_id)
);

-- +goose Down
DROP TABLE IF EXISTS vtt_combatants;
DROP TABLE IF EXISTS vtt_combats;
DROP TABLE IF EXISTS vtt_object_attempts;
DROP TABLE IF EXISTS vtt_objects;
DROP TABLE IF EXISTS campaign_milestones;
ALTER TABLE vtt_tokens DROP COLUMN IF EXISTS detects, DROP COLUMN IF EXISTS sneaking, DROP COLUMN IF EXISTS dex_mod,
  DROP COLUMN IF EXISTS stealth_bonus, DROP COLUMN IF EXISTS passive_perception, DROP COLUMN IF EXISTS speed_ft;
ALTER TABLE vtt_scenes DROP COLUMN IF EXISTS zones, DROP COLUMN IF EXISTS exploration_pace, DROP COLUMN IF EXISTS mode;
