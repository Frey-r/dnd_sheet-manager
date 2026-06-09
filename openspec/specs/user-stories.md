# User Stories & Use Cases

## Happy Paths

### Client Connection
```gherkin
GIVEN a registered user with valid credentials
WHEN the client authenticates via HTTP login endpoint
THEN the backend SHALL return a signed JWT with role claim and expiry
AND the client SHALL open a WebSocket connection
AND the first WS frame SHALL contain the JWT as a JSON payload for definitive validation
AND upon successful validation the connection SHALL be promoted to an authenticated session
```

### Lore Query (RAG)
```gherkin
GIVEN an authenticated WebSocket session with a campaign context
WHEN the player sends a lore question through the WS channel
THEN the backend SHALL convert the prompt to a vector
AND execute a spatial similarity search in pgvector
AND attach relevant context to the prompt
AND Ollama SHALL return the response asynchronously via the socket channel
AND the response SHALL include source references from the vector search results
```

### Real-Time State Sync
```gherkin
GIVEN multiple players connected to the same campaign
WHEN a player updates their character's HP
THEN the change SHALL propagate to all other players in the same campaign
AND the updated state SHALL be persisted to PostgreSQL
AND the GM SHALL receive the update with full visibility
```

### Player-to-Player Item Trade
```gherkin
GIVEN two characters A and B in the same campaign, both with open trade sessions
WHEN character A initiates a trade offer containing items and/or gold
AND character B receives the pending trade notification in real-time
THEN character B SHALL see the offered items and gold amounts
AND character B SHALL be able to accept, reject, or counter-offer
WHEN character B accepts the trade
THEN the items and/or gold SHALL be atomically transferred from A to B
AND both characters' inventories SHALL be updated in PostgreSQL
AND the trade SHALL be broadcast to all campaign participants as a game event
AND the trade log SHALL be visible to the GM
```

```gherkin
GIVEN a character attempting to trade an item that is currently equipped or quest-bound
WHEN the trade is initiated
THEN the system SHALL prevent the trade
AND display an error indicating the item cannot be traded
```

```gherkin
GIVEN a trade offer pending acceptance
WHEN the offering player cancels the offer before acceptance
THEN the pending offer SHALL be invalidated
AND the receiving player SHALL be notified of the cancellation
AND no state mutation SHALL occur
```

### Gold Transfer Between Players
```gherkin
GIVEN character A with 500 gold and character B with 100 gold in the same campaign
WHEN A initiates a gold-only transfer of 200 gold to B
AND B accepts the transfer
THEN A's gold SHALL be reduced to 300
AND B's gold SHALL be increased to 300
AND the transaction SHALL be recorded in the campaign audit log
AND both changes SHALL be broadcast in a single atomic operation
```

```gherkin
GIVEN a character attempting to transfer more gold than they own
WHEN the transfer is initiated
THEN the system SHALL reject the transaction
AND return an error: "Insufficient gold balance"
AND no gold mutation SHALL occur
```

### RAG Search: Character Lore (Personal Backstory)
```gherkin
GIVEN an authenticated player with an assigned character in a campaign
WHEN the player submits a lore query targeting "mi historia" or "mi personaje"
THEN the backend SHALL scope the vector search to the character's personal lore entries
AND only the player's own backstory vectors SHALL be queried
AND the response SHALL include only information from the character's history section
AND the response SHALL NOT include content from other characters' histories or hidden GM plot
```

### RAG Search: Campaign Plot (Shared Story)
```gherkin
GIVEN an authenticated player in a campaign
WHEN the player submits a lore query targeting "trama", "historia de la partida", or "capítulos"
THEN the backend SHALL scope the vector search to campaign-level plot entries shared with all players
AND the search SHALL include chapter summaries and key events resolved
AND the search SHALL NOT include GM-only hidden plot content
```

### RAG Search: GM Hidden Lore
```gherkin
GIVEN a GM user in a campaign
WHEN the GM submits any lore query
THEN the vector search SHALL include all content tiers:
  - campaign shared plot
  - character backstories (all characters)
  - GM hidden plot notes
AND the response SHALL reflect full access to all lore tiers
```

