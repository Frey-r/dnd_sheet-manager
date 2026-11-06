# Integrated Virtual Tabletop (VTT) Specification

*Mesa virtual nativa de la aplicación. Sustituye a Foundry VTT como vista de mesa por defecto: las campañas en modo `local` juegan aquí; Foundry queda como modo opcional (`game_mode = 'foundry'`, ver `foundry-integration.md`).*

## 1. Scope

- The application **SHALL** provide a native tactical tabletop per campaign that works on a local network without Foundry VTT or any external service.
- The VTT **SHALL** support: map scenes with an adjustable square grid, tokens synchronised in real time, walls and doors, light sources, a distance ruler, and **dynamic fog of war computed per user from the 5e vision rules** of the tokens that user controls.
- Dynamic lighting beyond the rules in §4 (coloured light, animated light, elevation, cones) is **out of scope** for v1.

```
┌─────────────── Browser (React) ───────────────┐        ┌──────────── Go API ────────────┐
│  Canvas layers:  map ▸ grid ▸ tokens ▸ fog    │  REST  │ /api/campaigns/:id/vtt/*        │
│  Vision engine (ray-cast LOS ∩ light ∪ dv)    │◀──────▶│ VTTService (role filtering,     │
│  Explored memory (per user, localStorage)     │   WS   │  wall-collision on move)        │
└───────────────────────────────────────────────┘◀───────│ Hub.Publish("vtt.*") ─▶ Redis   │
                                                          └──────────┬─────────────────────┘
                                                                     ▼
                                                       PostgreSQL: vtt_scenes, vtt_tokens
```

## 2. Scenes

- A scene **SHALL** have: name, map image URL, image width/height (px), grid size (px per cell, default 70), grid offset (x, y), feet per cell (default 5), ambient light (`bright` | `dim` | `dark`), fog enabled flag, walls, scene lights.
- Exactly zero or one scene per campaign **SHALL** be active. Players **SHALL** only see the active scene.
- Only the GM/admin of the campaign **MAY** create, edit, activate or delete scenes.
- The GM **MAY** upload map images (PNG, JPEG or WebP, ≤ 15 MB). Uploads **MUST** be validated by content type and stored under the server upload directory.

```gherkin
GIVEN a GM in a local-mode campaign with two scenes
WHEN the GM activates "Campamento gnoll"
THEN that scene SHALL become the only active scene
AND every connected member SHALL receive a "vtt.scene.activated" event
AND players SHALL be shown the new scene without reloading the page
```

```gherkin
GIVEN a player in the campaign
WHEN the player requests the list of scenes
THEN the response SHALL contain only the active scene, or none
```

## 3. Tokens

- A token **SHALL** have: name, kind (`pc` | `npc` | `monster`), optional `character_id`, optional owner user, image URL or colour, position (x, y in scene pixels, token centre), size in cells, HP / max HP, AC, hidden flag, and vision fields: `vision_ft` (normal sight range, `0` = unlimited), `darkvision_ft`, `blindsight_ft`, `light_bright_ft`, `light_dim_ft`.
- A PC token created from a character **SHALL** take its owner from the character's user and **SHOULD** prefill darkvision from the character's race (e.g. elf, dwarf, gnome, half-orc, tiefling: 60 ft; drow: 120 ft).
- A monster token created from the bestiary **SHOULD** prefill darkvision/blindsight by parsing the monster's `senses`.
- Token positions **SHALL** snap to the grid on drop.

### Permissions
| Action | Player (owner) | Player (non-owner) | GM / Admin |
|---|---|---|---|
| See token | if not hidden | if not hidden | always |
| Move token | own tokens | **MUST NOT** | all |
| Edit vision, HP, hidden, owner | **MUST NOT** | **MUST NOT** | yes |
| Create / delete token | **MUST NOT** | **MUST NOT** | yes |

```gherkin
GIVEN a hidden "Emboscador gnoll" token on the active scene
WHEN a player fetches the active scene
THEN the response MUST NOT include that token
AND the GM's response SHALL include it marked as hidden
```

```gherkin
GIVEN a player who owns the token "Kaelen Varn"
WHEN the player drags it to another cell
THEN the backend SHALL persist the new position
AND broadcast "vtt.token.moved" with token id and position to the campaign
AND other clients SHALL update the token without refetching the scene
```

```gherkin
GIVEN a player who does not own "Brakka Hierroforja"
WHEN the player tries to move it
THEN the request SHALL be rejected with HTTP 403
AND no position change SHALL be persisted
```

### Wall collision
```gherkin
GIVEN a closed wall between the token's current centre and the target point
WHEN a player moves the token across it
THEN the request SHALL be rejected with HTTP 422 "Movement blocked by a wall"
AND the GM SHALL be allowed to move tokens through walls
```

