package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type TokenBucket struct {
	tokens       float64
	maxTokens    float64
	refillRate   float64 // tokens per second
	lastRefill   time.Time
	mu           sync.Mutex
}

func NewTokenBucket(maxTokens float64, refillRate float64) *TokenBucket {
	return &TokenBucket{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens = min(tb.maxTokens, tb.tokens+elapsed*tb.refillRate)
	tb.lastRefill = now

	if tb.tokens >= 1 {
		tb.tokens--
		return true
	}
	return false
}

type RateLimiter struct {
	buckets    map[int64]*TokenBucket
	mu         sync.RWMutex
	maxTokens  float64
	refillRate float64
	cleanup    time.Duration
}

func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	rl := &RateLimiter{
		buckets:    make(map[int64]*TokenBucket),
		maxTokens:  float64(requestsPerMinute),
		refillRate: float64(requestsPerMinute) / 60.0,
		cleanup:    5 * time.Minute,
	}

	// Start cleanup goroutine
	go rl.cleanupLoop()

	return rl
}

func (rl *RateLimiter) Allow(userID int64) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	bucket, exists := rl.buckets[userID]
	if !exists {
		bucket = NewTokenBucket(rl.maxTokens, rl.refillRate)
		rl.buckets[userID] = bucket
	}

	return bucket.Allow()
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanup)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for userID, bucket := range rl.buckets {
			bucket.mu.Lock()
			if now.Sub(bucket.lastRefill) > rl.cleanup {
				delete(rl.buckets, userID)
			}
			bucket.mu.Unlock()
		}
		rl.mu.Unlock()
	}
}

func RateLimitMiddleware(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)
		if userID == 0 {
			c.Next()
			return
		}

		if !rl.Allow(userID) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}

		c.Next()
	}
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