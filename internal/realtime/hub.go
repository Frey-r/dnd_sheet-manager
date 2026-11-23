package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/pubsub"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jmoiron/sqlx"
)

type Client struct {
	UserID     int64
	CampaignID int64
	Conn       *websocket.Conn
	Send       chan []byte
	closeOnce  sync.Once
}

type Hub struct {
	db         *sqlx.DB
	redis      *pubsub.RedisPubSub
	auth       *service.AuthService
	campaigns  *service.CampaignService
	upgrader   websocket.Upgrader
	mu         sync.RWMutex
	clients    map[int64]map[*Client]struct{}
	subscribed map[int64]bool
	handlers   map[string]InboundHandler

	blacklist *middleware.IPBlacklist
	msgLimit  int
	msgWindow time.Duration
	banFor    time.Duration
	closing   bool
}

const (
	pingInterval = 30 * time.Second // resilience.md: Ping every 30s
	pongGrace    = 10 * time.Second // ...and 10s grace to answer

	// heartbeatType is the text frame sent with every ping; clients close the socket after two
	// missed heartbeats.
	heartbeatType = "heartbeat"

	moveMessageType       = "vtt.move"
	moveMessagesPerSecond = 15 // client throttles to one move per 120ms (~8/s); headroom for jitter
)

var heartbeatFrame = []byte(`{"type":"` + heartbeatType + `"}`)

// Configure applies the rate-limit settings (messages/second, window, ban length)
// and optionally a shared IP blacklist. Defaults are 5 msg/1s and a 30s ban.
func (h *Hub) Configure(cfg config.RateLimitConfig, blacklist *middleware.IPBlacklist) {
	h.mu.Lock()
	defer h.mu.Unlock()
	window := time.Duration(cfg.WSBurstSeconds) * time.Second
	if window <= 0 {
		window = time.Second
	}
	perSecond := cfg.WSMessagesPerSecond
	if perSecond <= 0 {
		perSecond = 5
	}
	h.msgLimit = perSecond * int(window/time.Second)
	h.msgWindow = window
	if cfg.WSBanSeconds > 0 {
		h.banFor = time.Duration(cfg.WSBanSeconds) * time.Second
	}
	if blacklist != nil {
		h.blacklist = blacklist
	}
}

// Shutdown stops accepting new sockets and closes every open one with 1001 (Going Away).
func (h *Hub) Shutdown() {
	h.mu.Lock()
	h.closing = true
	var all []*Client
	for _, clients := range h.clients {
		for client := range clients {
			all = append(all, client)
		}
	}
	h.mu.Unlock()
	deadline := time.Now().Add(time.Second)
	for _, client := range all {
		_ = client.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseGoingAway, "server shutting down"), deadline)
		_ = client.Conn.Close()
	}
}

func (h *Hub) isClosing() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.closing
}

// InboundHandler processes a client message of a given type (e.g. "vtt.move").
type InboundHandler func(ctx context.Context, userID, campaignID int64, data json.RawMessage)

// On registers a handler for inbound WebSocket messages of msgType.
func (h *Hub) On(msgType string, fn InboundHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.handlers[msgType] = fn
}

// Broadcast fans out an ephemeral event (not stored in the event log).
func (h *Hub) Broadcast(ctx context.Context, campaignID int64, eventType string, payload any) error {
	return pubsub.PublishCampaignEvent(ctx, h.redis, campaignID, eventType, map[string]any{"data": payload})
}

// BroadcastTo fans out an ephemeral event to the listed users only (e.g. GM-only notifications).
func (h *Hub) BroadcastTo(ctx context.Context, campaignID int64, userIDs []int64, eventType string, payload any) error {
	return pubsub.PublishCampaignEventTo(ctx, h.redis, campaignID, userIDs, eventType, map[string]any{"data": payload})
}

func NewHub(db *sqlx.DB, redis *pubsub.RedisPubSub, auth *service.AuthService, campaigns *service.CampaignService, origins []string) *Hub {
	allowed := map[string]bool{}
	for _, origin := range origins {
		allowed[origin] = true
	}
	return &Hub{db: db, redis: redis, auth: auth, campaigns: campaigns, clients: map[int64]map[*Client]struct{}{}, subscribed: map[int64]bool{}, handlers: map[string]InboundHandler{}, blacklist: middleware.NewIPBlacklist(), msgLimit: 5, msgWindow: time.Second, banFor: 30 * time.Second, upgrader: websocket.Upgrader{
		ReadBufferSize: 4096, WriteBufferSize: 4096,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if allowed[origin] || allowed["*"] {
				return true
			}
			// Same-origin: the SPA served by this server, reached through any LAN address.
			u, err := url.Parse(origin)
			return err == nil && u.Host == r.Host
		},
	}}
}

