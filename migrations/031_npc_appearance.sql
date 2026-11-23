-- +goose Up
-- NPC race, class and pixel-art appearance (character-appearance.md § NPC creator, D-0041).
-- Race and class default to '' and appearance is nullable, so the NPCs created before keep working.
-- The appearance is validated by service.ValidateAppearance before it reaches the column.
ALTER TABLE campaign_npcs
    ADD COLUMN IF NOT EXISTS race TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS class TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS appearance JSONB NULL;

-- +goose Down
ALTER TABLE campaign_npcs
    DROP COLUMN IF EXISTS appearance,
    DROP COLUMN IF EXISTS class,
    DROP COLUMN IF EXISTS race;
