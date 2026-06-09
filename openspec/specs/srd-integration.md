# SRD Integration — Linking Reference Data to Campaign Entities

## Purpose

This specification defines how D&D 5e SRD ground-truth data integrates with campaign-specific entities. SRD data provides the "official rules" layer while campaign entities represent the "living game state".

---

## Integration Architecture

```
┌─────────────────────────────────────────────┐
│              SRD Reference Layer             │
│  (read-only, 1,198 ground-truth entities)    │
│  srd_monsters | srd_spells | srd_equipment   │
│  srd_magic_items | srd_classes | srd_races   │
│  srd_conditions | srd_rules                  │
└──────────────┬──────────────────────────────┘
               │ srd_ref_id (optional FK)
┌──────────────▼──────────────────────────────┐
│           Campaign Entity Layer              │
│  (read-write, per-campaign state)            │
│  spells | inventory_items | marketplace_items│
│  characters | trade_offers                   │
└─────────────────────────────────────────────┘
```

---

## Character ↔ SRD Class/Race

### Validation Rules

```gherkin
GIVEN a player creates a character with class="Wizard" and race="Elf"
WHEN the backend processes the creation request
THEN the system SHOULD validate that "Wizard" exists in srd_classes
AND the system SHOULD validate that "Elf" exists in srd_races
AND if validation is enabled and values do not match SRD → the system SHALL return a warning (not an error)
AND the character SHALL still be created (homebrew support)
```

### Automatic Enrichment

```gherkin
GIVEN a character with class="Fighter" and level=5
WHEN the character sheet is rendered
THEN the system SHOULD look up srd_classes WHERE name="Fighter"
AND display the class's hit_dice, saving_throw_proficiencies, and level-5 features
AND the proficiency_bonus SHOULD default to the SRD table value for level 5 (+3)
```

---

## Character Spells ↔ SRD Spells

### Adding SRD Spells

```gherkin
GIVEN a player opens the "Add Spell" modal in the Spells tab
WHEN the player types a spell name
THEN the UI SHALL query /api/srd/spells with the search term
AND display matching SRD spells with autocomplete
WHEN the player selects an SRD spell
THEN the system SHALL copy: name, level, school, casting_time, range, duration, description, components, damage_type
AND store the character spell with srd_ref_id = srd_spell.id
```

### Spell Slot Validation

```gherkin
GIVEN a character with SRD class data available
WHEN the character's spell slots are initialized
THEN the system SHOULD pre-populate spell slot totals based on the SRD class spell slot progression
AND the player MAY override these values (for multiclassing or homebrew)
```

### Custom Spells

```gherkin
GIVEN the GM creates a custom spell not in the SRD
WHEN the spell is added to a character
THEN srd_ref_id SHALL be NULL
AND the spell SHALL function identically to SRD spells in the UI
AND custom spells SHOULD be visually distinguished (no SRD badge)
```

---

## Inventory Items ↔ SRD Equipment/Magic Items

### Adding SRD Items to Inventory

```gherkin
GIVEN the GM awards an SRD item to a character
WHEN the item is added to the character's inventory
THEN the system SHALL copy: name, item_type, weight, description
AND map SRD rarity to the inventory_items.rarity field
AND store srd_ref_id pointing to srd_equipment or srd_magic_items
AND if the SRD item has weapon properties → these SHALL be stored in description
AND if the SRD item has armor properties → AC SHALL be stored/displayed
```

### Marketplace Population

```gherkin
GIVEN a GM opens the marketplace configuration for a campaign
WHEN the GM clicks "Populate from SRD"
THEN the system SHALL present the SRD equipment catalog
AND the GM SHALL select items to add to the marketplace
AND each selected item SHALL be inserted into marketplace_items with:
  - name, item_type, rarity, price (from SRD cost_gp), weight, description
  - attunement_required (from SRD requires_attunement)
AND the GM MAY override the price before confirming
```

---

## Bestiary ↔ SRD Monsters

### Browsing

```gherkin
GIVEN a user (GM or player with bestiary access) opens the Bestiary
WHEN the page loads
THEN the system SHALL fetch monsters from /api/srd/monsters
AND display them as cards with: name, type, CR, size, HP, AC
AND provide filters: search (FTS), CR range, type, size
AND SRD monsters SHALL display an "SRD" badge
AND GM-created custom monsters SHALL display a "Homebrew" badge
```

