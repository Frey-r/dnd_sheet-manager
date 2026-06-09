# Security, Access Control & Rate Limiting

## JWT Handshake Protection

- Sending JWT tokens in the URL query string **MUST NOT** be supported or documented, to mitigate leaks in proxies or logs.
- The JWT **MUST** be transmitted exclusively in the `Authorization: Bearer <token>` header for REST calls and in the first WebSocket JSON frame for WS connections.
- Tokens **MUST** have a configurable TTL (default: 1 hour) and **SHALL** include the user's role (`gm` or `player`) and campaign context as claims.

## Role-Based Access Control (RBAC)

### Role Definitions
| Role     | Permissions                                                        |
|----------|--------------------------------------------------------------------|
| `gm`     | Full read/write on all campaign entities, hidden plot access       |
| `player` | Read/write on own characters only, read on shared campaign state   |

### Enforcement
- The backend middleware **MUST** validate the assigned role (`gm` or `player`) on every incoming interaction.
- Players **MUST NOT** be allowed to alter other players' character statistics or access hidden plot elements.
- The GM **SHALL** have unrestricted visibility into all campaign state.

### Trade RBAC
- Players **SHALL** only initiate trades involving their own characters.
- Players **SHALL NOT** view pending trade offers involving other players.
- The GM **SHALL** have read-only visibility into all trade logs and pending offers.

```gherkin
GIVEN a player with role "player" in campaign X
WHEN they attempt to modify another player's character sheet
THEN the middleware SHALL reject the request with HTTP 403
AND the rejection SHALL be logged with user ID, campaign ID, and timestamp
```

```gherkin
GIVEN a user with role "gm" in campaign X
WHEN they access hidden plot data via any endpoint
THEN the middleware SHALL allow access
AND the response SHALL include the hidden plot data
```

## Rate Limiting

### REST Routes
- All REST routes **MUST** be protected by a Token Bucket algorithm.
- Default rate: 100 requests per minute per user.
- Burst capacity **SHALL** be configurable per endpoint category.

### WebSocket Messages
- WebSocket connections **SHALL** be limited to a maximum of 5 messages per second.
- Upon policy violation, the server **MUST** immediately close the connection with status code 1008 (Policy Violation).

```gherkin
GIVEN a WebSocket client sending messages
WHEN the client exceeds 5 messages within a 1-second window
THEN the server SHALL close the connection with close code 1008
AND the violation SHALL be logged
AND the client IP SHALL be temporarily blacklisted from reconnecting for 30 seconds
```

### Audit Logging
- All rate limit violations **MUST** be logged.
- All authentication failures **MUST** be logged.
- All RBAC rejections **MUST** be logged.
- Log entries **SHALL** include: timestamp, user ID (if known), IP address, endpoint/action, and reason.
