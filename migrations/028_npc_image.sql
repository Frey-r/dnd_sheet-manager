-- +goose Up
-- NPC portrait: uploaded through POST /api/campaigns/:id/uploads or pasted as a URL.
ALTER TABLE campaign_npcs ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE campaign_npcs DROP COLUMN IF EXISTS image_url;
