package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
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
	Host           string   `yaml:"host"`
	Port           int      `yaml:"port"`
	AllowedOrigins []string `yaml:"allowed_origins"`
	FrontendDist   string   `yaml:"frontend_dist"`
	UploadDir      string   `yaml:"upload_dir"`
	// TrustedProxies lists the reverse proxies (IPs/CIDRs) whose X-Forwarded-For is
	// believed. Empty = no proxy: the client IP is the TCP peer, so rate limits, WS bans
	// and audit logs cannot be spoofed with a forged header.
	TrustedProxies []string `yaml:"trusted_proxies"`
}

type DatabaseConfig struct {
	DSN             string `yaml:"dsn"`
	MaxOpenConns    int    `yaml:"max_open_conns"`
	MaxIdleConns    int    `yaml:"max_idle_conns"`
	ConnMaxLifetime int    `yaml:"conn_max_lifetime"`
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
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
	// Burst is the token-bucket capacity per endpoint category (auth, read, write, foundry).
	// Categories not listed use requests_per_minute as burst.
	Burst map[string]int `yaml:"burst"`
	// WSBanSeconds is how long an IP is blocked from reconnecting after a WS rate violation.
	WSBanSeconds int `yaml:"ws_ban_seconds"`
	// FoundrySyncPerMinute limits POST /foundry/sync and /foundry/sync/reference per user.
	FoundrySyncPerMinute int `yaml:"foundry_sync_per_minute"`
	// AuditBufferSize bounds the in-memory audit ring buffer.
	AuditBufferSize int `yaml:"audit_buffer_size"`
}

func (r *RateLimitConfig) applyDefaults() {
	if r.RequestsPerMinute <= 0 {
		r.RequestsPerMinute = 100
	}
	if r.WSMessagesPerSecond <= 0 {
		r.WSMessagesPerSecond = 5
	}
	if r.WSBurstSeconds <= 0 {
		r.WSBurstSeconds = 1
	}
	if r.WSBanSeconds <= 0 {
		r.WSBanSeconds = 30
	}
	if r.FoundrySyncPerMinute <= 0 {
		r.FoundrySyncPerMinute = 5
	}
	if r.AuditBufferSize <= 0 {
		r.AuditBufferSize = 1000
	}
}

type FoundryConfig struct {
	RelayBaseURL    string `yaml:"relay_base_url"`
	APIKey          string `yaml:"api_key"`
	ClientID        string `yaml:"client_id"`
	DefaultLoreTier string `yaml:"default_lore_tier"`
	SyncCompendium  bool   `yaml:"sync_compendium"`
	Timeout         int    `yaml:"timeout"`
	// FrameAncestors lists the origins allowed to embed this app in an iframe
	// (CSP frame-ancestors). Used only when Foundry is enabled; wildcards are rejected.
	FrameAncestors []string `yaml:"frame_ancestors"`
	// MaxRetries is the number of retries for transient relay failures (default 3).
	MaxRetries int `yaml:"max_retries"`
}

// RetryCount returns the bounded number of retries for transient relay failures.
func (c *FoundryConfig) RetryCount() int {
	if c.MaxRetries <= 0 {
		return 3
	}
	if c.MaxRetries > 6 {
		return 6
	}
	return c.MaxRetries
}

func (c *FoundryConfig) TimeoutDuration() time.Duration {
	if c.Timeout <= 0 {
		return 30 * time.Second
	}
	return time.Duration(c.Timeout) * time.Second
}

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

// IsPlaceholderSecret reports whether the JWT secret is still the example value shipped
// in config.yaml. Only the HTTP server refuses it; offline tools (content-import,
// foundry-export) never sign tokens and must keep working with the default config.
func (c *Config) IsPlaceholderSecret() bool {
	return strings.HasPrefix(c.JWT.Secret, "change-this")
}

