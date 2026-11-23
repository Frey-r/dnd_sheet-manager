-- +goose Up
-- Ability score rolls made by the server (characters.md, "Character Creation").
CREATE TABLE stat_rolls (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dice JSONB NOT NULL,          -- [[d,d,d,d] × 6]
    totals INT[] NOT NULL,        -- best three of each set
    status VARCHAR(10) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'discarded')),
    character_id BIGINT REFERENCES characters(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX stat_rolls_campaign_idx ON stat_rolls(campaign_id, user_id);
CREATE UNIQUE INDEX stat_rolls_one_available ON stat_rolls(campaign_id, user_id) WHERE status = 'available';

-- +goose Down
DROP TABLE IF EXISTS stat_rolls;
