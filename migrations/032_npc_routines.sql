-- +goose Up
-- Campaign NPCs on maps, token disposition and NPC routes (openspec/specs/vtt-npc-routines.md §8).
ALTER TABLE vtt_tokens
    ADD COLUMN IF NOT EXISTS npc_id BIGINT NULL REFERENCES campaign_npcs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS disposition VARCHAR(10) NOT NULL DEFAULT 'neutral' CHECK (disposition IN ('hostile', 'neutral', 'friendly')),
    ADD COLUMN IF NOT EXISTS route JSONB NULL,
    ADD COLUMN IF NOT EXISTS route_paused BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS route_elapsed_ms BIGINT NOT NULL DEFAULT 0 CHECK (route_elapsed_ms >= 0),
    ADD COLUMN IF NOT EXISTS route_started_at TIMESTAMPTZ NULL;

-- Keep today's behaviour: monsters and detecting NPC tokens were the ones that started encounters.
UPDATE vtt_tokens SET disposition = 'hostile' WHERE kind = 'monster' OR (kind = 'npc' AND detects);
UPDATE vtt_tokens SET disposition = 'friendly' WHERE kind = 'pc';

-- The route ticker asks once per second which scenes have a running route.
CREATE INDEX IF NOT EXISTS vtt_tokens_route_running_idx ON vtt_tokens(scene_id) WHERE route_started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS vtt_tokens_npc_idx ON vtt_tokens(npc_id) WHERE npc_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS vtt_tokens_npc_idx;
DROP INDEX IF EXISTS vtt_tokens_route_running_idx;
ALTER TABLE vtt_tokens
    DROP COLUMN IF EXISTS route_started_at,
    DROP COLUMN IF EXISTS route_elapsed_ms,
    DROP COLUMN IF EXISTS route_paused,
    DROP COLUMN IF EXISTS route,
    DROP COLUMN IF EXISTS disposition,
    DROP COLUMN IF EXISTS npc_id;
