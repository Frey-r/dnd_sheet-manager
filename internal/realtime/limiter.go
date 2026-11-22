package realtime

import "time"

// msgLimiter is a sliding-window limiter for inbound WebSocket messages: at most
// `limit` messages in any `window` (security.md: 5 msg/s per connection). It is
// owned by a single connection's read loop, so it needs no locking.
type msgLimiter struct {
	limit  int
	window time.Duration
	stamps []time.Time // ring of the last `limit` accepted message times
	head   int         // index of the oldest stamp once the ring is full
	count  int
	now    func() time.Time
}

func newMsgLimiter(limit int, window time.Duration) *msgLimiter {
	return newMsgLimiterClock(limit, window, time.Now)
}

func newMsgLimiterClock(limit int, window time.Duration, now func() time.Time) *msgLimiter {
	if limit < 1 {
		limit = 1
	}
	if window <= 0 {
		window = time.Second
	}
	return &msgLimiter{limit: limit, window: window, stamps: make([]time.Time, limit), now: now}
}

// Allow records a message and reports whether it is within the limit.
func (l *msgLimiter) Allow() bool {
	now := l.now()
	if l.count < l.limit {
		l.stamps[l.count] = now
		l.count++
		return true
	}
	if now.Sub(l.stamps[l.head]) < l.window {
		return false
	}
	l.stamps[l.head] = now
	l.head = (l.head + 1) % l.limit
	return true
}
