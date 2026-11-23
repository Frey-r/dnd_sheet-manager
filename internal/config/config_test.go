package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDefaultsJWTLifetimes(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	yaml := "server:\n  port: 8080\ndatabase:\n  dsn: postgres://x\nredis:\n  addr: localhost:6379\njwt:\n  secret: 0123456789abcdef0123456789abcdef\n"
	if err := os.WriteFile(path, []byte(yaml), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("JWT_TTL", "")
	t.Setenv("JWT_REFRESH_TTL", "")
	cfg, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.JWT.TTL != DefaultJWTTTL || cfg.JWT.RefreshTTL != DefaultJWTRefreshTTL {
		t.Fatalf("got ttl=%d refresh=%d", cfg.JWT.TTL, cfg.JWT.RefreshTTL)
	}
}
