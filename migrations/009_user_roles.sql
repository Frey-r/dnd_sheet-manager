-- +goose Up
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'player';
-- +goose StatementBegin
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('admin', 'dm', 'player'));
    END IF;
END $$;
-- +goose StatementEnd

-- Set the first user as admin (change as needed)
-- UPDATE users SET role = 'admin' WHERE id = 1;

-- +goose Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users DROP COLUMN IF EXISTS role;
