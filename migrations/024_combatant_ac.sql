-- +goose Up
-- Server-resolved encounter stats: AC and the SRD monster a combatant was built from.
ALTER TABLE combatants ADD COLUMN IF NOT EXISTS ac INT;
ALTER TABLE combatants ADD COLUMN IF NOT EXISTS srd_monster_id BIGINT REFERENCES srd_monsters(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE combatants DROP COLUMN IF EXISTS srd_monster_id;
ALTER TABLE combatants DROP COLUMN IF EXISTS ac;
