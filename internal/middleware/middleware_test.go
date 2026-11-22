package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (f *fakeClock) now() time.Time { f.mu.Lock(); defer f.mu.Unlock(); return f.t }
func (f *fakeClock) advance(d time.Duration) {
	f.mu.Lock()
	f.t = f.t.Add(d)
	f.mu.Unlock()
}

func TestTokenBucketBurstAndRefill(t *testing.T) {
	clock := &fakeClock{t: time.Unix(1000, 0)}
	tb := newTokenBucket(3, 1, clock.now) // burst 3, 1 token/s
	for i := 0; i < 3; i++ {
		if !tb.Allow() {
			t.Fatalf("request %d within burst rejected", i)
		}
	}
	if tb.Allow() {
		t.Fatal("request over burst allowed")
	}
	clock.advance(2 * time.Second)
	if !tb.Allow() || !tb.Allow() {
		t.Fatal("tokens should have refilled")
	}
	if tb.Allow() {
		t.Fatal("only two tokens should have refilled")
	}
}

func TestRateLimiterPerCategoryBurstAndUserIsolation(t *testing.T) {
	clock := &fakeClock{t: time.Unix(1000, 0)}
	rl := newRateLimiter(60, clock.now).WithBursts(map[string]int{CategoryAuth: 2})
	if !rl.AllowCategory(1, CategoryAuth) || !rl.AllowCategory(1, CategoryAuth) {
		t.Fatal("auth burst of 2 should pass")
	}
	if rl.AllowCategory(1, CategoryAuth) {
		t.Fatal("third auth request should be limited")
	}
	if !rl.AllowCategory(1, CategoryRead) {
		t.Fatal("read category must not share the auth bucket")
	}
	if !rl.AllowCategory(2, CategoryAuth) {
		t.Fatal("other users must not share a bucket")
	}
	allowed := 0
	for i := 0; i < 100; i++ {
		if rl.AllowCategory(3, CategoryWrite) {
			allowed++
		}
	}
	if allowed != 60 {
		t.Fatalf("default burst allowed %d, want 60", allowed)
	}
}

func TestRequestCategory(t *testing.T) {
	cases := []struct{ method, path, want string }{
		{"POST", "/api/auth/login", CategoryAuth},
		{"POST", "/api/foundry/sync", CategoryFoundry},
		{"GET", "/api/campaigns/1", CategoryRead},
		{"PUT", "/api/characters/1", CategoryWrite},
	}
	for _, c := range cases {
		if got := RequestCategory(c.method, c.path); got != c.want {
			t.Errorf("%s %s = %s, want %s", c.method, c.path, got, c.want)
		}
	}
}

func TestPerUserLimitReturns429WithRetryAfter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("user_id", int64(7)); c.Next() })
	r.POST("/sync", PerUserLimit("foundry-sync", 5), func(c *gin.Context) { c.Status(http.StatusOK) })
	var last *httptest.ResponseRecorder
	for i := 0; i < 6; i++ {
		last = httptest.NewRecorder()
		r.ServeHTTP(last, httptest.NewRequest(http.MethodPost, "/sync", nil))
		if i < 5 && last.Code != http.StatusOK {
			t.Fatalf("request %d = %d", i, last.Code)
		}
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("6th request = %d, want 429", last.Code)
	}
	if secs, err := strconv.Atoi(last.Header().Get("Retry-After")); err != nil || secs < 1 {
		t.Fatalf("bad Retry-After %q", last.Header().Get("Retry-After"))
	}
}

func TestAuditRingBoundedAndOrdered(t *testing.T) {
	ring := NewAuditRing(3)
	for i := 1; i <= 5; i++ {
		ring.Add(AuditLog{UserID: int64(i)})
	}
	got := ring.Snapshot()
	if len(got) != 3 || ring.Len() != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	for i, want := range []int64{3, 4, 5} {
		if got[i].UserID != want {
			t.Fatalf("entry %d = user %d, want %d", i, got[i].UserID, want)
		}
	}
	got[0].UserID = 99 // snapshot is a copy
	if ring.Snapshot()[0].UserID != 3 {
		t.Fatal("snapshot aliases internal buffer")
	}
}

func TestAuditRingConcurrent(t *testing.T) {
	ring := NewAuditRing(50)
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 500; i++ {
				ring.Add(AuditLog{UserID: int64(i)})
				_ = ring.Snapshot()
			}
		}()
	}
	wg.Wait()
	if ring.Len() != 50 {
		t.Fatalf("len = %d, want 50", ring.Len())
	}
}

func TestAuditLoggerRecordsSecurityEvents(t *testing.T) {
	gin.SetMode(gin.TestMode)
	SetAuditCapacity(10)
	r := gin.New()
	r.Use(AuditLogger())
	r.Use(func(c *gin.Context) { c.Set("user_id", int64(42)); c.Next() })
	r.GET("/api/campaigns/:id/x", func(c *gin.Context) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
	})
	r.GET("/ok", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/campaigns/9/x", nil))
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/ok", nil))
	logs := GetAuditLogs()
	if len(logs) != 2 {
		t.Fatalf("logs = %d, want 2", len(logs))
	}
	e := logs[0]
	if e.Status != 403 || e.UserID != 42 || e.CampaignID != 9 || e.Reason != "gm membership required" || e.Timestamp == "" {
		t.Fatalf("unexpected entry %+v", e)
	}
	line := FormatSecurityLine(e)
	for _, part := range []string{"event=rbac_rejection", "user_id=42", "campaign_id=9", "ts=", `reason="gm membership required"`} {
		if !strings.Contains(line, part) {
			t.Errorf("line %q missing %q", line, part)
		}
	}
	if logs[1].Reason != "" {
		t.Fatal("successful request must not carry a reason")
	}
}

func TestIPBlacklist(t *testing.T) {
	bl := &IPBlacklist{entries: map[string]time.Time{}}
	if bl.IsBanned("1.2.3.4") {
		t.Fatal("unexpected ban")
	}
	bl.Ban("1.2.3.4", time.Minute)
	if !bl.IsBanned("1.2.3.4") || bl.IsBanned("5.6.7.8") {
		t.Fatal("ban must apply to that IP only")
	}
	bl.Ban("9.9.9.9", -time.Second)
	if bl.IsBanned("9.9.9.9") {
		t.Fatal("expired ban still active")
	}
}
