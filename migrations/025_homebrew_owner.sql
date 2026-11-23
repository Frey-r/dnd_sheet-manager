-- +goose Up
-- Homebrew monsters belong to whoever created them: only the creator (or an admin)
-- may edit or delete one. Existing homebrew rows keep created_by NULL (admin-only).
ALTER TABLE srd_monsters ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE srd_monsters DROP COLUMN IF EXISTS created_by;
