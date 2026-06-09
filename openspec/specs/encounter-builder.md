# Encounter Builder — D&D 5e Rules Engine

## Purpose

The Encounter Builder **SHALL** allow the GM to generate balanced combat encounters using official D&D 5e XP budget rules. The system uses SRD monster data and the standard encounter-building guidelines from the DMG.

---

## XP Thresholds per Character Level

The following thresholds **MUST** be used to calculate party XP budgets:

| Level | Easy   | Medium | Hard   | Deadly  |
|-------|--------|--------|--------|---------|
| 1     | 25     | 50     | 75     | 100     |
| 2     | 50     | 100    | 150    | 200     |
| 3     | 75     | 150    | 225    | 400     |
| 4     | 125    | 250    | 375    | 500     |
| 5     | 250    | 500    | 750    | 1,100   |
| 6     | 300    | 600    | 900    | 1,400   |
| 7     | 350    | 750    | 1,100  | 1,700   |
| 8     | 450    | 900    | 1,400  | 2,100   |
| 9     | 550    | 1,100  | 1,600  | 2,400   |
| 10    | 600    | 1,200  | 1,900  | 2,800   |
| 11    | 800    | 1,600  | 2,400  | 3,600   |
| 12    | 1,000  | 2,000  | 3,000  | 4,500   |
| 13    | 1,100  | 2,200  | 3,400  | 5,100   |
| 14    | 1,250  | 2,500  | 3,800  | 5,700   |
| 15    | 1,400  | 2,800  | 4,300  | 6,400   |
| 16    | 1,600  | 3,200  | 4,800  | 7,200   |
| 17    | 2,000  | 3,900  | 5,900  | 8,800   |
| 18    | 2,100  | 4,200  | 6,300  | 9,500   |
| 19    | 2,400  | 4,900  | 7,300  | 10,900  |
| 20    | 2,800  | 5,700  | 8,500  | 12,700  |

## Party Budget Calculation

```
PartyBudget(difficulty) = XP_THRESHOLD[party_level][difficulty] × party_size
```

- `party_size` **MUST** be ≥ 1 and ≤ 20.
- `party_level` **MUST** be between 1 and 20 inclusive.
- Mixed-level parties **SHOULD** use the average level.

---

## Encounter Multipliers

When multiple monsters are present, the effective XP **SHALL** be calculated using encounter multipliers:

| Monster Count | Multiplier |
|---------------|------------|
| 1             | ×1         |
| 2             | ×1.5       |
| 3–6           | ×2         |
| 7–10          | ×2.5       |
| 11–14         | ×3         |
| 15+           | ×4         |

```
AdjustedXP = SumOfMonsterXP × Multiplier(monsterCount)
```

---

## Monster Group Generation Algorithm

### Strategy 1: Single Strong Monster
```gherkin
GIVEN a party budget for the requested difficulty
WHEN building a single-monster encounter
THEN the system SHALL select monsters whose individual XP falls within [budget × 0.6, budget × 1.1]
AND rank candidates by proximity to the budget center
```

### Strategy 2: Identical Group
```gherkin
GIVEN a party budget for the requested difficulty
WHEN building a group of identical monsters
THEN the system SHALL try group sizes 2, 3, 4, 5, 6
AND for each size, calculate targetXP = budget / multiplier(size)
AND select monsters whose XP is closest to targetXP
AND verify the adjustedXP falls within [budget × 0.8, budget × 1.2]
```

### Strategy 3: Mixed Groups
```gherkin
GIVEN a party budget for the requested difficulty
WHEN building a mixed encounter
THEN the system SHALL compose 1 strong monster + N weaker monsters
AND the combined adjustedXP SHALL fall within [budget × 0.8, budget × 1.2]
```

---

## Builder API Contract

### Input
```json
{
  "party_size": 4,
  "party_level": 5,
  "difficulty": "medium",
  "monster_type": "undead",     // optional filter
  "environment": "dungeon",      // optional flavor
  "max_monster_count": 8         // optional cap
}
```

### Output
```json
{
  "party_budget": {
    "easy": 1000,
    "medium": 2000,
    "hard": 3000,
    "deadly": 4400
  },
  "target_difficulty": "medium",
  "suggestions": [
    {
      "monsters": [
        { "name": "Wight", "cr": "3", "xp": 700, "count": 2 }
      ],
      "total_xp": 1400,
      "adjusted_xp": 2100,
      "monster_count": 2,
      "actual_difficulty": "medium"
    }
  ]
}
```

### Validation Rules
- `party_size` **MUST** be between 1 and 20.
- `party_level` **MUST** be between 1 and 20.
- `difficulty` **MUST** be one of: `easy`, `medium`, `hard`, `deadly`.
- The builder **SHOULD** return at least 3 suggestions when possible.
- If no monsters match the constraints, the builder **SHALL** return an empty suggestions array with an explanatory message.

---

## Difficulty Classification

```gherkin
GIVEN an encounter's adjusted XP and the party's budget thresholds
WHEN classifying the encounter difficulty
THEN:
  IF adjustedXP < budget.easy      → "trivial"
  IF adjustedXP < budget.medium    → "easy"
  IF adjustedXP < budget.hard      → "medium"
  IF adjustedXP < budget.deadly    → "hard"
  IF adjustedXP >= budget.deadly   → "deadly"
```

---

## Integration with Combat Tracker

```gherkin
GIVEN the GM selects a suggested encounter
WHEN the GM clicks "Añadir a Combate"
THEN the selected monsters SHALL be added to the initiative tracker
AND each monster instance SHALL receive rolled initiative (1d20 + DEX modifier)
AND monster HP SHALL be set to the SRD hp value
AND the encounter SHALL be logged as a game_event
```

---

## Loadout Analyzer

### AC Calculation

```gherkin
GIVEN a character's equipped armor and shield
WHEN calculating AC
THEN:
  IF no armor is equipped → AC = 10 + DEX modifier
  IF light armor → AC = ac_base + DEX modifier
  IF medium armor → AC = ac_base + DEX modifier (max 2)
  IF heavy armor → AC = ac_base (no DEX bonus)
  IF shield is equipped → AC += 2
```

### Weight & Encumbrance

```gherkin
GIVEN a character's complete inventory
WHEN calculating total weight
THEN the system SHALL sum (weight × quantity) for all items
AND compare against carrying_capacity (STR × 15)
AND if total > carrying_capacity → flag "Encumbered"
AND if total > carrying_capacity × 2 → flag "Heavily Encumbered"
```

### STR Requirements

```gherkin
GIVEN a character wearing heavy armor with str_minimum
WHEN the character's STR score is below str_minimum
THEN the system SHALL warn: "Speed reduced by 10 ft."
AND display the armor's STR requirement in the loadout analysis
```
