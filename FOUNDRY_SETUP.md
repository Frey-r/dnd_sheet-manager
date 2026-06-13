# Foundry VTT Integration — Setup

Connects this app to a self-hosted Foundry VTT instance. Foundry is the source of
truth for game state; this app mirrors it one-way and embeds the Foundry client in
an iframe for combat/live play. Full spec: `openspec/specs/foundry-integration.md`.

## 1. Foundry + relay

1. Install Foundry locally, install the **D&D 5e (`dnd5e`)** system, create your world.
2. In the world, install the **`foundryvtt-rest-api`** module and set its `API key`
   and `Relay URL` (the relay below).
3. Start the relay (added to `infra/docker-compose.yml`):
   ```bash
   FOUNDRY_API_KEY=your-key docker compose -f infra/docker-compose.yml up -d foundry-relay
   ```
4. Find your world's `clientId`:
   ```bash
   curl -s http://localhost:3010/clients -H "x-api-key: your-key"
   ```

## 2. Backend config

`config.yaml` already has a `foundry:` block. Provide secrets via env (never commit them):

```bash
export FOUNDRY_API_KEY=your-key
export FOUNDRY_CLIENT_ID=your-world-client-id
```

Then apply the new migration `migrations/010_foundry_integration.sql` with your
usual tooling (goose), e.g.:

```bash
goose -dir migrations postgres "$DSN" up
```

## 3. Run the server

The server entrypoint is `cmd/server/main.go`. It connects to Postgres, applies
migrations automatically (base `setup.sql` + incrementals `008`–`010`), wires all
handlers including Foundry, and listens on `server.port` (8080).

```bash
docker compose -f infra/docker-compose.yml up -d postgres redis
FOUNDRY_API_KEY=your-key FOUNDRY_CLIENT_ID=your-world-id go run ./cmd/server
```

It exposes:

| Method | Path                  | Auth     |
|--------|-----------------------|----------|
| POST   | `/api/foundry/sync`   | dm/admin |
| GET    | `/api/foundry/status` | any auth |
| GET    | `/api/foundry/health` | any auth |

## 4. Frontend

Set the Foundry client URL for the combat iframe (see `frontend/.env.example`):

```
VITE_FOUNDRY_URL=https://foundry.<your-domain>
```

The in-app **Combat (Foundry)** view (`/campaign/:id/combat`) embeds Foundry and,
for DMs, shows a **Sincronizar desde Foundry** button.

## 5. iframe / Cloudflare Tunnel

Serve Foundry and the app under the **same parent domain** (e.g. `foundry.example`
and `app.example`). On the proxy in front of Foundry:

- Send `Content-Security-Policy: frame-ancestors https://app.example` (your app origin).
- Do **not** send `X-Frame-Options: DENY`.
- Ensure the Foundry session cookie is `SameSite=None; Secure`.

Each player logs into Foundry once inside the iframe.

## What syncs (one-way Foundry → app)

Characters, NPCs, actor items/equipment, scenes→maps, journal→lore (with RAG
embedding). App-only features (messaging, marketplace, trades, events, notes) keep
their own state. Under one-way sync, marketplace/trade changes do **not** propagate
to Foundry — authoritative inventory lives in Foundry.

## 6. Reference data (catalogs): Postgres → Foundry, then Foundry authoritative

Our `srd_*` catalogs (monsters, spells, items, classes, subclasses, races) are more
complete than a fresh Foundry world. Bootstrap Foundry from them, then let Foundry own
the reference data.

### 6a. Export Postgres → Foundry compendium module

```bash
go run ./cmd/foundry-export --out dist/foundry-module
```
This writes a Foundry **module** with dnd5e source JSON under
`dist/foundry-module/packs/_source/<pack>/`, a `module.json`, and stamps each row's
`srd_*.foundry_uuid` with its (deterministic, stable) compendium UUID.

Compile the packs and install:
```bash
cd dist/foundry-module
npx @foundryvtt/foundryvtt-cli package pack -n spells     --in packs/_source/spells     --out packs/spells
npx @foundryvtt/foundryvtt-cli package pack -n monsters   --in packs/_source/monsters   --out packs/monsters
npx @foundryvtt/foundryvtt-cli package pack -n items      --in packs/_source/items      --out packs/items
npx @foundryvtt/foundryvtt-cli package pack -n classes    --in packs/_source/classes    --out packs/classes
npx @foundryvtt/foundryvtt-cli package pack -n subclasses --in packs/_source/subclasses --out packs/subclasses
npx @foundryvtt/foundryvtt-cli package pack -n races      --in packs/_source/races      --out packs/races
```
Copy the module folder into Foundry's `Data/modules/` and enable it in the world.

**Fidelity:** monsters, spells and items are high fidelity. Classes/subclasses/races
are **descriptive** (name, description, hit die, saving throws) — dnd5e `advancement`
automation cannot be reconstructed from the flat `srd_*` schema.

### 6b. Foundry → Postgres (Foundry authoritative)

Once the compendiums exist (and any homebrew you add in Foundry), import them back:
```
POST /api/foundry/sync/reference   (dm/admin)
```
Upserts by `foundry_uuid` (Foundry-wins) into `srd_*`. The deterministic ids from the
export keep the round-trip idempotent. Relay `GET /search` includes compendiums by
default; the backend filters by `documentType`/`subType`.
```
