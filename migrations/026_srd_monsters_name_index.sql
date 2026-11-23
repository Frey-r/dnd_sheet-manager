-- +goose Up
-- Supports the case-insensitive name lookups used to hide legacy duplicates of catalog
-- monsters (notShadowedLegacySQL) and the exact-name search ranking.
CREATE INDEX IF NOT EXISTS idx_srd_monsters_lower_name ON srd_monsters (LOWER(name));

-- +goose Down
DROP INDEX IF EXISTS idx_srd_monsters_lower_name;
