-- +goose Up
-- Fixed skill proficiencies granted by a race (5etools `skillProficiencies`, e.g. PHB Elf
-- "Keen Senses" -> ["perception"]). Choices ({"choose": ...}, {"any": n}) are not stored.
ALTER TABLE srd_races ADD COLUMN IF NOT EXISTS skill_proficiencies JSONB NOT NULL DEFAULT '[]';

-- Backfill from the content catalog so existing installs do not need a re-import.
UPDATE srd_races r
SET skill_proficiencies = COALESCE((
    SELECT jsonb_agg(k.key ORDER BY k.key)
    FROM jsonb_each(e.data->'skillProficiencies'->0) AS k
    WHERE k.value = 'true'::jsonb
), '[]'::jsonb)
FROM content_entities e
WHERE e.id = r.content_entity_id
  AND jsonb_typeof(e.data->'skillProficiencies'->0) = 'object';

-- +goose Down
ALTER TABLE srd_races DROP COLUMN IF EXISTS skill_proficiencies;
