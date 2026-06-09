# Resilience, Scalability & Concurrency Patterns

## Fan-Out with Redis Pub/Sub

### Channel Design
- WebSocket connections **SHALL** maintain local state externally coordinated through Redis channels.
- Channel naming pattern: `campaign:{campaignId}`
- This enables horizontal scaling of the backend without loss of synchronization across distributed nodes.

```gherkin
GIVEN two backend instances serving the same campaign
WHEN a state mutation is published to Redis channel "campaign:42"
THEN all WebSocket connections subscribed to that channel SHALL receive the update
AND both instances SHALL have a consistent view of campaign state
```

### Message Contract
- All Pub/Sub messages **SHALL** include a `timestamp` field for ordering and deduplication.
- Message types **SHALL** be explicitly typed (`CHARACTER_UPDATE`, `SPELL_CAST`, `LORE_QUERY`, `GAME_EVENT`, `TRADE_OFFER`, `TRADE_ACCEPTED`, `TRADE_REJECTED`, `MESSAGE_GM`, `MESSAGE_PLAYER`).

## Heartbeat Mechanism (Ping/Pong)

### Server-Side
- The Go server **MUST** emit structured Ping frames every 30 seconds.
- If the client does not return a Pong within a 10-second grace period, the session **SHALL** be classified as a dead connection.
- Upon classification as dead, all session resources **MUST** be completely purged from memory and Redis presence.

```gherkin
GIVEN an active WebSocket session
WHEN 30 seconds have elapsed since the last ping
THEN the server SHALL send a Ping frame
AND start a 10-second timer
GIVEN no Pong response within 10 seconds
WHEN the timer expires
THEN the connection SHALL be forcefully closed
AND session data SHALL be removed from Redis
AND session memory SHALL be freed by the Go garbage collector
```

### Client-Side
- The React client **SHALL** respond to Pong frames automatically.
- If the client detects 2 consecutive missed Pong responses, it **MUST** proactively close the socket and begin the reconnection flow (see Sad Path: Abrupt Disconnection).

## Worker Pool for Async Tasks

### RAG Worker Pool
- A fixed-size goroutine pool **SHALL** handle all Ollama interactions.
- Pool size **SHALL** be configurable (default: 4 workers).
- Workers **MUST NOT** block the main WebSocket event loop.

```gherkin
GIVEN a RAG worker pool of size 4 with all workers busy
WHEN a 5th lore query arrives
THEN the query SHALL be queued with a configurable queue depth limit
AND if the queue is full, the backend SHALL return an immediate "busy" error
```

## Exponential Backoff with Jitter (Client)

```gherkin
GIVEN the React client has lost its WebSocket connection
WHEN reconnection is attempted
THEN the delay between attempts SHALL follow: delay = min(base * 2^attempt + random_jitter, max_delay)
AND base SHALL default to 1 second
AND max_delay SHALL default to 30 seconds
AND upon successful reconnection the client SHALL send its last-known timestamp for delta sync
```

## Graceful Shutdown

- On SIGTERM / SIGINT, the Go server **MUST**:
  1. Stop accepting new connections.
  2. Close all active WebSocket connections with close code 1001 (Going Away).
  3. Flush pending Pub/Sub messages to Redis.
  4. Wait for in-flight HTTP requests to complete (with a timeout).
  5. Close database and Redis connections cleanly.
