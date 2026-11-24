-- +goose Up
-- Game clock, NPC agenda, NPC HP and purse, equipped NPC items (openspec/specs/npc-agenda.md §7).
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS game_day INT NOT NULL DEFAULT 1 CHECK (game_day >= 1),
    ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(5) NOT NULL DEFAULT 'dia' CHECK (time_of_day IN ('dia', 'tarde', 'noche'));

ALTER TABLE campaign_npcs
    ADD COLUMN IF NOT EXISTS agenda JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS hp_current INT NULL,
    ADD COLUMN IF NOT EXISTS purse_cp BIGINT NOT NULL DEFAULT 0 CHECK (purse_cp >= 0);

ALTER TABLE npc_items
    ADD COLUMN IF NOT EXISTS equipped BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE npc_items DROP COLUMN IF EXISTS equipped;
ALTER TABLE campaign_npcs
    DROP COLUMN IF EXISTS purse_cp,
    DROP COLUMN IF EXISTS hp_current,
    DROP COLUMN IF EXISTS agenda;
ALTER TABLE campaigns
    DROP COLUMN IF EXISTS time_of_day,
    DROP COLUMN IF EXISTS game_day;
