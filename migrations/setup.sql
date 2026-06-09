-- D&D Campaign Manager - Database Setup
-- Run this against your PostgreSQL database: dndmanager

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 001_users
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 002_campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    join_code VARCHAR(20) NOT NULL UNIQUE,
    gm_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS campaign_members (
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'player',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (campaign_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_campaigns_gm_user ON campaigns(gm_user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_join_code ON campaigns(join_code);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);

-- 003_characters
CREATE TABLE IF NOT EXISTS characters (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    race VARCHAR(50) DEFAULT '',
    class VARCHAR(50) DEFAULT '',
    level INT DEFAULT 1,
    background VARCHAR(100) DEFAULT '',
    alignment VARCHAR(50) DEFAULT '',
    str_score INT DEFAULT 10,
    dex_score INT DEFAULT 10,
    con_score INT DEFAULT 10,
    int_score INT DEFAULT 10,
    wis_score INT DEFAULT 10,
    cha_score INT DEFAULT 10,
    max_hp INT DEFAULT 10,
    current_hp INT DEFAULT 10,
    temp_hp INT DEFAULT 0,
    ac INT DEFAULT 10,
    speed INT DEFAULT 30,
    initiative_bonus INT DEFAULT 0,
    proficiency_bonus INT DEFAULT 2,
    inspiration BOOLEAN DEFAULT FALSE,
    passive_perception INT DEFAULT 10,
    death_save_successes INT DEFAULT 0,
    death_save_failures INT DEFAULT 0,
    xp INT DEFAULT 0,
    gold INT DEFAULT 0,
    carrying_capacity INT DEFAULT 0,
    personality_traits TEXT DEFAULT '',
    ideals TEXT DEFAULT '',
    bonds TEXT DEFAULT '',
    flaws TEXT DEFAULT '',
    physical_description TEXT DEFAULT '{}',
    backstory_text TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    spellcasting_ability VARCHAR(10) DEFAULT 'INT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS character_features (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    type VARCHAR(50) NOT NULL DEFAULT 'class',
    uses_per_rest INT DEFAULT 0,
    rest_type VARCHAR(20) DEFAULT ''
);
CREATE TABLE IF NOT EXISTS spell_slots (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    level INT NOT NULL CHECK (level BETWEEN 1 AND 9),
    total INT NOT NULL DEFAULT 0,
    used INT NOT NULL DEFAULT 0,
    UNIQUE(character_id, level)
);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_character_features_character ON character_features(character_id);
CREATE INDEX IF NOT EXISTS idx_spell_slots_character ON spell_slots(character_id);

-- 004_items_inventory
CREATE TABLE IF NOT EXISTS inventory_items (
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
CREATE TABLE IF NOT EXISTS marketplace_items (
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
CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory_items(character_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_campaign ON marketplace_items(campaign_id);

-- 005_spells
CREATE TABLE IF NOT EXISTS spells (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    level INT NOT NULL CHECK (level BETWEEN 0 AND 9),
    school VARCHAR(50) DEFAULT '',
    casting_time VARCHAR(100) DEFAULT '',
    range VARCHAR(100) DEFAULT '',
    duration VARCHAR(100) DEFAULT '',
    description TEXT DEFAULT '',
    components TEXT DEFAULT '[]',
    damage_type VARCHAR(100) DEFAULT '',
    prepared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spells_character ON spells(character_id);
CREATE INDEX IF NOT EXISTS idx_spells_level ON spells(level);

-- 006_trades
CREATE TABLE IF NOT EXISTS trade_offers (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    offeror_character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    recipient_character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    offered_item_ids TEXT DEFAULT '[]',
    offered_gold INT DEFAULT 0,
    requested_item_ids TEXT DEFAULT '[]',
    requested_gold INT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trade_offers_campaign ON trade_offers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offers_expires ON trade_offers(expires_at) WHERE status = 'pending';

-- 007_messages + lore + events + audit
CREATE TABLE IF NOT EXISTS lore_entries (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id BIGINT REFERENCES characters(id) ON DELETE CASCADE,
    content_text TEXT NOT NULL,
    content_vector VECTOR(768),
    lore_tier VARCHAR(50) NOT NULL DEFAULT 'campaign_plot',
    chapter_order INT DEFAULT 0,
    title VARCHAR(200) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lore_entries_campaign ON lore_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lore_entries_character ON lore_entries(character_id) WHERE character_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lore_entries_tier ON lore_entries(lore_tier);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'player_direct',
    subject VARCHAR(200) DEFAULT '',
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_user_id, is_read) WHERE is_read = FALSE;

CREATE TABLE IF NOT EXISTS game_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id BIGINT REFERENCES characters(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_events_campaign ON game_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_events_timestamp ON game_events(timestamp DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    campaign_id BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_campaign ON audit_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
