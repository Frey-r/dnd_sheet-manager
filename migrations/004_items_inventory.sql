-- +goose Up
CREATE TABLE inventory_items (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'misc',
    rarity VARCHAR(50) NOT NULL DEFAULT 'common',
    weight DECIMAL(10,2) DEFAULT 0,
    quantity INT DEFAULT 1,
    description TEXT DEFAULT '',
    is_equipped BOOLEAN DEFAULT FALSE,
    slot_type VARCHAR(50) DEFAULT '',
    requires_attunement BOOLEAN DEFAULT FALSE,
    is_attuned BOOLEAN DEFAULT FALSE,
    is_tradeable BOOLEAN DEFAULT TRUE,
    quest_bound BOOLEAN DEFAULT FALSE,
    trade_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE marketplace_items (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'misc',
    rarity VARCHAR(50) NOT NULL DEFAULT 'common',
    price INT DEFAULT 0,
    weight DECIMAL(10,2) DEFAULT 0,
    description TEXT DEFAULT '',
    attunement_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_character ON inventory_items(character_id);
CREATE INDEX idx_marketplace_campaign ON marketplace_items(campaign_id);

-- +goose Down
DROP TABLE IF EXISTS marketplace_items;
DROP TABLE IF EXISTS inventory_items;