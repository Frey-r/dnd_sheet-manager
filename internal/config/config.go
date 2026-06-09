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
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type DatabaseConfig struct {
	DSN            string `yaml:"dsn"`
	MaxOpenConns   int    `yaml:"max_open_conns"`
	MaxIdleConns   int    `yaml:"max_idle_conns"`
	ConnMaxLifetime int   `yaml:"conn_max_lifetime"`
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
	PoolSize    int `yaml:"pool_size"`
	QueueDepth  int `yaml:"queue_depth"`
}

type RateLimitConfig struct {
	RequestsPerMinute   int `yaml:"requests_per_minute"`
	WSMessagesPerSecond int `yaml:"ws_messages_per_second"`
	WSBurstSeconds      int `yaml:"ws_burst_seconds"`
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

	return &cfg, nil
}