### Adding Custom Monsters

```gherkin
GIVEN the GM creates a custom monster
WHEN the monster is saved
THEN it SHALL be stored in srd_monsters with is_srd = FALSE
AND it SHALL appear in the bestiary alongside SRD monsters
AND it SHALL be available for encounter building
```

### Monster Detail View

```gherkin
GIVEN a user views a monster's detail page
WHEN the detail loads
THEN the system SHALL display the full stat block:
  - Header: name, size, type, subtype, alignment
  - Combat: AC (with type), HP (with hit dice), Speed
  - Ability Scores: STR/DEX/CON/INT/WIS/CHA with modifiers
  - Info: Saving Throws, Skills, Resistances, Immunities, Vulnerabilities, Condition Immunities, Senses, Languages, CR (XP)
  - Traits: each with name + description
  - Actions: each with name + description (attack/save details parsed from text)
  - Reactions: each with name + description
  - Legendary Actions: description + each with name + description
AND the layout SHALL resemble the D&D Monster Manual stat block format
```

---

## Encounter ↔ SRD Monsters

### Adding SRD Monsters to Combat

```gherkin
GIVEN the GM uses the Encounter Builder
WHEN the GM accepts a suggested encounter group
THEN for each monster in the group:
  - An entry SHALL be created in the initiative tracker
  - Initiative SHALL be rolled as 1d20 + DEX modifier (from SRD data)
  - HP SHALL be set to the SRD monster's hp value
  - AC SHALL be set to the SRD monster's ac value
  - The entry SHALL reference the SRD monster for stat block access during combat
AND a game_event of type "ENCOUNTER_STARTED" SHALL be broadcast to all campaign participants
```

---

## Rules Lookup

```gherkin
GIVEN a user or the RAG system needs to look up a D&D rule
WHEN a query is sent to /api/srd/rules
THEN the system SHALL perform FTS on srd_rules.content
AND return matching rule sections with title and full content
AND the RAG pipeline MAY use these results as additional context alongside pgvector lore results
```

---

## REST API Endpoints Summary

| Method | Path                        | Auth     | Description                         |
|--------|-----------------------------|----------|-------------------------------------|
| GET    | `/api/srd/monsters`         | JWT      | Search/filter monsters              |
| GET    | `/api/srd/monsters/:id`     | JWT      | Monster detail                      |
| GET    | `/api/srd/spells`           | JWT      | Search/filter spells                |
| GET    | `/api/srd/spells/:id`       | JWT      | Spell detail                        |
| GET    | `/api/srd/equipment`        | JWT      | Search/filter equipment             |
| GET    | `/api/srd/equipment/:id`    | JWT      | Equipment detail                    |
| GET    | `/api/srd/magic-items`      | JWT      | Search/filter magic items           |
| GET    | `/api/srd/magic-items/:id`  | JWT      | Magic item detail                   |
| GET    | `/api/srd/classes`          | JWT      | List all classes                    |
| GET    | `/api/srd/classes/:name`    | JWT      | Class detail with level features    |
| GET    | `/api/srd/races`            | JWT      | List all races                      |
| GET    | `/api/srd/races/:name`      | JWT      | Race detail with traits/subraces    |
| GET    | `/api/srd/conditions`       | JWT      | List all conditions                 |
| GET    | `/api/srd/rules`            | JWT      | Search rule sections (FTS)          |
| POST   | `/api/srd/encounter/build`  | JWT (GM) | Generate encounter suggestions      |
| POST   | `/api/srd/spells/plan`      | JWT      | Suggest spell loadout               |
| POST   | `/api/srd/loadout/analyze`  | JWT      | Analyze character equipment/AC      |

### Rate Limiting
- SRD endpoints **SHALL** share the global rate limit (100 req/min per user).
- Encounter builder and spell planner **SHALL** have a burst limit of 10 req/min per user (computationally intensive).

### Pagination
- List endpoints **MUST** support `?limit=N&offset=M` pagination.
- Default limit **SHALL** be 20, maximum **SHALL** be 100.
- Response **MUST** include `total` count for pagination UI.

### Response Format
```json
{
  "data": [ ... ],
  "total": 334,
  "limit": 20,
  "offset": 0
}
```
