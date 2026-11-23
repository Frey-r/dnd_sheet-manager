package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// Login/register are rate limited per client IP (the per-user limiter never sees them),
// and with no trusted proxy a forged X-Forwarded-For must not mint a fresh bucket.
func TestAuthIPRateLimitIgnoresSpoofedForwardedFor(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rl := NewRateLimiter(60).WithBursts(map[string]int{CategoryAuth: 2})
	r := gin.New()
	if err := r.SetTrustedProxies(nil); err != nil {
		t.Fatal(err)
	}
	r.POST("/api/auth/login", AuthIPRateLimit(rl), func(c *gin.Context) { c.Status(http.StatusOK) })

	codes := []int{}
	for i, spoof := range []string{"1.1.1.1", "2.2.2.2", "3.3.3.3"} {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		req.RemoteAddr = "10.0.0.5:4000"
		req.Header.Set("X-Forwarded-For", spoof)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		codes = append(codes, w.Code)
		if i == 2 && w.Header().Get("Retry-After") == "" {
			t.Error("429 without Retry-After")
		}
	}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != http.StatusTooManyRequests {
		t.Fatalf("codes = %v, want [200 200 429]: rotating X-Forwarded-For must not reset the bucket", codes)
	}

	// A different real peer has its own bucket.
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	req.RemoteAddr = "10.0.0.6:4000"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("other peer got %d, want 200", w.Code)
	}
}

// POST /campaigns/0/join resolves the campaign by join code; the RBAC middleware must let
// it through instead of rejecting the placeholder id (players do not know the id yet).
func TestRBACLetsJoinThroughWithoutCampaignID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	reached := false
	r.POST("/api/campaigns/:id/join", func(c *gin.Context) { c.Set("user_id", int64(7)) }, RBACMiddleware(nil), func(c *gin.Context) {
		reached = true
		c.Status(http.StatusOK)
	})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/campaigns/0/join", nil))
	if w.Code != http.StatusOK || !reached {
		t.Fatalf("join with id 0: status %d reached=%v, want 200 and handler reached", w.Code, reached)
	}
}

// Mixing categories must not multiply the sustained budget: with 10 req/min and burst 10
// per category, alternating GET and POST is still capped at 10 requests in total.
func TestRateLimitTotalBudgetSharedAcrossCategories(t *testing.T) {
	gin.SetMode(gin.TestMode)
	clock := &fakeClock{t: time.Unix(1000, 0)}
	rl := newRateLimiter(10, clock.now).WithBursts(map[string]int{CategoryRead: 10, CategoryWrite: 10})
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("user_id", int64(42)) }, RateLimitMiddleware(rl))
	r.Any("/api/things", func(c *gin.Context) { c.Status(http.StatusOK) })

	ok := 0
	for i := 0; i < 20; i++ {
		method := http.MethodGet
		if i%2 == 1 {
			method = http.MethodPost
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(method, "/api/things", nil))
		if w.Code == http.StatusOK {
			ok++
		}
	}
	if ok != 10 {
		t.Fatalf("allowed %d mixed requests, want 10 (requests_per_minute is a per-user total)", ok)
	}
}
