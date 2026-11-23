# SRD Reference Data — Ground-Truth D&D 5e

> **Status (2026-11-21): source superseded by the expanded content catalog.** This is a
> personal project, so rules content is NOT limited to the SRD. The source of truth is the
> full local 5etools data set imported by `cmd/content-import` into `content_entities`
> (all books, `source` = 5etools book code). The import also **projects** every monster,
> spell, item, class (incl. its spell-slot table), race, subclass, condition and rule into
> the `srd_*` tables below, which therefore act as the typed *rules index* of the whole
> catalog — the `srd_` prefix is historical. Consequences:
> - `is_srd` is informational only (marks SRD membership); features MUST NOT filter or gate
>   content on it.
> - Counts in the table below are the original SRD seed; a full 5etools v2.30 import holds
>   ~4.5k monsters, ~940 spells, ~2.4k items, 160 races and all classes.
> - Homebrew creatures are rows with `created_by` set (source `Homebrew`), editable only by
>   their creator or an admin; imported rows (`created_by` NULL) are read-only.
> - The attribution and CC-BY requirements below apply only if SRD-only data is shipped.

## Data Source & Attribution

- Data sourced from [5e-bits/5e-database](https://github.com/5e-bits/5e-database) via [dnd-oracle](https://github.com/gregario/dnd-oracle).
- This product includes material from the System Reference Document 5.1, Copyright 2016, Wizards of the Coast, Inc. Licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

## SRD Entity Coverage

| Entity       | Count | Table Name       |
|--------------|-------|------------------|
| Monsters     | 334   | `srd_monsters`   |
| Spells       | 319   | `srd_spells`     |
| Equipment    | 237   | `srd_equipment`  |
| Magic Items  | 239   | `srd_magic_items`|
| Classes      | 12    | `srd_classes`    |
| Races        | 9     | `srd_races`      |
| Conditions   | 15    | `srd_conditions` |
| Rule Sections| 33    | `srd_rules`      |

## Data Governance

### Immutability
- SRD reference tables **MUST** be treated as read-only by application code.
- Only the import script **SHALL** write to SRD tables.
- All SRD rows **MUST** carry `is_srd = TRUE`.
- The GM **MAY** create custom entries (homebrew) in the same tables with `is_srd = FALSE`.

### Referential Linking
- Campaign entities (character spells, inventory items) **MAY** reference SRD entries via `srd_ref_id`.
- Deletion of an SRD reference **MUST NOT** cascade to campaign entities.
- When an SRD reference is present, the UI **SHOULD** display the official SRD data alongside any campaign-specific overrides.

---

## Monster Schema

### Required Fields
- `name` **MUST** be unique among SRD entries.
- `size` **MUST** be one of: `Tiny`, `Small`, `Medium`, `Large`, `Huge`, `Gargantuan`.
- `type` **MUST** follow SRD categories: `aberration`, `beast`, `celestial`, `construct`, `dragon`, `elemental`, `fey`, `fiend`, `giant`, `humanoid`, `monstrosity`, `ooze`, `plant`, `undead`.
- `cr` **MUST** be a valid Challenge Rating string: `0`, `1/8`, `1/4`, `1/2`, `1`–`30`.
- `xp` **SHALL** match the standard CR-to-XP mapping.

### Ability Scores
- All six ability scores (STR, DEX, CON, INT, WIS, CHA) **MUST** be integers ≥ 1.
- `proficiency_bonus` **SHALL** be derived from CR per SRD rules.

### JSON Fields
- `speed`, `traits`, `actions`, `legendary_actions`, `reactions`, `saving_throws`, `skills` **SHALL** be stored as JSON text.
- The application layer **MUST** safely parse these fields, returning `null` on parse failure.

### Scenarios

```gherkin
GIVEN a user searches monsters with query "dragon"
WHEN the backend executes Full-Text Search on srd_monsters
THEN results SHALL include all monsters whose name or type matches "dragon"
AND results SHALL be ordered by relevance score descending
AND each result SHALL include: name, size, type, cr, xp, hp, ac
```

```gherkin
GIVEN a user filters monsters by cr_min=5 and cr_max=10
WHEN the filter is applied
THEN only monsters with numeric CR between 5.0 and 10.0 inclusive SHALL be returned
AND fractional CRs (1/8, 1/4, 1/2) SHALL be converted to their numeric equivalents
```

```gherkin
GIVEN a user requests monster detail by ID
WHEN the backend retrieves the monster
THEN the response SHALL include all fields: stats, abilities, actions, traits, legendary actions
AND JSON fields SHALL be parsed and returned as structured objects
```

---

## Spell Schema

### Required Fields
- `name` **MUST** be unique among SRD spells.
- `level` **MUST** be between 0 (cantrip) and 9.
- `school` **MUST** be one of: `Abjuration`, `Conjuration`, `Divination`, `Enchantment`, `Evocation`, `Illusion`, `Necromancy`, `Transmutation`.
- `concentration` and `ritual` **SHALL** be boolean flags.

### Component Tracking
- `components_v` (Verbal), `components_s` (Somatic), `components_m` (Material) **SHALL** be boolean.
- `material_desc` **SHALL** describe the material component text when `components_m = TRUE`.

### Class Association
- `classes` **SHALL** be a JSON array of class names that can learn this spell.

### Scenarios

```gherkin
GIVEN a player searches spells with level=3 and class="Wizard"
WHEN the backend filters srd_spells
THEN only level-3 spells available to the Wizard class SHALL be returned
AND results SHALL include: name, school, casting_time, range, concentration flag
```

```gherkin
GIVEN a player adds an SRD spell to their character
WHEN the spell is selected from the SRD browser
THEN the system SHALL copy name, level, school, casting_time, range, duration, description
AND the character's spell entry SHALL store srd_ref_id pointing to the SRD spell
AND future SRD updates SHALL NOT retroactively modify the character's copy
```

---

## Equipment Schema

### Categories
- Equipment **SHALL** be categorized as: `Weapon`, `Armor`, `Shield`, `Adventuring Gear`, `Tool`, `Mount`, `Vehicle`.
- Weapons **SHALL** include: `damage_dice`, `damage_type`, `weapon_category` (Simple/Martial), `weapon_range` (Melee/Ranged), `properties` (JSON array: Finesse, Light, Heavy, etc.).
- Armor **SHALL** include: `ac_base`, `ac_dex_bonus` (boolean), `ac_max_bonus`, `str_minimum`, `stealth_disadvantage`, `armor_category` (Light/Medium/Heavy).

### Scenarios

```gherkin
GIVEN the GM populates the campaign marketplace from SRD equipment
WHEN the GM selects items from the SRD browser
THEN each selected item SHALL be cloned into the marketplace_items table with correct price
AND the marketplace item SHALL retain srd_ref_id for traceability
```

---

## CR-to-XP Reference Table

The following table **MUST** be implemented as a constant lookup:

| CR   | XP      | Prof. Bonus |
|------|---------|-------------|
| 0    | 10      | +2          |
| 1/8  | 25      | +2          |
| 1/4  | 50      | +2          |
| 1/2  | 100     | +2          |
| 1    | 200     | +2          |
| 2    | 450     | +2          |
| 3    | 700     | +2          |
| 4    | 1,100   | +2          |
| 5    | 1,800   | +3          |
| 6    | 2,300   | +3          |
| 7    | 2,900   | +3          |
| 8    | 3,900   | +3          |
| 9    | 5,000   | +4          |
| 10   | 5,900   | +4          |
| 11   | 7,200   | +4          |
| 12   | 8,400   | +4          |
| 13   | 10,000  | +5          |
| 14   | 11,500  | +5          |
| 15   | 13,000  | +5          |
| 16   | 15,000  | +5          |
| 17   | 18,000  | +6          |
| 18   | 20,000  | +6          |
| 19   | 22,000  | +6          |
| 20   | 25,000  | +6          |
| 21   | 33,000  | +7          |
| 22   | 41,000  | +7          |
| 23   | 50,000  | +7          |
| 24   | 62,000  | +7          |
| 25   | 75,000  | +8          |
| 26   | 90,000  | +8          |
| 27   | 105,000 | +8          |
| 28   | 120,000 | +8          |
| 29   | 135,000 | +9          |
| 30   | 155,000 | +9          |

## Full-Text Search

- All SRD tables with `name` fields **MUST** support PostgreSQL FTS via `tsvector` columns.
- Search queries **SHALL** be sanitized: special characters stripped, tokens wrapped in quotes.
- FTS indexes **MUST** use `english` text search configuration.
- Search results **SHALL** include a relevance rank and be ordered by it descending.
