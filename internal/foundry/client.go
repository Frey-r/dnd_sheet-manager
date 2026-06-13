// Package foundry is a thin REST client for the self-hosted
// foundryvtt-rest-api-relay (https://github.com/ThreeHats/foundryvtt-rest-api-relay).
//
// The relay bridges a Foundry world (running the foundryvtt-rest-api module) to an
// HTTP surface. This backend only ever reads from the relay — sync is one-way
// Foundry -> app (see openspec/specs/foundry-integration.md).
//
// NOTE: the relay's public docs are sparse. All endpoint paths are centralised in
// the constants below so they are a single point of change if a relay version
// expects a different routing prefix.
package foundry

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"dnd-campaign-manager/internal/config"
)

const (
	pathClients   = "/clients"
	pathSearch    = "/search"
	pathGet       = "/get"
	pathStructure = "/structure"
)

// Client talks to the Foundry REST API relay.
type Client struct {
	baseURL  string
	apiKey   string
	clientID string
	http     *http.Client
}

// New builds a Client from the FoundryConfig.
func New(cfg config.FoundryConfig) *Client {
	return &Client{
		baseURL:  strings.TrimRight(cfg.RelayBaseURL, "/"),
		apiKey:   cfg.APIKey,
		clientID: cfg.ClientID,
		http:     &http.Client{Timeout: cfg.TimeoutDuration()},
	}
}

// Document is a relaxed view of a Foundry document returned by the relay.
// Only fields this backend maps are typed; the rest is ignored.
type Document struct {
	UUID         string          `json:"uuid"`
	ID           string          `json:"_id"`
	Name         string          `json:"name"`
	Type         string          `json:"type"`         // dnd5e actor/item type, e.g. "character", "npc", "weapon"
	DocumentType string          `json:"documentType"` // "Actor", "Item", "Scene", "JournalEntry"
	Img          string          `json:"img"`
	System       json.RawMessage `json:"system"`
	Items        []Document      `json:"items"` // embedded items on an Actor

	// Scene-specific
	Background struct {
		Src string `json:"src"`
	} `json:"background"`

	// JournalEntry-specific (Foundry v10+ uses pages)
	Pages []struct {
		Name string `json:"name"`
		Text struct {
			Content string `json:"content"`
		} `json:"text"`
	} `json:"pages"`
	Content string `json:"content"` // legacy single-content journal entries
}

// ClientInfo describes a connected Foundry world.
type ClientInfo struct {
	ClientID  string `json:"clientId"`
	World     string `json:"world"`
	Connected bool   `json:"connected"`
}

func (c *Client) do(ctx context.Context, path string, query url.Values) ([]byte, error) {
	// The relay scopes most endpoints to a connected world via the clientId query
	// param (only /clients is exempt).
	if c.clientID != "" && path != pathClients {
		if query == nil {
			query = url.Values{}
		}
		if query.Get("clientId") == "" {
			query.Set("clientId", c.clientID)
		}
	}
	u := c.baseURL + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("foundry relay request to %s: %w", path, err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("foundry relay %s returned %d: %s", path, resp.StatusCode, truncate(string(body), 300))
	}
	return body, nil
}

// Health verifies the relay is reachable and the configured world is connected.
func (c *Client) Health(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_, err := c.do(ctx, pathClients, nil)
	return err
}

// Clients lists the worlds currently connected to the relay.
func (c *Client) Clients(ctx context.Context) ([]ClientInfo, error) {
	body, err := c.do(ctx, pathClients, nil)
	if err != nil {
		return nil, err
	}
	// Accept either {"clients":[...]} or a bare array.
	var wrapped struct {
		Clients []ClientInfo `json:"clients"`
	}
	if err := json.Unmarshal(body, &wrapped); err == nil && wrapped.Clients != nil {
		return wrapped.Clients, nil
	}
	var arr []ClientInfo
	if err := json.Unmarshal(body, &arr); err != nil {
		return nil, fmt.Errorf("decoding clients: %w", err)
	}
	return arr, nil
}

// SearchOpts controls a relay /search call. The relay includes compendium results
// by default; set ExcludeCompendiums for world-only queries (e.g. live actors).
type SearchOpts struct {
	DocumentType       string // "Actor", "Scene", "JournalEntry", "Item"
	SubType            string // dnd5e subtype, e.g. "spell", "class", "npc"
	ExcludeCompendiums bool
}

// Search returns documents matching the given filter. An empty query browses all
// entities matching the filter.
func (c *Client) Search(ctx context.Context, opts SearchOpts) ([]Document, error) {
	filter := "documentType:" + opts.DocumentType
	if opts.SubType != "" {
		filter += ",subType:" + opts.SubType
	}
	q := url.Values{}
	q.Set("query", "")
	q.Set("filter", filter)
	q.Set("limit", "500")
	if opts.ExcludeCompendiums {
		q.Set("excludeCompendiums", "true")
	}
	body, err := c.do(ctx, pathSearch, q)
	if err != nil {
		return nil, err
	}
	return decodeDocuments(body)
}

// Get fetches a single document (with embedded items) by its Foundry UUID.
func (c *Client) Get(ctx context.Context, uuid string) (*Document, error) {
	q := url.Values{}
	q.Set("uuid", uuid)
	body, err := c.do(ctx, pathGet, q)
	if err != nil {
		return nil, err
	}
	// Accept {"entity":{...}}, {"result":{...}} or the document directly.
	var wrapped struct {
		Entity *Document `json:"entity"`
		Result *Document `json:"result"`
		Data   *Document `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapped); err == nil {
		if wrapped.Entity != nil {
			return wrapped.Entity, nil
		}
		if wrapped.Result != nil {
			return wrapped.Result, nil
		}
		if wrapped.Data != nil {
			return wrapped.Data, nil
		}
	}
	var doc Document
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("decoding document %s: %w", uuid, err)
	}
	return &doc, nil
}

// decodeDocuments tolerates the common relay shapes for a list of documents.
func decodeDocuments(body []byte) ([]Document, error) {
	var wrapped struct {
		Results  []Document `json:"results"`
		Entities []Document `json:"entities"`
		Data     []Document `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapped); err == nil {
		switch {
		case wrapped.Results != nil:
			return wrapped.Results, nil
		case wrapped.Entities != nil:
			return wrapped.Entities, nil
		case wrapped.Data != nil:
			return wrapped.Data, nil
		}
	}
	var arr []Document
	if err := json.Unmarshal(body, &arr); err != nil {
		return nil, fmt.Errorf("decoding documents: %w", err)
	}
	return arr, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
