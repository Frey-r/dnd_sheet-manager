-- +goose Up
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'player';
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('admin', 'dm', 'player'));

-- Set the first user as admin (change as needed)
-- UPDATE users SET role = 'admin' WHERE id = 1;

-- +goose Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users DROP COLUMN IF EXISTS role;