### GM-to-Player Direct Message
```gherkin
GIVEN a GM user with an active campaign
WHEN the GM sends a direct message to a specific player
THEN the message SHALL be delivered in real-time via WebSocket
AND the message SHALL appear in the player's private message inbox
AND the message SHALL NOT be visible to other players
AND the GM SHALL receive delivery confirmation
```

```gherkin
GIVEN a GM sending a broadcast message to all players
WHEN the GM selects "send to all players"
THEN the message SHALL be delivered to all connected players in real-time
AND the message SHALL be persisted to each player's message history
AND offline players SHALL receive the message upon reconnection
```

### Player-to-Player Direct Message
```gherkin
GIVEN two players A and B in the same campaign
WHEN player A sends a direct message to player B
THEN the message SHALL be delivered in real-time via WebSocket
AND the message SHALL appear only in B's private inbox
AND the message SHALL NOT be visible to other players or the GM (unlessGM is a recipient)
AND the sender SHALL see the message as "sent"
```

### Message History Persistence
```gherkin
GIVEN an authenticated user with message history in a campaign
WHEN the user requests message history via REST endpoint
THEN the backend SHALL return messages paginated by timestamp
AND only messages relevant to the user's role and recipients SHALL be included
AND GM hidden messages SHALL NOT appear in player responses
```

## Sad Paths

### Abrupt Disconnection
```gherkin
GIVEN an active WebSocket connection
WHEN the connection drops unexpectedly
THEN the React client SHALL detect the socket interruption within 1 second
AND the client SHALL initiate reconnection using Exponential Backoff with Jitter
AND upon reconnection the client SHALL request state synchronization by last-known timestamp
AND the backend SHALL return all deltas since that timestamp
```

### Ollama Failure / Timeout
```gherkin
GIVEN a pending RAG query to Ollama
WHEN the 10-second timeout is reached without response
THEN the worker SHALL abort the goroutine cleanly
AND a controlled error notification SHALL be delivered to the requesting user
AND the error payload SHALL include: { "type": "RAG_TIMEOUT", "message": "Lore query timed out", "retryable": true }
```

### Unauthorized Access
```gherkin
GIVEN a WebSocket connection with an invalid or expired JWT
WHEN the first JSON frame is processed
THEN the server SHALL close the connection with status code 4001 (Unauthorized)
AND no further frames SHALL be accepted from that client
```

### Invalid Character Mutation
```gherkin
GIVEN a player attempting to modify a character they do not own
WHEN the mutation request is processed by the RBAC middleware
THEN the request SHALL be rejected with HTTP 403
AND no database mutation SHALL occur
AND the rejection SHALL be logged for audit purposes
```

### Trade Failure (Insufficient Resources)
```gherkin
GIVEN character A offering 500 gold but only possessing 300 gold
WHEN the trade is submitted
THEN the system SHALL reject the trade
AND return error: "Insufficient gold: attempted 500, available 300"
AND no inventory or gold mutation SHALL occur
```

### Trade Conflict (Item No Longer Available)
```gherkin
GIVEN character A has initiated a trade offer containing a specific item
WHEN another transaction removes that item from A's inventory before trade acceptance
THEN the trade SHALL be automatically invalidated
AND the receiving player SHALL be notified: "Trade invalidated: item no longer available"
AND A SHALL be prompted to update the trade offer
```

### Rate Limit on Trade Requests
```gherkin
GIVEN a player rapidly submitting multiple trade requests
WHEN the rate limit threshold is exceeded (5 trades per minute per player)
THEN subsequent trade requests SHALL be rejected with HTTP 429
AND the player SHALL be notified: "Trade rate limit exceeded. Wait before retrying."
```

### GM Message to Offline Player
```gherkin
GIVEN a GM sending a direct message to a player who is currently offline
WHEN the message is submitted
THEN the message SHALL be persisted to the recipient's message history
AND the message SHALL be queued for delivery upon the player's next connection
AND the GM SHALL receive confirmation: "Message queued for delivery"
```