## 4. Vision & Fog of War (5e rules)

The visible area is computed **on the client** for the user's own tokens; the GM sees everything and **MAY** preview any player's view ("Ver como…").

**Definitions**
- `LOS(p)`: polygon of points visible from `p` with straight lines not crossing a closed wall or door (walls block sight; open doors do not).
- `Lit`: if ambient is `bright` or `dim`, the whole scene; if `dark`, the union over every light source `L` (token lights and scene lights) of `circle(L, bright+dim) ∩ LOS(L)`.

**Rules**
- A token sees `LOS(t) ∩ circle(t, vision_ft or ∞) ∩ (Lit ∪ circle(t, darkvision_ft) ∪ circle(t, blindsight_ft))`.
- Darkvision **SHALL** let the token see darkness within range as if it were dim light (5e PHB "Vision and Light").
- A user's visible area **SHALL** be the union of what all tokens they own see. Tokens with HP ≤ 0 still see (the player keeps the view).
- Tokens of others **SHALL** be drawn only if their centre lies inside the user's visible area.
- Areas seen before (explored) **SHOULD** be remembered per user and per scene and drawn dimmed, without tokens.
- Within dim light (and darkvision-only areas) the map **SHOULD** be drawn darkened to communicate the disadvantage on Perception checks.
- With fog disabled for the scene, players **SHALL** see the whole map and all non-hidden tokens.

```gherkin
GIVEN a dark scene with no light sources
AND a dwarf token with 60 ft darkvision and a human token with none, owned by different players
WHEN each player looks at the table
THEN the dwarf's player SHALL see a 60 ft radius around the dwarf limited by walls
AND the human's player SHALL see nothing beyond their own token
```

```gherkin
GIVEN the human token carries a torch (bright 20 ft, dim 20 ft)
WHEN the human stands in a corridor
THEN its player SHALL see up to 40 ft along the corridor, clipped by walls
AND the area between 20 and 40 ft SHALL be drawn as dim light
```

```gherkin
GIVEN a closed door between two rooms
WHEN the GM opens the door
THEN the door SHALL stop blocking sight and movement
AND every client SHALL recompute vision on the "vtt.scene.updated" event
```

> **Trust boundary.** Wall geometry and the positions of non-hidden tokens are delivered to every member; the per-user fog is a gameplay aid computed in the browser, not a security boundary. Content that must stay secret **MUST** use the token `hidden` flag, which is enforced by the server.

## 5. Ruler & Distances
- Any member **SHALL** be able to measure distances on the active scene.
- Distance **SHALL** be reported in feet using `feet_per_cell` and the 5e default diagonal rule (each diagonal cell = 5 ft, i.e. Chebyshev distance).

## 6. Combat link
- The GM **SHOULD** be able to add a token to the initiative tracker in one action; the combatant **SHALL** use the token's name and HP.
- PC token HP **SHALL** display the linked character's current HP.

## 7. Real-time events
| Event | Payload | Trigger |
|---|---|---|
| `vtt.scene.activated` | `{scene_id}` | GM activates a scene |
| `vtt.scene.updated` | `{scene_id}` | scene settings, walls, doors, lights, token create/edit/delete |
| `vtt.token.moved` | `{scene_id, token_id, x, y}` (non-hidden tokens only) | token moved |

Hidden-token moves **SHALL** publish `vtt.scene.updated` without coordinates. Movement events **SHALL NOT** trigger the generic `state.changed` fan-out.

## 8. REST API
| Method | Path | Role |
|---|---|---|
| GET | `/api/campaigns/:id/vtt/scenes` | member (players: active only) |
| POST | `/api/campaigns/:id/vtt/scenes` | GM |
| GET | `/api/campaigns/:id/vtt/active` | member (role-filtered tokens) |
| GET | `/api/campaigns/:id/vtt/scenes/:scene_id` | GM, or member if active |
| PUT | `/api/campaigns/:id/vtt/scenes/:scene_id` | GM |
| DELETE | `/api/campaigns/:id/vtt/scenes/:scene_id` | GM |
| POST | `/api/campaigns/:id/vtt/scenes/:scene_id/activate` | GM |
| POST | `/api/campaigns/:id/vtt/scenes/:scene_id/tokens` | GM |
| PUT | `/api/campaigns/:id/vtt/tokens/:token_id` | GM |
| PUT | `/api/campaigns/:id/vtt/tokens/:token_id/move` | owner or GM |
| DELETE | `/api/campaigns/:id/vtt/tokens/:token_id` | GM |
| POST | `/api/campaigns/:id/uploads` | GM (multipart `file`) |
