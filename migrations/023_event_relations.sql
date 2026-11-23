-- +goose Up
-- Real columns for the NPCs / locations related to a calendar event. Until now the frontend
-- appended them to `description` as a trailing "\n\n[[meta]]{json}" block.
ALTER TABLE campaign_events
    ADD COLUMN IF NOT EXISTS related_npcs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS related_locations JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Move any description-embedded block into the new columns (best effort: rows whose block
-- is not valid JSON are left untouched).
-- +goose StatementBegin
DO $$
DECLARE
    r RECORD;
    mark CONSTANT TEXT := E'\n\n[[meta]]';
    pos INT;
    meta JSONB;
    npcs JSONB;
    locs JSONB;
BEGIN
    FOR r IN SELECT id, description FROM campaign_events WHERE strpos(description, E'\n\n[[meta]]') > 0 LOOP
        BEGIN
            pos := strpos(r.description, mark);
            meta := substr(r.description, pos + length(mark))::jsonb;
            IF jsonb_typeof(meta) <> 'object' THEN
                CONTINUE;
            END IF;
            SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO npcs
              FROM jsonb_array_elements(CASE WHEN jsonb_typeof(meta->'npcs') = 'array' THEN meta->'npcs' ELSE '[]'::jsonb END) e
             WHERE jsonb_typeof(e) = 'string';
            SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO locs
              FROM jsonb_array_elements(CASE WHEN jsonb_typeof(meta->'locations') = 'array' THEN meta->'locations' ELSE '[]'::jsonb END) e
             WHERE jsonb_typeof(e) = 'string';
            UPDATE campaign_events
               SET related_npcs = npcs, related_locations = locs, description = left(r.description, pos - 1)
             WHERE id = r.id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END
$$;
-- +goose StatementEnd

-- +goose Down
ALTER TABLE campaign_events
    DROP COLUMN IF EXISTS related_locations,
    DROP COLUMN IF EXISTS related_npcs;
