-- +goose Up
CREATE TABLE characters (
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

CREATE TABLE character_features (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    type VARCHAR(50) NOT NULL DEFAULT 'class',
    uses_per_rest INT DEFAULT 0,
    rest_type VARCHAR(20) DEFAULT ''
);

CREATE TABLE spell_slots (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    level INT NOT NULL CHECK (level BETWEEN 1 AND 9),
    total INT NOT NULL DEFAULT 0,
    used INT NOT NULL DEFAULT 0,
    UNIQUE(character_id, level)
);

CREATE INDEX idx_characters_user ON characters(user_id);
CREATE INDEX idx_characters_campaign ON characters(campaign_id);
CREATE INDEX idx_character_features_character ON character_features(character_id);
CREATE INDEX idx_spell_slots_character ON spell_slots(character_id);

-- +goose Down
DROP TABLE IF EXISTS spell_slots;
DROP TABLE IF EXISTS character_features;
DROP TABLE IF EXISTS characters;