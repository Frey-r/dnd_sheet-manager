-- +goose Up
-- Pixel-art avatar (openspec/specs/character-appearance.md).
ALTER TABLE characters ADD COLUMN IF NOT EXISTS appearance JSONB;
-- Catalogue race names carry their source and can exceed 50 characters.
ALTER TABLE characters ALTER COLUMN race TYPE TEXT;

-- +goose Down
ALTER TABLE characters DROP COLUMN IF EXISTS appearance;
