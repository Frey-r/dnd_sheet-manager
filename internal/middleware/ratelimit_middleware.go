package middleware

import (
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Endpoint categories for per-category burst capacity (security.md -> Rate Limiting).
const (
	CategoryAuth    = "auth"
	CategoryRead    = "read"
	CategoryWrite   = "write"
	CategoryFoundry = "foundry"
)

type TokenBucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	now        func() time.Time
	mu         sync.Mutex
}

func NewTokenBucket(maxTokens float64, refillRate float64) *TokenBucket {
	return newTokenBucket(maxTokens, refillRate, time.Now)
}

func newTokenBucket(maxTokens, refillRate float64, now func() time.Time) *TokenBucket {
	return &TokenBucket{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: now(),
		now:        now,
	}
}

func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := tb.now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens = math.Min(tb.maxTokens, tb.tokens+elapsed*tb.refillRate)
	tb.lastRefill = now

	if tb.tokens >= 1 {
		tb.tokens--
		return true
	}
	return false
}

// retryAfter estimates seconds until one token is available.
func (tb *TokenBucket) retryAfter() int {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	if tb.refillRate <= 0 {
		return 60
	}
	need := 1 - tb.tokens
	if need <= 0 {
		return 1
	}
	return int(math.Ceil(need / tb.refillRate))
}

// RateLimiter is a per-user, per-category token bucket. The sustained rate is
// requestsPerMinute; the burst capacity of each category is configurable.
type RateLimiter struct {
	buckets    map[string]*TokenBucket
	mu         sync.Mutex
	maxTokens  float64
	refillRate float64
	bursts     map[string]float64
	cleanup    time.Duration
	now        func() time.Time
}

func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	rl := newRateLimiter(requestsPerMinute, time.Now)
	go rl.cleanupLoop()
	return rl
}

func newRateLimiter(requestsPerMinute int, now func() time.Time) *RateLimiter {
	return &RateLimiter{
		buckets:    make(map[string]*TokenBucket),
		maxTokens:  float64(requestsPerMinute),
		refillRate: float64(requestsPerMinute) / 60.0,
		bursts:     map[string]float64{},
		cleanup:    5 * time.Minute,
		now:        now,
	}
}

// WithBursts sets the burst capacity per category (e.g. {"auth": 20, "foundry": 10}).
// Categories without an entry use the requestsPerMinute value as burst.
func (rl *RateLimiter) WithBursts(bursts map[string]int) *RateLimiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for category, burst := range bursts {
		if burst > 0 {
			rl.bursts[category] = float64(burst)
		}
	}
	return rl
}

func (rl *RateLimiter) burstFor(category string) float64 {
	if b, ok := rl.bursts[category]; ok {
		return b
	}
	return rl.maxTokens
}

// Allow checks the default (uncategorised) bucket of a user.
func (rl *RateLimiter) Allow(userID int64) bool {
	return rl.AllowCategory(userID, "")
}

// AllowCategory consumes one token from the user's bucket for the given category.
func (rl *RateLimiter) AllowCategory(userID int64, category string) bool {
	allowed, _ := rl.take(userID, category)
	return allowed
}

func (rl *RateLimiter) take(userID int64, category string) (bool, int) {
	return rl.takeKey(strconv.FormatInt(userID, 10), category)
}

func (rl *RateLimiter) takeKey(subject, category string) (bool, int) {
	key := subject + "|" + category
	rl.mu.Lock()
	bucket, exists := rl.buckets[key]
	if !exists {
		bucket = newTokenBucket(rl.burstFor(category), rl.refillRate, rl.now)
		rl.buckets[key] = bucket
	}
	rl.mu.Unlock()
	if bucket.Allow() {
		return true, 0
	}
	return false, bucket.retryAfter()
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()
	for range ticker.C {
		rl.purge()
	}
}

func (rl *RateLimiter) purge() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := rl.now()
	for key, bucket := range rl.buckets {
		bucket.mu.Lock()
		if now.Sub(bucket.lastRefill) > rl.cleanup {
			delete(rl.buckets, key)
		}
		bucket.mu.Unlock()
	}
}

// RequestCategory classifies a request for burst purposes.
func RequestCategory(method, path string) string {
	switch {
	case strings.HasPrefix(path, "/api/auth/"):
		return CategoryAuth
	case strings.HasPrefix(path, "/api/foundry/"):
		return CategoryFoundry
	case method == http.MethodGet || method == http.MethodHead:
		return CategoryRead
	default:
		return CategoryWrite
	}
}

func RateLimitMiddleware(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)
		if userID == 0 {
			c.Next()
			return
		}
		category := RequestCategory(c.Request.Method, c.Request.URL.Path)
		if allowed, retry := rl.take(userID, category); !allowed {
			rejectRateLimited(c, "rate limit exceeded ("+category+")", retry)
			return
		}
		// Each category bucket only shapes bursts; every bucket refills at the full rate, so
		// without a shared budget a user mixing reads and writes could sustain a multiple of
		// requests_per_minute. The uncategorised bucket is that per-user total.
		if allowed, retry := rl.take(userID, ""); !allowed {
			rejectRateLimited(c, "rate limit exceeded (total)", retry)
			return
		}
		c.Next()
	}
}

// AuthIPRateLimit limits the unauthenticated auth endpoints (login, register, refresh)
// per client IP with the "auth" burst, so credential stuffing cannot bypass the per-user
// limiter (which only sees authenticated requests). The IP is reliable only because the
// router sets explicit trusted proxies (server.trusted_proxies).
func AuthIPRateLimit(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if allowed, retry := rl.takeKey("ip:"+c.ClientIP(), CategoryAuth); !allowed {
			rejectRateLimited(c, "rate limit exceeded (auth, per ip)", retry)
			return
		}
		c.Next()
	}
}

// PerUserLimit returns a middleware enforcing a dedicated per-user limit (requests
// per minute) under its own bucket name, e.g. 5 req/min for Foundry sync.
func PerUserLimit(name string, requestsPerMinute int) gin.HandlerFunc {
	rl := NewRateLimiter(requestsPerMinute)
	return func(c *gin.Context) {
		userID := GetUserID(c)
		if userID == 0 {
			c.Next()
			return
		}
		if allowed, retry := rl.take(userID, name); !allowed {
			rejectRateLimited(c, "rate limit exceeded ("+name+")", retry)
			return
		}
		c.Next()
	}
}

func rejectRateLimited(c *gin.Context, reason string, retryAfter int) {
	if retryAfter < 1 {
		retryAfter = 1
	}
	SetAuditReason(c, reason)
	c.Header("Retry-After", strconv.Itoa(retryAfter))
	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded", "retry_after": retryAfter})
}

type IPBlacklist struct {
	entries map[string]time.Time
	mu      sync.RWMutex
}

func NewIPBlacklist() *IPBlacklist {
	bl := &IPBlacklist{entries: make(map[string]time.Time)}
	go bl.cleanupLoop()
	return bl
}

func (bl *IPBlacklist) IsBanned(ip string) bool {
	bl.mu.RLock()
	defer bl.mu.RUnlock()
	if exp, exists := bl.entries[ip]; exists && time.Now().Before(exp) {
		return true
	}
	return false
}

func (bl *IPBlacklist) Ban(ip string, duration time.Duration) {
	bl.mu.Lock()
	defer bl.mu.Unlock()
	bl.entries[ip] = time.Now().Add(duration)
}

func (bl *IPBlacklist) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		bl.mu.Lock()
		now := time.Now()
		for ip, exp := range bl.entries {
			if now.After(exp) {
				delete(bl.entries, ip)
			}
		}
		bl.mu.Unlock()
	}
}
