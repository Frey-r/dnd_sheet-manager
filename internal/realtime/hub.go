package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

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

func NewHub(db *sqlx.DB, redis *pubsub.RedisPubSub, auth *service.AuthService, campaigns *service.CampaignService, origins []string) *Hub {
	allowed := map[string]bool{}
	for _, origin := range origins {
		allowed[origin] = true
	}
	return &Hub{db: db, redis: redis, auth: auth, campaigns: campaigns, clients: map[int64]map[*Client]struct{}{}, subscribed: map[int64]bool{}, handlers: map[string]InboundHandler{}, upgrader: websocket.Upgrader{
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
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(4001, "authentication required"), time.Now().Add(time.Second))
		return
	}
	claims, err := h.auth.ValidateToken(frame.Token)
	if err != nil {
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(4001, "unauthorized"), time.Now().Add(time.Second))
		return
	}
	member, err := h.campaigns.IsMember(c.Request.Context(), frame.CampaignID, claims.UserID)
	if err != nil || !member {
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
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	h.sync(client, frame.LastEventID)
	for {
		var message struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		}
		if err := conn.ReadJSON(&message); err != nil {
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

func (h *Hub) add(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[client.CampaignID] == nil {
		h.clients[client.CampaignID] = map[*Client]struct{}{}
	}
	h.clients[client.CampaignID][client] = struct{}{}
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
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients[campaignID] {
		select {
		case client.Send <- message:
		default:
			go h.remove(client)
		}
	}
}

func (h *Hub) write(client *Client) {
	ticker := time.NewTicker(25 * time.Second)
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
			_ = client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if client.Conn.WriteMessage(websocket.PingMessage, nil) != nil {
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
