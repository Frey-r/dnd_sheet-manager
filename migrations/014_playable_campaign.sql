-- +goose Up
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
ALTER TABLE marketplace_items ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

CREATE TABLE campaign_npcs (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(200) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'neutral',
    description TEXT NOT NULL DEFAULT '',
    stats JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campaign_npcs_campaign_idx ON campaign_npcs(campaign_id);

CREATE TABLE campaign_maps (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    location VARCHAR(200) NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    pins JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campaign_maps_campaign_idx ON campaign_maps(campaign_id);

CREATE TABLE campaign_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    event_date DATE NOT NULL,
    event_time VARCHAR(20) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campaign_events_campaign_date_idx ON campaign_events(campaign_id, event_date);

CREATE TABLE campaign_notes (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campaign_notes_campaign_idx ON campaign_notes(campaign_id);

CREATE TABLE campaign_bot_settings (
    campaign_id BIGINT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    personality TEXT NOT NULL DEFAULT '',
    actions JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE combatants (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id BIGINT REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    initiative INT NOT NULL DEFAULT 0,
    hp INT NOT NULL DEFAULT 1,
    max_hp INT NOT NULL DEFAULT 1,
    is_player BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX combatants_character_unique ON combatants(character_id) WHERE character_id IS NOT NULL;
CREATE INDEX combatants_campaign_idx ON combatants(campaign_id);

CREATE TABLE combat_log (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX combat_log_campaign_idx ON combat_log(campaign_id, id);

-- game_events already exists since 007; adapt it to the realtime event log (actor + created_at).
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE game_events ALTER COLUMN event_type TYPE VARCHAR(100);
UPDATE game_events SET payload = '{}' WHERE payload IS NULL;
ALTER TABLE game_events ALTER COLUMN payload SET NOT NULL;
CREATE INDEX IF NOT EXISTS game_events_campaign_idx ON game_events(campaign_id, id);

-- +goose Down
DROP INDEX IF EXISTS game_events_campaign_idx;
ALTER TABLE game_events DROP COLUMN IF EXISTS created_at;
ALTER TABLE game_events DROP COLUMN IF EXISTS actor_id;
DROP TABLE IF EXISTS combat_log;
DROP TABLE IF EXISTS combatants;
DROP TABLE IF EXISTS campaign_bot_settings;
DROP TABLE IF EXISTS campaign_notes;
DROP TABLE IF EXISTS campaign_events;
DROP TABLE IF EXISTS campaign_maps;
DROP TABLE IF EXISTS campaign_npcs;
ALTER TABLE users DROP COLUMN IF EXISTS preferences;
ALTER TABLE marketplace_items DROP COLUMN IF EXISTS stock;
ALTER TABLE campaigns DROP COLUMN IF EXISTS settings;
ALTER TABLE campaigns DROP COLUMN IF EXISTS game_mode;
