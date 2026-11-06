-- +goose Up
-- Dynamic market: shops with their own stock, coins, item values and NPC belongings
-- (openspec/specs/market-bastions.md §2–§5).

ALTER TABLE characters ADD COLUMN IF NOT EXISTS silver INT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS copper INT NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS value_cp BIGINT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS bastion_sale_pct INT NOT NULL DEFAULT 100;

CREATE TABLE shops (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon VARCHAR(60) NOT NULL DEFAULT 'storefront',
    npc_id BIGINT REFERENCES campaign_npcs(id) ON DELETE SET NULL,
    availability VARCHAR(10) NOT NULL DEFAULT 'closed' CHECK (availability IN ('open', 'closed', 'scene')),
    scene_id BIGINT REFERENCES vtt_scenes(id) ON DELETE SET NULL,
    object_id BIGINT REFERENCES vtt_objects(id) ON DELETE SET NULL,
    price_pct INT NOT NULL DEFAULT 100 CHECK (price_pct BETWEEN 1 AND 1000),
    buy_rate_pct INT NOT NULL DEFAULT 50 CHECK (buy_rate_pct BETWEEN 0 AND 100),
    buys_types TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX shops_campaign_idx ON shops(campaign_id);
CREATE UNIQUE INDEX shops_object_idx ON shops(object_id) WHERE object_id IS NOT NULL;

CREATE TABLE shop_items (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'misc',
    rarity VARCHAR(50) NOT NULL DEFAULT 'common',
    price_cp BIGINT NOT NULL DEFAULT 0 CHECK (price_cp >= 0),
    weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    attunement_required BOOLEAN NOT NULL DEFAULT FALSE,
    srd_ref_id BIGINT,
    srd_kind VARCHAR(20),
    stock INT NOT NULL DEFAULT 1 CHECK (stock >= -1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX shop_items_shop_idx ON shop_items(shop_id);

CREATE TABLE npc_items (
    id BIGSERIAL PRIMARY KEY,
    npc_id BIGINT NOT NULL REFERENCES campaign_npcs(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    value_cp BIGINT,
    description TEXT NOT NULL DEFAULT '',
    location VARCHAR(10) NOT NULL DEFAULT 'inventory' CHECK (location IN ('inventory', 'home')),
    source TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX npc_items_npc_idx ON npc_items(npc_id);

-- Haggling: one active offer per character (pending or countered).
CREATE TABLE shop_offers (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qty INT NOT NULL DEFAULT 1 CHECK (qty > 0),
    list_cp BIGINT NOT NULL,
    offered_cp BIGINT NOT NULL CHECK (offered_cp >= 0),
    counter_cp BIGINT,
    message TEXT NOT NULL DEFAULT '',
    skill VARCHAR(40) NOT NULL DEFAULT '',
    roll_total INT,
    roll_detail TEXT NOT NULL DEFAULT '',
    status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'countered', 'accepted', 'rejected', 'withdrawn')),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX shop_offers_campaign_idx ON shop_offers(campaign_id, status);
CREATE UNIQUE INDEX shop_offers_one_active ON shop_offers(character_id) WHERE status IN ('pending', 'countered');

-- The old single list becomes the "Mercado general" shop of each campaign (prices were gp).
INSERT INTO shops (campaign_id, name, description, availability)
SELECT DISTINCT campaign_id, 'Mercado general', 'Mercado de la campaña', 'open' FROM marketplace_items;

INSERT INTO shop_items (shop_id, name, item_type, rarity, price_cp, weight, description, attunement_required, srd_ref_id, srd_kind, stock)
SELECT s.id, m.name, m.item_type, m.rarity, GREATEST(COALESCE(m.price, 0), 0)::BIGINT * 100, COALESCE(m.weight, 0),
       COALESCE(m.description, ''), COALESCE(m.attunement_required, FALSE), m.srd_ref_id,
       CASE WHEN m.srd_ref_id IS NULL THEN NULL ELSE 'equipment' END, GREATEST(m.stock, -1)
FROM marketplace_items m
JOIN shops s ON s.campaign_id = m.campaign_id AND s.name = 'Mercado general';

-- +goose Down
DROP TABLE IF EXISTS shop_offers;
DROP TABLE IF EXISTS npc_items;
DROP TABLE IF EXISTS shop_items;
DROP TABLE IF EXISTS shops;
ALTER TABLE campaigns DROP COLUMN IF EXISTS bastion_sale_pct;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS value_cp;
ALTER TABLE characters DROP COLUMN IF EXISTS copper;
ALTER TABLE characters DROP COLUMN IF EXISTS silver;
