-- +goose Up
CREATE TABLE trade_offers (
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

CREATE INDEX idx_trade_offers_campaign ON trade_offers(campaign_id);
CREATE INDEX idx_trade_offers_status ON trade_offers(status);
CREATE INDEX idx_trade_offers_expires ON trade_offers(expires_at) WHERE status = 'pending';

-- +goose Down
DROP TABLE IF EXISTS trade_offers;