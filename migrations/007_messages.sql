-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgvector;

CREATE TABLE lore_entries (
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

CREATE INDEX idx_lore_entries_campaign ON lore_entries(campaign_id);
CREATE INDEX idx_lore_entries_character ON lore_entries(character_id) WHERE character_id IS NOT NULL;
CREATE INDEX idx_lore_entries_tier ON lore_entries(lore_tier);
CREATE INDEX idx_lore_entries_vector ON lore_entries USING ivfflat (content_vector vector_cosine_ops) WITH (lists = 100);

CREATE TABLE messages (
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

CREATE INDEX idx_messages_campaign ON messages(campaign_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX idx_messages_sender ON messages(sender_user_id);
CREATE INDEX idx_messages_unread ON messages(recipient_user_id, is_read) WHERE is_read = FALSE;

CREATE TABLE game_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id BIGINT REFERENCES characters(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_game_events_campaign ON game_events(campaign_id);
CREATE INDEX idx_game_events_timestamp ON game_events(timestamp DESC);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    campaign_id BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_campaign ON audit_logs(campaign_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS game_events;
DROP TABLE IF EXISTS messages;
DROP INDEX IF EXISTS idx_lore_entries_vector;
DROP TABLE IF EXISTS lore_entries;
DROP EXTENSION IF EXISTS pgvector;