// Default token lifetimes in seconds (security.md).
const (
	DefaultJWTTTL        = 3600
	DefaultJWTRefreshTTL = 86400
)

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config file: %w", err)
	}

	overrideString("DATABASE_DSN", &cfg.Database.DSN)
	overrideString("REDIS_ADDR", &cfg.Redis.Addr)
	overrideString("REDIS_PASSWORD", &cfg.Redis.Password)
	overrideString("JWT_SECRET", &cfg.JWT.Secret)
	overrideString("SERVER_HOST", &cfg.Server.Host)
	overrideString("FRONTEND_DIST", &cfg.Server.FrontendDist)
	overrideString("UPLOAD_DIR", &cfg.Server.UploadDir)
	overrideString("OLLAMA_BASE_URL", &cfg.Ollama.BaseURL)
	overrideString("OLLAMA_EMBEDDING_MODEL", &cfg.Ollama.EmbeddingModel)
	overrideString("OLLAMA_LLM_MODEL", &cfg.Ollama.LLMModel)
	overrideString("FOUNDRY_RELAY_BASE_URL", &cfg.Foundry.RelayBaseURL)
	overrideString("FOUNDRY_API_KEY", &cfg.Foundry.APIKey)
	overrideString("FOUNDRY_CLIENT_ID", &cfg.Foundry.ClientID)
	overrideInt("SERVER_PORT", &cfg.Server.Port)
	overrideInt("REDIS_DB", &cfg.Redis.DB)
	overrideInt("JWT_TTL", &cfg.JWT.TTL)
	overrideInt("JWT_REFRESH_TTL", &cfg.JWT.RefreshTTL)
	if origins := os.Getenv("ALLOWED_ORIGINS"); origins != "" {
		for _, origin := range strings.Split(origins, ",") {
			cfg.Server.AllowedOrigins = append(cfg.Server.AllowedOrigins, strings.TrimSpace(origin))
		}
	}
	if proxies := os.Getenv("TRUSTED_PROXIES"); proxies != "" {
		for _, proxy := range strings.Split(proxies, ",") {
			if proxy = strings.TrimSpace(proxy); proxy != "" {
				cfg.Server.TrustedProxies = append(cfg.Server.TrustedProxies, proxy)
			}
		}
	}
	// security.md: access tokens default to 1 h and refresh tokens to 24 h when unset, so a
	// missing jwt.ttl never yields a token that expires on issue.
	if cfg.JWT.TTL <= 0 {
		cfg.JWT.TTL = DefaultJWTTTL
	}
	if cfg.JWT.RefreshTTL <= 0 {
		cfg.JWT.RefreshTTL = DefaultJWTRefreshTTL
	}
	if cfg.Server.Port <= 0 || cfg.Server.Port > 65535 {
		return nil, fmt.Errorf("server.port must be between 1 and 65535")
	}
	if cfg.Database.DSN == "" || cfg.Redis.Addr == "" {
		return nil, fmt.Errorf("database.dsn and redis.addr are required")
	}
	if len(cfg.JWT.Secret) < 32 {
		return nil, fmt.Errorf("jwt.secret must contain at least 32 characters")
	}
	if origins := os.Getenv("FOUNDRY_FRAME_ANCESTORS"); origins != "" {
		cfg.Foundry.FrameAncestors = nil
		for _, origin := range strings.Split(origins, ",") {
			if origin = strings.TrimSpace(origin); origin != "" {
				cfg.Foundry.FrameAncestors = append(cfg.Foundry.FrameAncestors, origin)
			}
		}
	}
	for _, origin := range cfg.Foundry.FrameAncestors {
		if strings.Contains(origin, "*") {
			return nil, fmt.Errorf("foundry.frame_ancestors must not contain wildcards (security.md)")
		}
	}
	cfg.RateLimit.applyDefaults()
	if cfg.Server.FrontendDist == "" {
		cfg.Server.FrontendDist = "frontend/dist"
	}
	if cfg.Server.UploadDir == "" {
		cfg.Server.UploadDir = "data/uploads"
	}
	if len(cfg.Server.AllowedOrigins) == 0 {
		cfg.Server.AllowedOrigins = []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080", "http://127.0.0.1:8080"}
	}
	return &cfg, nil
}

func overrideString(key string, target *string) {
	if value := os.Getenv(key); value != "" {
		*target = value
	}
}

func overrideInt(key string, target *int) {
	if value, err := strconv.Atoi(os.Getenv(key)); err == nil && value != 0 {
		*target = value
	}
}
