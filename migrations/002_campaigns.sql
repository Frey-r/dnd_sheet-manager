-- +goose Up
CREATE TABLE campaigns (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    join_code VARCHAR(20) NOT NULL UNIQUE,
    gm_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE campaign_members (
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'player',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (campaign_id, user_id)
);

CREATE INDEX idx_campaigns_gm_user ON campaigns(gm_user_id);
CREATE INDEX idx_campaigns_join_code ON campaigns(join_code);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);

-- +goose Down
DROP TABLE IF EXISTS campaign_members;
DROP TABLE IF EXISTS campaigns;