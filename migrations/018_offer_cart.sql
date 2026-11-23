-- +goose Up
-- Haggling over a shopping cart: an offer has several lines (market-bastions.md §3).
CREATE TABLE shop_offer_lines (
    id BIGSERIAL PRIMARY KEY,
    offer_id BIGINT NOT NULL REFERENCES shop_offers(id) ON DELETE CASCADE,
    item_id BIGINT REFERENCES shop_items(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    qty INT NOT NULL CHECK (qty > 0),
    unit_list_cp BIGINT NOT NULL CHECK (unit_list_cp >= 0)
);
CREATE INDEX shop_offer_lines_offer_idx ON shop_offer_lines(offer_id);

INSERT INTO shop_offer_lines (offer_id, item_id, name, qty, unit_list_cp)
SELECT o.id, o.item_id, i.name, o.qty, o.list_cp / GREATEST(o.qty, 1)
FROM shop_offers o JOIN shop_items i ON i.id = o.item_id;

ALTER TABLE shop_offers ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE shop_offers ADD COLUMN IF NOT EXISTS agreed_cp BIGINT;

-- +goose Down
ALTER TABLE shop_offers DROP COLUMN IF EXISTS agreed_cp;
DROP TABLE IF EXISTS shop_offer_lines;
