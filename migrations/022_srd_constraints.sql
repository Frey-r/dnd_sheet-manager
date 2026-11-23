-- +goose Up
-- Data-integrity CHECKs for SRD tables. Added NOT VALID so existing rows (and Foundry sync
-- upserts that may leave zeroes) are never scanned or rejected retroactively; they apply to
-- new/updated rows. Strict enum/format rules (size, type, cr, ability >= 1) are validated in
-- the application layer for homebrew monsters because Foundry-synced rows may not satisfy them.
-- +goose StatementBegin
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_srd_monsters_stats') THEN
        ALTER TABLE srd_monsters ADD CONSTRAINT chk_srd_monsters_stats
            CHECK (ac >= 0 AND hp >= 0 AND xp >= 0 AND str >= 0 AND dex >= 0 AND con >= 0
                   AND "int" >= 0 AND wis >= 0 AND cha >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_srd_equipment_nonneg') THEN
        ALTER TABLE srd_equipment ADD CONSTRAINT chk_srd_equipment_nonneg
            CHECK (weight >= 0 AND cost_gp >= 0) NOT VALID;
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
ALTER TABLE srd_monsters DROP CONSTRAINT IF EXISTS chk_srd_monsters_stats;
ALTER TABLE srd_equipment DROP CONSTRAINT IF EXISTS chk_srd_equipment_nonneg;
