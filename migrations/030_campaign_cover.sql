-- +goose Up
-- Campaign cover image (frontend-screens.md: campaign list cards and the campaign creator).
-- Uploaded through POST /api/campaigns/:id/uploads or pasted as a URL.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE campaigns DROP COLUMN IF EXISTS cover_url;