func (h *Hub) Handle(c *gin.Context) {
	if h.isClosing() {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "server shutting down"})
		return
	}
	ip := c.ClientIP()
	if h.blacklist.IsBanned(ip) {
		middleware.SetAuditReason(c, "websocket reconnect blocked: ip temporarily banned after rate violation")
		c.Header("Retry-After", strconv.Itoa(int(h.banFor/time.Second)))
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "temporarily blocked"})
		return
	}
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	conn.SetReadLimit(16 * 1024)
	_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	var frame struct {
		Token       string `json:"token"`
		CampaignID  int64  `json:"campaign_id"`
		LastEventID int64  `json:"last_event_id"`
	}
	if err := conn.ReadJSON(&frame); err != nil {
		h.logWSReject(ip, 0, 0, 401, "websocket authentication frame missing or invalid")
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(4001, "authentication required"), time.Now().Add(time.Second))
		return
	}
	claims, err := h.auth.ValidateToken(frame.Token)
	if err != nil {
		h.logWSReject(ip, 0, frame.CampaignID, 401, "websocket token invalid or expired")
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(4001, "unauthorized"), time.Now().Add(time.Second))
		return
	}
	member, err := h.campaigns.IsMember(c.Request.Context(), frame.CampaignID, claims.UserID)
	if err != nil || !member {
		h.logWSReject(ip, claims.UserID, frame.CampaignID, 403, "websocket campaign membership required")
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(4003, "campaign membership required"), time.Now().Add(time.Second))
		return
	}
	client := &Client{UserID: claims.UserID, CampaignID: frame.CampaignID, Conn: conn, Send: make(chan []byte, 256)}
	if err := h.subscribe(frame.CampaignID); err != nil {
		return
	}
	h.add(client)
	defer h.remove(client)
	go h.write(client)
	// Heartbeat (resilience.md): the server pings every pingInterval; a pong must
	// arrive within pongGrace of the ping (see write), otherwise the read fails and
	// the session is purged by the deferred remove.
	_ = conn.SetReadDeadline(time.Now().Add(pingInterval + pongGrace))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(pingInterval + pongGrace)) })
	if msg, err := json.Marshal(map[string]any{"type": "AUTH_SUCCESS", "campaign_id": frame.CampaignID, "payload": map[string]any{"user_id": claims.UserID}, "timestamp": time.Now().UnixMilli()}); err == nil {
		client.Send <- msg
	}
	h.sync(client, frame.LastEventID)
	h.mu.RLock()
	limiter := newMsgLimiter(h.msgLimit, h.msgWindow)
	h.mu.RUnlock()
	// Exploration movement streams vtt.move at ~8 Hz by design (vtt-modes.md), above the
	// generic 5 msg/s of security.md, so it has its own budget instead of tripping the ban.
	moveLimiter := newMsgLimiter(moveMessagesPerSecond, time.Second)
	for {
		var message struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		}
		if err := conn.ReadJSON(&message); err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				log.Printf("ws: dead connection purged (no pong within %s) user_id=%d campaign_id=%d", pongGrace, client.UserID, client.CampaignID)
			}
			return
		}
		allowed := false
		if message.Type == moveMessageType {
			allowed = moveLimiter.Allow()
		} else {
			allowed = limiter.Allow()
		}
		if !allowed {
			h.policyViolation(client, ip)
			return
		}
		if message.Type == "sync" {
			h.sync(client, frame.LastEventID)
			continue
		}
		h.mu.RLock()
		handler := h.handlers[message.Type]
		h.mu.RUnlock()
		if handler != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			handler(ctx, client.UserID, client.CampaignID, message.Data)
			cancel()
		}
	}
}

// policyViolation closes the socket with 1008, logs it and bans the IP from reconnecting.
func (h *Hub) policyViolation(client *Client, ip string) {
	h.blacklist.Ban(ip, h.banFor)
	h.logWSReject(ip, client.UserID, client.CampaignID, 429, "websocket rate limit exceeded; closed with 1008; ip banned "+h.banFor.String())
	_ = client.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "rate limit exceeded"), time.Now().Add(time.Second))
}

func (h *Hub) logWSReject(ip string, userID, campaignID int64, status int, reason string) {
	middleware.LogSecurityEvent(middleware.AuditLog{
		UserID: userID, CampaignID: campaignID, Action: "WS /ws", IPAddress: ip,
		Timestamp: time.Now().UTC().Format(time.RFC3339), Status: status, Reason: reason,
	})
}

func (h *Hub) add(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[client.CampaignID] == nil {
		h.clients[client.CampaignID] = map[*Client]struct{}{}
	}
	h.clients[client.CampaignID][client] = struct{}{}
}

// IsOnline reports whether the user has an open socket on this campaign (user-stories.md:
// a message to an offline player is answered as "queued for delivery").
func (h *Hub) IsOnline(campaignID, userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients[campaignID] {
		if client.UserID == userID {
			return true
		}
	}
	return false
}

// OnlineUsers lists the distinct users with an open socket on this campaign.
func (h *Hub) OnlineUsers(campaignID int64) []int64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	seen := map[int64]bool{}
	users := []int64{}
	for client := range h.clients[campaignID] {
		if !seen[client.UserID] {
			seen[client.UserID] = true
			users = append(users, client.UserID)
		}
	}
	return users
}

