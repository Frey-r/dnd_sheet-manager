# Architecture Specification

## REST API & WebSocket Layer

### Backend Core
- The backend **MUST** expose a REST API and handle concurrent WebSockets using Go and Gin efficiently.
- The system **MUST** implement a SPA architecture built on React for the frontend.
- Relational and vector persistence **SHALL** be consolidated in a single Dockerized PostgreSQL instance via the `pgvector` extension.

### Data Flow
- The backend **SHALL** be the single source of truth for all game state.
- Redis **SHALL** serve as the Pub/Sub bus for real-time cross-instance message distribution.
- Ollama **SHALL** run locally and be accessed exclusively through the Go worker pool.

### Constraints
- PostgreSQL **MUST NOT** be used directly from the frontend.
- WebSocket connections **SHALL** be authenticated (see security spec).
- All database migrations **MUST** be versioned and reversible.

## Component Architecture

### Trade System
- Trade operations **SHALL** be atomic: items and gold transfer together or not at all.
- A trade offer **SHALL** lock the involved items and gold amounts from the offeror's side until the trade is completed, cancelled, or times out (10-minute TTL).
- Trade conflicts **MUST** be resolved by invalidating the trade and notifying both parties.

### Messaging System
- Messages **SHALL** support three types: `GM_BROADCAST`, `GM_DIRECT`, `PLAYER_DIRECT`.
- Direct messages **SHALL** be visible only to the sender and recipient(s).
- Offline message delivery **SHALL** be queued and delivered upon recipient reconnection.
- Message history **SHALL** be paginated and scoped by role-based access.

### RAG Search Tiers
- `character_lore`: Personal backstory vectors — accessible only to the owning player and the GM.
- `campaign_plot`: Shared chapter summaries and resolved events — accessible to all campaign members.
- `gm_hidden_lore`: GM-only plot notes — accessible exclusively to the GM.
