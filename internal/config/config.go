package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Database  DatabaseConfig  `yaml:"database"`
	Redis     RedisConfig     `yaml:"redis"`
	JWT       JWTConfig       `yaml:"jwt"`
	Ollama    OllamaConfig    `yaml:"ollama"`
	Worker    WorkerConfig    `yaml:"worker"`
	RateLimit RateLimitConfig `yaml:"rate_limit"`
	Foundry   FoundryConfig   `yaml:"foundry"`
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type DatabaseConfig struct {
	DSN             string `yaml:"dsn"`
	MaxOpenConns    int    `yaml:"max_open_conns"`
	MaxIdleConns    int    `yaml:"max_idle_conns"`
	ConnMaxLifetime int    `yaml:"conn_max_lifetime"`
}

type RedisConfig struct {
	Addr string `yaml:"addr"`
	DB   int    `yaml:"db"`
}

type JWTConfig struct {
	Secret     string `yaml:"secret"`
	TTL        int    `yaml:"ttl"`
	RefreshTTL int    `yaml:"refresh_ttl"`
}

type OllamaConfig struct {
	BaseURL        string `yaml:"base_url"`
	EmbeddingModel string `yaml:"embedding_model"`
	LLMModel       string `yaml:"llm_model"`
	Timeout        int    `yaml:"timeout"`
}

type WorkerConfig struct {
	PoolSize   int `yaml:"pool_size"`
	QueueDepth int `yaml:"queue_depth"`
}

type RateLimitConfig struct {
	RequestsPerMinute   int `yaml:"requests_per_minute"`
	WSMessagesPerSecond int `yaml:"ws_messages_per_second"`
	WSBurstSeconds      int `yaml:"ws_burst_seconds"`
}

// FoundryConfig holds the connection settings for the self-hosted
// foundryvtt-rest-api-relay that bridges the Foundry world to this backend.
// See openspec/specs/foundry-integration.md.
type FoundryConfig struct {
	RelayBaseURL    string `yaml:"relay_base_url"`
	APIKey          string `yaml:"api_key"`
	ClientID        string `yaml:"client_id"`
	DefaultLoreTier string `yaml:"default_lore_tier"`
	SyncCompendium  bool   `yaml:"sync_compendium"`
	Timeout         int    `yaml:"timeout"`
}

func (c *FoundryConfig) TimeoutDuration() time.Duration {
	if c.Timeout <= 0 {
		return 30 * time.Second
	}
	return time.Duration(c.Timeout) * time.Second
}

// Enabled reports whether the Foundry integration is configured.
func (c *FoundryConfig) Enabled() bool {
	return c.RelayBaseURL != "" && c.APIKey != "" && c.ClientID != ""
}

func (c *OllamaConfig) TimeoutDuration() time.Duration {
	return time.Duration(c.Timeout) * time.Second
}

func (c *DatabaseConfig) ConnMaxLifetimeDuration() time.Duration {
	return time.Duration(c.ConnMaxLifetime) * time.Second
}

func (c *ServerConfig) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config file: %w", err)
	}

	// Secrets MUST be overridable via environment so they are never committed.
	if v := os.Getenv("FOUNDRY_API_KEY"); v != "" {
		cfg.Foundry.APIKey = v
	}
	if v := os.Getenv("FOUNDRY_CLIENT_ID"); v != "" {
		cfg.Foundry.ClientID = v
	}
	if v := os.Getenv("JWT_SECRET"); v != "" {
		cfg.JWT.Secret = v
	}

	return &cfg, nil
}
