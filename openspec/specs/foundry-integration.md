# Foundry VTT Integration — Foundry as Game-State Source of Truth

## Purpose

This specification defines how the dnd-campaign-manager integrates with a self-hosted **Foundry Virtual Tabletop** instance running the **D&D 5e (`dnd5e`) system**. After this integration, Foundry becomes the **source of truth for live game state** (actors, items, scenes, journal), while this application acts as a **companion layer** that:

1. **Synchronizes game-state data one-way (Foundry → app)** into its own persistence for browsing, search (RAG), and campaign management.
2. **Embeds the live Foundry client in an iframe** to serve as the in-app combat / live-play view.
3. **Retains exclusive ownership** of features Foundry does not provide: lore RAG search, direct/broadcast messaging, marketplace, trades, events calendar, and campaign notes.

This spec supersedes the "single source of truth" statement in `architecture.md` for game-state entities (see `architecture.md` → Data Flow).

---

## Scope & Direction

- Synchronization **SHALL** be **unidirectional**: Foundry → app. The app **MUST NOT** write game-state changes back to Foundry in this version.
- Foundry **SHALL** be the authoritative owner of: characters (actors), NPCs (actors), inventory/equipment (actor-embedded items), bestiary (compendium monsters), and maps (scenes).
- The app **SHALL** remain the authoritative owner of: lore, messaging, marketplace, trade offers, events, and campaign notes.
- Write-back to Foundry (bidirectional sync) is explicitly **out of scope** and **MAY** be addressed in a future specification.

---

## Integration Architecture

```
┌──────────────────────────────┐
│        Foundry VTT (local)   │
│   dnd5e system + world data  │
│  ┌────────────────────────┐  │
│  │ foundryvtt-rest-api mod │──┼──WebSocket──┐
│  └────────────────────────┘  │             │
└──────────────────────────────┘             ▼
                                   ┌────────────────────────┐
                                   │  REST API Relay (Node) │
                                   │ foundryvtt-rest-api-relay
                                   │   x-api-key + clientId │
                                   └───────────┬────────────┘
                                               │ REST (pull)
                                               ▼
                                   ┌────────────────────────┐
                                   │   Go Backend (Gin)     │
                                   │  internal/foundry      │
                                   │  foundry_sync_service  │
                                   └───────────┬────────────┘
                                               │ upsert (foundry_uuid)
                                               ▼
                                   ┌────────────────────────┐
                                   │   PostgreSQL (mirror)  │
                                   └────────────────────────┘

  Browser (React SPA)  ──iframe──►  Foundry client (combat / live view)
  Browser (React SPA)  ──REST───►  Go Backend (synced mirror + app features)
```

### Components

- The Foundry world **MUST** have the **`foundryvtt-rest-api`** module installed and enabled, configured with an API key and the relay URL.
- A self-hosted **`foundryvtt-rest-api-relay`** instance **SHALL** run as a service (added to `infra/docker-compose.yml`). It exposes the REST surface that the Go backend consumes.
- The Go backend **SHALL** access Foundry data **exclusively through the relay's REST API** — it **MUST NOT** attempt to read Foundry's database files directly.
- Relay credentials (`base_url`, `api_key`, `client_id`) **MUST** be configurable via `config.yaml` (`foundry:` block) and overridable by environment variables; the API key **MUST NOT** be committed to source control.

---

## Sync Rules

### Trigger & Ownership

```gherkin
GIVEN a user with role "gm" in a campaign
WHEN they invoke POST /api/foundry/sync
THEN the backend SHALL pull all configured entity types from the relay
AND upsert them into the local mirror keyed by foundry_uuid
AND record the outcome (counts, status, errors) in foundry_sync_state
```

```gherkin
GIVEN a user with role "player"
WHEN they invoke POST /api/foundry/sync
THEN the middleware SHALL reject the request with HTTP 403
AND the rejection SHALL be logged (see security.md → RBAC)
```

### Identity & Upsert

- Every mirrored entity **SHALL** store the Foundry document UUID in a `foundry_uuid` column (unique).
- On sync, the backend **SHALL** upsert by `foundry_uuid`: insert when absent, update synced fields when present.
- Conflict policy for synced fields **SHALL** be **"Foundry wins"** — any local edits to Foundry-owned fields are overwritten on the next sync.
- App-owned fields on the same row (if any) **MUST NOT** be overwritten by sync.

### Deletion

```gherkin
GIVEN an entity that previously existed in Foundry and was mirrored locally
WHEN a sync runs and that entity is no longer present in Foundry
THEN the backend SHALL mark the local mirror row as orphaned (soft-delete / is_foundry_orphan = TRUE)
AND SHALL NOT hard-delete rows that are referenced by app-owned entities (e.g. lore linked to a character)
```

