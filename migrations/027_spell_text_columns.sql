-- +goose Up
-- Catalog spells have long casting times ("1 reaction, which you take when you are hit by an
-- attack roll or targeted by the Magic Missile spell"), ranges and durations: VARCHAR(100)
-- made adding them to a character fail with a 500.
ALTER TABLE spells ALTER COLUMN casting_time TYPE TEXT;
ALTER TABLE spells ALTER COLUMN range TYPE TEXT;
ALTER TABLE spells ALTER COLUMN duration TYPE TEXT;
ALTER TABLE spells ALTER COLUMN damage_type TYPE TEXT;

-- +goose Down
ALTER TABLE spells ALTER COLUMN damage_type TYPE VARCHAR(100) USING left(damage_type, 100);
ALTER TABLE spells ALTER COLUMN duration TYPE VARCHAR(100) USING left(duration, 100);
ALTER TABLE spells ALTER COLUMN range TYPE VARCHAR(100) USING left(range, 100);
ALTER TABLE spells ALTER COLUMN casting_time TYPE VARCHAR(100) USING left(casting_time, 100);
