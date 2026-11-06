# VTT Scene Modes: Narrative, Exploration, Combat

*Extiende `vtt.md`. Cada escena tiene un modo; en Exploración los combates se abren localmente para los personajes implicados mientras el resto del grupo sigue explorando.*

## 1. Modes
- Every scene **SHALL** have a `mode`: `narrative`, `exploration` or `combat`. Only the GM **MAY** change it.
- **Narrative**: players **SHALL** see only the scene image, full-screen, without grid, tokens, fog or tools.
- **Exploration**: real-time free movement, fog of war (`vtt.md` §4), interactive objects, encounter zones and senses-based detection. No turns.
- **Combat**: the whole scene plays turn-based combat (§5) with every non-hidden token.

```
              ┌────────────── exploration ──────────────┐
narrative ◀──▶│  free movement · fog · objects · zones  │◀──▶ combat (whole scene)
              │      │ trigger (zone / detection / GM)  │
              │      ▼                                   │
              │  local combat for the involved tokens   │──▶ others keep exploring,
              │  (turns, 30 s timer) ── ends ──▶ back   │    see a ⚔ marker
              └─────────────────────────────────────────┘
```

## 2. Exploration movement
- Players **SHALL** move their own tokens with the keyboard (WASD / arrows) or a virtual joystick on touch devices; the GM **MAY** drag any token.
- Movement rate **SHALL** derive from the character sheet speed: `speed_ft` per 6 s of game time, played at the scene `exploration_pace` (default ×2, so 30 ft ≈ 6 squares every 3 s; GM range ×1–×4). Tokens without a character use their own `speed_ft`.
- A sneaking token (`sneaking = true`) **SHALL** move at half rate.
- Movement **SHALL** be sent over the WebSocket (`vtt.move`), validated by the server (ownership, not in combat, no wall crossing, distance ≤ allowed by elapsed time + 25 % tolerance) and broadcast as an ephemeral `vtt.token.moved` event (not stored in the event log). Positions **SHALL** be persisted at most once per second per token.
- A step that crosses a blocking wall **SHALL** slide along the free axis (or stop when both are blocked); the client **SHALL** apply the same rule locally. When the server's position differs from the requested one by more than ¼ cell, the broadcast **SHALL** carry `corrected: true` and the moving client **SHALL** resync to it. The last position of a token that stopped moving **SHALL** be persisted within ~1.5 s.
- Tokens taking part in a combat **MUST NOT** move in real time.

```gherkin
GIVEN a dwarf (25 ft) and an elf (30 ft) holding the same direction key for 3 s at pace ×2
WHEN their positions are compared
THEN the elf SHALL have travelled 30 ft and the dwarf 25 ft
AND a client reporting 60 ft in 1 s SHALL be clamped by the server
```

## 3. Interactive objects (exploration)
- The GM **SHALL** place objects with: name, position, `discover_dc` (0 = always visible; otherwise visible only to characters whose passive Perception ≥ DC), requirements, loot and `per_character` (each character may loot once) or single-use.
- Requirements **MAY** combine:
  - **Milestones**: campaign flags the GM marks as achieved (e.g. «Habló con el Maestro Thorn»).
  - **Silent conditions**: class, race, carrying an item, or a passive score ≥ N. Evaluated by the server; the player only sees success or failure.
  - **Explicit check**: skill + DC. The server rolls `d20 + ability modifier` and shows the roll to the player. *(Skill proficiency is not stored per character yet; the GM may add a fixed bonus to the check.)*
- Loot **SHALL** be `fixed` (items and gold) or `table` (weighted entries rolled silently by the server).
- Interaction **SHALL** require the character's token to be within 5 ft of the object (adjacent square). Each character gets **one attempt per object**; the GM **MAY** reset attempts.
- On success the loot **SHALL** be added atomically to the character inventory/gold and the GM **SHALL** be notified.