func (h *Hub) remove(client *Client) {
	h.mu.Lock()
	if clients := h.clients[client.CampaignID]; clients != nil {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.clients, client.CampaignID)
		}
	}
	h.mu.Unlock()
	client.closeOnce.Do(func() { close(client.Send) })
}

func (h *Hub) subscribe(campaignID int64) error {
	h.mu.Lock()
	if h.subscribed[campaignID] {
		h.mu.Unlock()
		return nil
	}
	h.subscribed[campaignID] = true
	h.mu.Unlock()
	err := h.redis.SubscribeToCampaign(context.Background(), campaignID, func(message []byte) { h.broadcast(campaignID, message) })
	if err != nil {
		h.mu.Lock()
		delete(h.subscribed, campaignID)
		h.mu.Unlock()
	}
	return err
}

func (h *Hub) broadcast(campaignID int64, message []byte) {
	// Targeted events carry a top-level "to" list of user ids; everything else goes to every member.
	var audience map[int64]bool
	if bytes.Contains(message, []byte(`"to":[`)) {
		var env struct {
			To []int64 `json:"to"`
		}
		if json.Unmarshal(message, &env) == nil && len(env.To) > 0 {
			audience = make(map[int64]bool, len(env.To))
			for _, id := range env.To {
				audience[id] = true
			}
		}
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients[campaignID] {
		if audience != nil && !audience[client.UserID] {
			continue
		}
		select {
		case client.Send <- message:
		default:
			go h.remove(client)
		}
	}
}

func (h *Hub) write(client *Client) {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()
	for {
		select {
		case message, ok := <-client.Send:
			if !ok {
				return
			}
			_ = client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if client.Conn.WriteMessage(websocket.TextMessage, message) != nil {
				go h.remove(client)
				return
			}
		case <-ticker.C:
			// Pong must arrive within the grace period or the read loop fails and the session
			// is purged. The deadline is set BEFORE the ping goes out: setting it afterwards
			// could overwrite the longer deadline a fast pong already installed.
			_ = client.Conn.SetReadDeadline(time.Now().Add(pongGrace))
			_ = client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if client.Conn.WriteMessage(websocket.PingMessage, nil) != nil {
				go h.remove(client)
				return
			}
			// Browsers do not expose ping/pong to scripts, so an application-level heartbeat
			// lets the client notice a dead link and reconnect (resilience.md).
			if client.Conn.WriteMessage(websocket.TextMessage, heartbeatFrame) != nil {
				go h.remove(client)
				return
			}
		}
	}
}

func (h *Hub) Publish(ctx context.Context, campaignID, userID int64, eventType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	var id int64
	var actor any = userID
	if userID == 0 {
		actor = nil // system events (timers, triggers) have no actor
	}
	if err := h.db.QueryRowContext(ctx, `INSERT INTO game_events(campaign_id,actor_id,event_type,payload) VALUES($1,$2,$3,$4) RETURNING id`, campaignID, actor, eventType, data).Scan(&id); err != nil {
		return err
	}
	message := pubsub.FanoutMessage{Type: eventType, CampaignID: campaignID, Payload: json.RawMessage(data), Timestamp: time.Now().UnixMilli()}
	message.Payload = map[string]any{"event_id": id, "data": payload}
	return pubsub.PublishCampaignEvent(ctx, h.redis, campaignID, eventType, message.Payload)
}

func (h *Hub) sync(client *Client, after int64) {
	rows, err := h.db.QueryContext(context.Background(), `SELECT id,event_type,payload,created_at FROM game_events WHERE campaign_id=$1 AND id>$2 ORDER BY id LIMIT 200`, client.CampaignID, after)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var eventType string
		var payload json.RawMessage
		var created time.Time
		if rows.Scan(&id, &eventType, &payload, &created) != nil {
			return
		}
		message, _ := json.Marshal(map[string]any{"type": eventType, "campaign_id": client.CampaignID, "payload": map[string]any{"event_id": id, "data": payload}, "timestamp": created.UnixMilli()})
		select {
		case client.Send <- message:
		default:
			return
		}
	}
}

func (h *Hub) Sync(c *gin.Context) {
	campaignID := parseCampaignID(c.Param("id"))
	var after int64
	_, _ = fmt.Sscan(c.Query("after"), &after)
	rows, err := h.db.QueryContext(c.Request.Context(), `SELECT id,event_type,payload,created_at FROM game_events WHERE campaign_id=$1 AND id>$2 ORDER BY id LIMIT 200`, campaignID, after)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not synchronize"})
		return
	}
	defer rows.Close()
	events := []map[string]any{}
	for rows.Next() {
		var id int64
		var eventType string
		var payload json.RawMessage
		var created time.Time
		if rows.Scan(&id, &eventType, &payload, &created) != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not synchronize"})
			return
		}
		events = append(events, map[string]any{"event_id": id, "type": eventType, "data": payload, "created_at": created})
	}
	c.JSON(http.StatusOK, events)
}

func parseCampaignID(value string) int64 { var id int64; _, _ = fmt.Sscan(value, &id); return id }