### Entity Mapping

```gherkin
GIVEN a Foundry Actor of type "character"
WHEN it is synced
THEN it SHALL map to a row in `characters`
AND the system SHALL copy: name, race, class, level, ability scores, max_hp, current_hp, temp_hp, ac, speed
AND fields the app schema does not model SHALL be ignored
```

```gherkin
GIVEN a Foundry Actor of type "npc"
WHEN it is synced
THEN it SHALL map to a row in `npcs` (name, ac, hp, speed, description)
```

```gherkin
GIVEN items embedded in a synced Actor
WHEN the actor is synced
THEN each item SHALL map to `inventory_items` linked to the owning character via the actor's foundry_uuid
AND equipped/attuned state SHALL be preserved where the app schema supports it
```

```gherkin
GIVEN a monster entry in a Foundry compendium
WHEN the bestiary is synced
THEN it SHALL map to `srd_monsters` with an origin marker distinguishing it from bundled SRD data
```

```gherkin
GIVEN a Foundry Scene
WHEN scenes are synced
THEN it SHALL map to `maps` (name, image URL/background, notes)
```

```gherkin
GIVEN a Foundry Journal Entry
WHEN journal is synced
THEN it SHALL map to `lore`
AND the backend SHALL enqueue an embedding job on the existing RAG worker pool (see resilience.md → RAG Worker Pool)
AND the lore tier SHALL default to a configured value (e.g. campaign_plot) unless overridden by the GM
```

### Field-level guarantee

- The integration **SHALL** synchronize **only the fields the app schema uses**; the richer Foundry `dnd5e` data model is intentionally lossy on import.

---

## Real-Time Updates (Optional, SHOULD)

```gherkin
GIVEN the relay supports push of Foundry hook events (e.g. updateActor)
WHEN an actor's HP changes in Foundry during play
THEN the backend SHOULD receive the event and update the mirror without a full resync
AND SHOULD publish a CHARACTER_UPDATE message on the campaign Redis channel (see resilience.md)
```

- If real-time push is unavailable, periodic or manual GM-triggered sync **SHALL** be the fallback.

---

## Combat Embedding (iframe)

The in-app combat / live-play view **SHALL** be the Foundry client embedded in an `<iframe>`. Foundry has no "combat-only" view; the full game client is embedded.

### Requirements

```gherkin
GIVEN the app and Foundry are served under the same parent domain (e.g. app.example and foundry.example)
WHEN a user opens the in-app Combat view
THEN the app SHALL render an iframe whose src is the Foundry client URL (VITE_FOUNDRY_URL)
AND the user SHALL authenticate to Foundry within the iframe (Foundry session)
```

- The reverse proxy in front of Foundry **MUST** allow framing by the app origin:
  - It **MUST** send `Content-Security-Policy: frame-ancestors https://<app-domain>`.
  - It **MUST NOT** send `X-Frame-Options: DENY` (nor `SAMEORIGIN` if app is on a different subdomain).
- The Foundry session cookie **MUST** be `SameSite=None; Secure` so it is sent inside the cross-site iframe.
- If the Go backend or relay is called from within the Foundry origin, **CORS MUST** be configured to permit it.
- The JWT/session of the app and the Foundry session are **independent**; the app **MUST NOT** attempt to share its JWT with the iframe.

---

## Ownership Boundary & Implications

| Entity            | Owner   | Sync       | App write effect                              |
|-------------------|---------|------------|-----------------------------------------------|
| characters        | Foundry | Foundry→app| read-only mirror                              |
| npcs              | Foundry | Foundry→app| read-only mirror                              |
| inventory/equip   | Foundry | Foundry→app| read-only mirror                              |
| bestiary          | Foundry | Foundry→app| read-only mirror (+ bundled SRD)              |
| maps (scenes)     | Foundry | Foundry→app| read-only mirror                              |
| lore              | App     | —          | read/write (RAG)                              |
| messaging         | App     | —          | read/write                                    |
| marketplace       | App     | —          | read/write (no Foundry effect)                |
| trades            | App     | —          | read/write (no Foundry effect)                |
| events / notes    | App     | —          | read/write                                    |

```gherkin
GIVEN inventory is a read-only mirror of Foundry under unidirectional sync
WHEN a trade or marketplace purchase completes in the app
THEN the inventory change SHALL NOT be propagated to Foundry
AND the UI SHALL clearly indicate that game-authoritative inventory lives in Foundry
```

