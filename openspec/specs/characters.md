# Character Management & RAG Orchestration

## Real-Time Character Mutation

### State Mutations
- The system interface **SHALL** allow real-time mutation of character state (HP, inventory, abilities).
- When a spell is cast from the UI, the system **MUST** immediately deduct the corresponding spell slot and update persistent storage.
- All character mutations **SHALL** be broadcast via Redis Pub/Sub to all connected clients on the same campaign channel.

### Scenarios

```gherkin
GIVEN a character with 3 level-1 spell slots and 2 available
WHEN the player casts "Magic Missile" (level 1)
THEN the system SHALL deduct 1 level-1 slot
AND the updated slot count SHALL be persisted to PostgreSQL
AND the change SHALL be broadcast immediately to all session participants
```

```gherkin
GIVEN a character at 12/20 HP receiving 8 points of healing
WHEN the "Cure Wounds" spell resolves
THEN the HP SHALL be capped at 20 (maximum HP)
AND the excess healing SHALL be silently discarded
```

```gherkin
GIVEN a character with no remaining spell slots of the required level
WHEN the player attempts to cast a spell
THEN the UI SHALL display an error
AND no mutation SHALL be persisted
AND the spell SHALL NOT be broadcast to the campaign channel
```

## RAG Orchestration (Lore Queries)

### Async Worker Pool
- Historical lore queries **MUST** be delegated asynchronously to a Go Worker Pool that interacts with Ollama, avoiding blocking on real-time WebSocket message delivery.
- The worker pool **SHALL** have a configurable maximum number of concurrent workers.

### RAG Pipeline

```gherkin
GIVEN a user submits a lore question via the UI
WHEN the backend receives the prompt
THEN the prompt SHALL be converted to a vector embedding
AND a spatial similarity search SHALL be executed on pgvector
AND the top-K context results SHALL be attached to the prompt
AND the enriched prompt SHALL be sent to Ollama
AND the response SHALL be delivered asynchronously via the socket channel
```

### Timeout Handling

```gherkin
GIVEN a RAG query submitted to Ollama
WHEN 10 seconds elapse without a response
THEN the worker SHALL abort the goroutine
AND a descriptive error payload SHALL be sent to the requesting user
AND other WebSocket connections SHALL remain unaffected
```

## Character Creation (starting statistics)

- A new character **SHALL** start at level 1 with ability scores provided by the player (standard array or point buy; default 10 when omitted) and **MUST** reject scores outside 3–20.
- The server **SHALL** derive the starting statistics from 5e rules:
  - Max HP = maximum of the class hit die + CON modifier (minimum 1). Current HP = Max HP.
  - AC = 10 + DEX modifier (unarmoured; equipment adjusts it later).
  - Speed = 25 ft for dwarves, halflings and gnomes; 30 ft otherwise.
  - Proficiency bonus = +2; spellcasting ability by class (INT, WIS or CHA; none for martial classes).
  - Level-1 spell slots: 2 for full casters (bard, cleric, druid, sorcerer, wizard), 1 for warlocks, 0 for half casters (paladin, ranger) and martial classes.
- Class and race names **SHALL** be matched in English and Spanish; unknown (homebrew) classes **SHALL** use a d8 hit die.

```gherkin
GIVEN a player creating a "Mago" with CON 14 and DEX 16
WHEN the character is created
THEN max HP SHALL be 8 (d6 = 6, +2 CON)
AND AC SHALL be 13
AND the character SHALL have 2 level-1 spell slots and INT as spellcasting ability
```
