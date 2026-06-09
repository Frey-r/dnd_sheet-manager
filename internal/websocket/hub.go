package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // allow all origins for now
	},
}

type Client struct {
	ID       string
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	Info     ClientInfo
	mu       sync.RWMutex
}

type Hub struct {
	rooms      map[int64]map[string]*Client // campaignID -> clientID -> Client
	mu         sync.RWMutex
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage
}

type BroadcastMessage struct {
	CampaignID int64
	Message    []byte
	ExcludeID  string // client ID to exclude from broadcast
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[int64]map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMessage),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.rooms[client.Info.CampaignID]; !ok {
				h.rooms[client.Info.CampaignID] = make(map[string]*Client)
			}
			h.rooms[client.Info.CampaignID][client.ID] = client
			h.mu.Unlock()
			log.Printf("Client %s joined campaign %d", client.ID, client.Info.CampaignID)

		case client := <-h.unregister:
			h.mu.Lock()
			if room, ok := h.rooms[client.Info.CampaignID]; ok {
				if _, ok := room[client.ID]; ok {
					delete(room, client.ID)
					close(client.Send)
					log.Printf("Client %s left campaign %d", client.ID, client.Info.CampaignID)
				}
				if len(room) == 0 {
					delete(h.rooms, client.Info.CampaignID)
				}
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			if room, ok := h.rooms[msg.CampaignID]; ok {
				for id, client := range room {
					if id != msg.ExcludeID {
						select {
						case client.Send <- msg.Message:
						default:
							close(client.Send)
							delete(room, id)
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) BroadcastToCampaign(campaignID int64, message []byte, excludeID string) {
	h.broadcast <- &BroadcastMessage{
		CampaignID: campaignID,
		Message:    message,
		ExcludeID:  excludeID,
	}
}

func (h *Hub) SendToUser(campaignID int64, userID int64, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if room, ok := h.rooms[campaignID]; ok {
		for _, client := range room {
			client.mu.RLock()
			if client.Info.UserID == userID {
				select {
				case client.Send <- message:
				default:
				}
			}
			client.mu.RUnlock()
		}
	}
}

func (h *Hub) GetConnectedUsers(campaignID int64) []ClientInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var users []ClientInfo
	if room, ok := h.rooms[campaignID]; ok {
		for _, client := range room {
			client.mu.RLock()
			users = append(users, client.Info)
			client.mu.RUnlock()
		}
	}
	return users
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(4096)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(message []byte) {
	var raw map[string]interface{}
	if err := json.Unmarshal(message, &raw); err != nil {
		return
	}

	msgType, ok := raw["type"].(string)
	if !ok {
		return
	}

	switch MessageType(msgType) {
	case TypePong:
		// Client responding to server ping - no action needed
	case TypeCharacterUpdate:
		c.handleCharacterUpdate(raw)
	case TypeLoreQuery, TypeLoreQueryResult:
		c.handleLoreQuery(raw)
	case TypeTradeOffer:
		c.handleTradeOffer(raw)
	case TypeTradeAccepted, TypeTradeRejected, TypeTradeCancelled:
		c.handleTradeResponse(raw)
	case TypeMessageGM, TypeMessagePlayer:
		c.handleChatMessage(raw)
	}
}

func (c *Client) handleCharacterUpdate(data map[string]interface{}) {
	// Forward to REST handler via internal channel or directly call service
	payload, _ := json.Marshal(data)
	// This would be handled by passing to a channel consumed by the WS handler goroutine
	log.Printf("Character update from client %s: %s", c.ID, string(payload))
}

func (c *Client) handleLoreQuery(data map[string]interface{}) {
	// Forward to RAG worker pool
	payload, _ := json.Marshal(data)
	log.Printf("Lore query from client %s: %s", c.ID, string(payload))
}

func (c *Client) handleTradeOffer(data map[string]interface{}) {
	payload, _ := json.Marshal(data)
	log.Printf("Trade offer from client %s: %s", c.ID, string(payload))
}

func (c *Client) handleTradeResponse(data map[string]interface{}) {
	payload, _ := json.Marshal(data)
	log.Printf("Trade response from client %s: %s", c.ID, string(payload))
}

func (c *Client) handleChatMessage(data map[string]interface{}) {
	payload, _ := json.Marshal(data)
	log.Printf("Chat message from client %s: %s", c.ID, string(payload))
}

func (c *Client) SendJSON(msg WSMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	select {
	case c.Send <- data:
		return nil
	default:
		return nil
	}
}

func HandleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		ID:   generateID(),
		Hub:  hub,
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}

func generateID() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = byte(time.Now().UnixNano() >> uint((i%8)*8) & 0xff)
	}
	return fmt.Sprintf("%x", b)
}