```gherkin
GIVEN a hidden chest with discover_dc 14, milestone «Llave de la cripta», check Investigación CD 12 and table loot
AND a character with passive Perception 15 standing next to it, the milestone achieved
WHEN the player interacts
THEN the server SHALL roll Investigation and show "d20 (11) + 2 = 13 vs CD 12"
AND roll the loot table silently and add the result to the inventory
AND a second attempt by the same character SHALL be rejected
```

## 4. Encounters in exploration
- The GM **SHALL** be able to draw **encounter zones** (polygons) linked to monster tokens. A player token entering an armed zone **SHALL** trigger the encounter once.
- Monster tokens with `detects = true` **SHALL** detect player tokens using their senses: the player token must be inside the monster's visible area (same rules as `vtt.md` §4). A sneaking token **SHALL** make a silent Stealth roll (`d20 + DEX mod + stealth_bonus`) when it first enters a monster's view; it is detected if the roll < monster passive Perception.
- The GM **MAY** start an encounter manually by selecting tokens.
- When an encounter starts, the participants **SHALL** be: the linked/detecting monsters and every player token within 60 ft of the trigger point with line of sight to it. Initiative **SHALL** be rolled automatically (`d20 + DEX mod`).
- Players outside the combat **SHALL** keep exploring and **SHALL** see a combat marker at the combat centre. A player token that moves within 60 ft of an active combat with line of sight **SHALL** join it at the end of the current round.

## 5. Combat (local or whole-scene)
- Turn order by initiative; only the active combatant **MAY** move, up to its speed per turn (Dash doubles it). Distance uses the 5e grid rule (`vtt.md` §5).
- Player turns **SHALL** have a 30 s server-side timer. On timeout the turn **SHALL** pass to the next combatant (movement already made is kept). The GM **MAY** pause/resume the timer or add 15 s. Monster and NPC turns have no timer.
- The GM **SHALL** end the combat; combats **SHALL** also end automatically when every monster participant has HP ≤ 0. Participants then return to exploration.
- Several combats **MAY** run at once on the same scene.

```gherkin
GIVEN Lyra's turn in a local combat
WHEN 30 seconds pass without her ending the turn
THEN the server SHALL advance to the next combatant
AND broadcast "vtt.combat.updated" to every member
AND explorers outside the combat SHALL keep moving freely
```

## 6. Real-time protocol
| Direction | Type | Payload |
|---|---|---|
| client → server | `vtt.move` | `{token_id, x, y}` (exploration only, ~8 Hz) |
| server → clients | `vtt.token.moved` | `{scene_id, token_id, x, y}` (ephemeral) |
| server → clients | `vtt.combat.updated` | `{scene_id, combat_id}` |
| server → clients | `vtt.object.updated` | `{scene_id}` |
| server → GM | `vtt.object.looted` | `{object_id, character_id, success, detail}` |

## 7. REST API (additions)
| Method | Path | Role |
|---|---|---|
| GET/POST | `/api/campaigns/:id/milestones` | member / GM |
| PUT | `/api/campaigns/:id/milestones/:milestone_id` | GM |
| GET/POST | `/api/campaigns/:id/vtt/scenes/:scene_id/objects` | member (filtered) / GM |
| PUT/DELETE | `/api/campaigns/:id/vtt/objects/:object_id` | GM |
| POST | `/api/campaigns/:id/vtt/objects/:object_id/interact` | owner of an adjacent token |
| POST | `/api/campaigns/:id/vtt/objects/:object_id/reset` | GM |
| GET | `/api/campaigns/:id/vtt/scenes/:scene_id/combats` | member |
| POST | `/api/campaigns/:id/vtt/scenes/:scene_id/combats` | GM (manual start: `token_ids`) |
| POST | `/api/campaigns/:id/vtt/combats/:combat_id/{next,end,pause,extend,dash}` | GM, or active player for `next`/`dash` |
| PUT | `/api/campaigns/:id/vtt/combats/:combat_id/move` | active combatant owner or GM |
| PUT | `/api/campaigns/:id/vtt/tokens/:token_id/sneak` | token owner |