- Under unidirectional sync, marketplace/trade flows that imply inventory mutation **SHALL** be treated as app-local only (display/bookkeeping) and **MUST NOT** be presented to the user as authoritative over Foundry. Authoritative inventory changes require the future bidirectional spec.

---

## REST API Endpoints Summary

| Method | Path                    | Auth      | Description                                  |
|--------|-------------------------|-----------|----------------------------------------------|
| POST   | `/api/foundry/sync`     | JWT (GM)  | Trigger a full sync from Foundry             |
| GET    | `/api/foundry/status`   | JWT       | Last sync time, per-type counts, errors      |
| GET    | `/api/foundry/health`   | JWT       | Relay/module connectivity check              |

### Auth & Rate Limiting

- `/api/foundry/sync` **SHALL** be restricted to role `gm` (see security.md → RBAC).
- Sync **SHALL** have a burst limit (e.g. 5 req/min per user) as it is I/O intensive (see security.md → Rate Limiting).
- The relay API key **MUST** be sent server-side only (`x-api-key` header from Go) and **MUST NOT** be exposed to the frontend.

### Response Format

```json
{
  "status": "ok",
  "last_synced_at": "2026-06-13T00:00:00Z",
  "counts": { "characters": 4, "npcs": 12, "items": 87, "scenes": 6, "journal": 23, "monsters": 150 },
  "errors": []
}
```

---

## Resilience

```gherkin
GIVEN the relay or Foundry is unreachable
WHEN a sync is triggered
THEN the backend SHALL fail gracefully with a clear error
AND SHALL NOT partially corrupt the mirror (sync SHALL be transactional per entity type or fully rolled back)
AND foundry_sync_state.status SHALL reflect "error" with the cause
```

- Embedding jobs for synced lore **MUST NOT** block the sync request; they **SHALL** be queued on the RAG worker pool (see resilience.md).

---

## Reference Data Unification

The app's Postgres `srd_*` catalogs (~1198 entries: monsters, spells, equipment, magic
items, classes, races, conditions, rules) are more complete than a fresh Foundry world.
Reference data **SHALL** converge to a single source of truth via a two-phase flow.

### Direction

```gherkin
GIVEN the app has richer reference data than the Foundry world
WHEN the integration is bootstrapped
THEN the app SHALL export its srd_* data as dnd5e-formatted documents packaged as an
     installable Foundry MODULE with compendium packs (Postgres → Foundry)
AND after the module is installed, Foundry SHALL become the source of truth for
     reference data (Foundry → Postgres sync, authoritative)
```

### Export mechanism

- The relay **MUST NOT** be used to write reference data: `/create` only writes to the
  *world*, not compendiums. The export **SHALL** instead emit dnd5e source JSON compiled
  to compendium packs with the official Foundry CLI (`@foundryvtt/foundryvtt-cli`).
- Each exported document **SHALL** carry a **deterministic `_id`** (16-char) derived from
  its type + name, so re-exports are idempotent and compendium UUIDs are stable.
- The deterministic `_id` **SHALL** be stored in the corresponding `srd_*.foundry_uuid`
  so the reverse sync maps cleanly.

### Fidelity (declared)

- Monsters, spells, and items **SHALL** be exported with high fidelity (stats, levels,
  descriptions, components, weight/price/rarity).
- Classes, subclasses, and races **SHALL** be exported as descriptive entries
  (name, description, hit die, saving throws) **without** `advancement` automation,
  because dnd5e advancements reference features by compendium UUID that the flat
  `srd_*` schema does not contain.

### Reverse sync & homebrew

```gherkin
GIVEN the Foundry compendiums are populated
WHEN a GM triggers POST /api/foundry/sync/reference
THEN the backend SHALL read compendium documents via GET /search (compendiums included)
     filtered by documentType/subType
AND upsert them into the matching srd_* table by foundry_uuid (Foundry-wins)
AND custom/homebrew entries (is_srd = FALSE) SHALL be preserved and imported
```

### Reference endpoints/commands

| Kind    | Name                            | Auth     | Description                              |
|---------|---------------------------------|----------|------------------------------------------|
| CLI     | `cmd/foundry-export`            | local    | Export srd_* → Foundry module (compendia)|
| REST    | `POST /api/foundry/sync/reference` | dm/admin | Import Foundry compendiums → srd_*     |

---

## Configuration

```yaml
foundry:
  relay_base_url: "http://localhost:3010"   # self-hosted relay
  api_key: ""                                # set via env FOUNDRY_API_KEY
  client_id: ""                              # connected world id from the relay
  default_lore_tier: "campaign_plot"
  sync_compendium: true
```

- `VITE_FOUNDRY_URL` (frontend) **SHALL** point to the Foundry client URL used by the combat iframe.
