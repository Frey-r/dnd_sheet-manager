-- +goose Up
-- Native virtual tabletop (openspec/specs/vtt.md).
CREATE TABLE vtt_scenes (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    map_url TEXT NOT NULL DEFAULT '',
    width_px INT NOT NULL DEFAULT 1400,
    height_px INT NOT NULL DEFAULT 1000,
    grid_size_px INT NOT NULL DEFAULT 70 CHECK (grid_size_px BETWEEN 10 AND 400),
    grid_offset_x INT NOT NULL DEFAULT 0,
    grid_offset_y INT NOT NULL DEFAULT 0,
    feet_per_cell INT NOT NULL DEFAULT 5 CHECK (feet_per_cell > 0),
    ambient_light VARCHAR(10) NOT NULL DEFAULT 'bright' CHECK (ambient_light IN ('bright', 'dim', 'dark')),
    fog_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    walls JSONB NOT NULL DEFAULT '[]',
    lights JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX vtt_scenes_campaign_idx ON vtt_scenes(campaign_id);
CREATE UNIQUE INDEX vtt_scenes_one_active ON vtt_scenes(campaign_id) WHERE is_active;

CREATE TABLE vtt_tokens (
    id BIGSERIAL PRIMARY KEY,
    scene_id BIGINT NOT NULL REFERENCES vtt_scenes(id) ON DELETE CASCADE,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    kind VARCHAR(10) NOT NULL DEFAULT 'monster' CHECK (kind IN ('pc', 'npc', 'monster')),
    character_id BIGINT REFERENCES characters(id) ON DELETE SET NULL,
    owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL DEFAULT '',
    color VARCHAR(20) NOT NULL DEFAULT '#c0392b',
    x DOUBLE PRECISION NOT NULL DEFAULT 0,
    y DOUBLE PRECISION NOT NULL DEFAULT 0,
    size_cells DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (size_cells > 0),
    hp INT NOT NULL DEFAULT 0,
    max_hp INT NOT NULL DEFAULT 0,
    ac INT NOT NULL DEFAULT 10,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    vision_ft INT NOT NULL DEFAULT 0 CHECK (vision_ft >= 0),
    darkvision_ft INT NOT NULL DEFAULT 0 CHECK (darkvision_ft >= 0),
    blindsight_ft INT NOT NULL DEFAULT 0 CHECK (blindsight_ft >= 0),
    light_bright_ft INT NOT NULL DEFAULT 0 CHECK (light_bright_ft >= 0),
    light_dim_ft INT NOT NULL DEFAULT 0 CHECK (light_dim_ft >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX vtt_tokens_scene_idx ON vtt_tokens(scene_id);
CREATE INDEX vtt_tokens_campaign_idx ON vtt_tokens(campaign_id);

-- +goose Down
DROP TABLE IF EXISTS vtt_tokens;
DROP TABLE IF EXISTS vtt_scenes;
