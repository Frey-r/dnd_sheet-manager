# Local Network Deployment Specification

*Cómo se instala y juega la aplicación en una red local (LAN), sin servicios externos obligatorios.*

## 1. Game modes
- Every campaign **SHALL** have a `game_mode`: `local` (default) or `foundry`.
- In `local` mode the backend **SHALL** be the source of truth for game state (characters, NPCs, inventory, combat, scenes). Foundry endpoints and UI **MUST NOT** be shown.
- In `foundry` mode the rules of `foundry-integration.md` apply; the native VTT **MAY** still be used.
- The Foundry relay **MUST NOT** be required to start the server.

## 2. Packaging
- The system **SHALL** start on a single host with one command: `docker compose up -d` (file `docker-compose.yml` at the repository root).
- The compose stack **SHALL** contain: `postgres` (pgvector), `redis`, and `app` (Go server that also serves the built React SPA and `/uploads`).
- `ollama` **SHALL** be an optional compose profile (`docker compose --profile ai up -d`). Foundry's relay **SHALL** be an optional profile (`foundry`).
- The `app` image **SHALL** be built by a multi-stage Dockerfile (Node build of `frontend/`, Go build of `cmd/server`) and run as a non-root user.
- Migrations **SHALL** run automatically at server start.
- Uploaded files and database data **SHALL** live in named volumes so they survive restarts and upgrades.

## 3. Network access
- The app **SHALL** listen on `0.0.0.0:${APP_PORT:-8080}` so other devices on the LAN reach it at `http://<host-ip>:8080`.
- Allowed WebSocket/CORS origins **SHALL** be configurable with `ALLOWED_ORIGINS` (comma-separated). When the SPA is served by the same server, same-origin requests **SHALL** be accepted without listing every LAN address.
- The JWT secret **MUST** be provided through `JWT_SECRET`; the stack **MUST NOT** start with a missing secret in production mode.

```gherkin
GIVEN the stack running on a host with IP 192.168.1.20
WHEN a player on the same Wi-Fi opens http://192.168.1.20:8080
THEN the SPA SHALL load
AND login, REST calls and the WebSocket SHALL work against the same origin
```

## 4. Optional AI (Ollama)
- When Ollama is unreachable, the server **SHALL** start normally; lore search **SHALL** return a controlled error (`RAG_UNAVAILABLE`) and the UI **SHALL** show the Oracle as unavailable while every other feature keeps working.

```gherkin
GIVEN the stack started without the "ai" profile
WHEN a player asks the Oracle a question
THEN the UI SHALL show "El Oráculo no está disponible en este servidor"
AND no other screen SHALL be affected
```

## 5. First run
- The first registered user of an empty installation **SHALL** receive the `admin` role so the group can create campaigns without database access. Later users **SHALL** register as `player`; an admin **MAY** promote them to `dm`.
