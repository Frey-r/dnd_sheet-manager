-- +goose Up
CREATE TABLE spells (
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

CREATE INDEX idx_spells_character ON spells(character_id);
CREATE INDEX idx_spells_level ON spells(level);

-- +goose Down
DROP TABLE IF EXISTS spells;