package middleware

import (
	"bytes"
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type AuditLog struct {
	UserID     int64  `json:"user_id"`
	CampaignID int64  `json:"campaign_id,omitempty"`
	Action     string `json:"action"`
	Details    string `json:"details"`
	IPAddress  string `json:"ip_address"`
	Timestamp  string `json:"timestamp"`
	Status     int    `json:"status,omitempty"`
	Reason     string `json:"reason,omitempty"`
}

const defaultAuditCapacity = 1000

// AuditRing is a bounded, mutex-safe ring buffer of audit entries: once full,
// the oldest entry is overwritten, so memory use is constant.
type AuditRing struct {
	mu    sync.Mutex
	buf   []AuditLog
	start int // index of the oldest entry
	size  int
}

func NewAuditRing(capacity int) *AuditRing {
	if capacity < 1 {
		capacity = defaultAuditCapacity
	}
	return &AuditRing{buf: make([]AuditLog, capacity)}
}

func (r *AuditRing) Add(entry AuditLog) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.size < len(r.buf) {
		r.buf[(r.start+r.size)%len(r.buf)] = entry
		r.size++
		return
	}
	r.buf[r.start] = entry
	r.start = (r.start + 1) % len(r.buf)
}

// Snapshot returns a copy of the entries, oldest first.
func (r *AuditRing) Snapshot() []AuditLog {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]AuditLog, r.size)
	for i := 0; i < r.size; i++ {
		out[i] = r.buf[(r.start+i)%len(r.buf)]
	}
	return out
}

func (r *AuditRing) Len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.size
}

var auditRing = NewAuditRing(defaultAuditCapacity)

// SetAuditCapacity replaces the global ring (call once at startup, before serving).
func SetAuditCapacity(capacity int) { auditRing = NewAuditRing(capacity) }

// GetAuditLogs returns a snapshot of the most recent audit entries, oldest first.
func GetAuditLogs() []AuditLog { return auditRing.Snapshot() }

// SetAuditReason records why a request is being rejected so the audit log can
// include it (used for 401/403/429 events).
func SetAuditReason(c *gin.Context, reason string) { c.Set("audit_reason", reason) }

// SetAuditCampaign records the campaign a request acts on, for the audit log.
func SetAuditCampaign(c *gin.Context, campaignID int64) { c.Set("campaign_id", campaignID) }

// LogSecurityEvent writes one structured log line for an auth failure, RBAC
// rejection or rate-limit violation and stores it in the ring buffer.
func LogSecurityEvent(entry AuditLog) {
	auditRing.Add(entry)
	log.Print(FormatSecurityLine(entry))
}

// FormatSecurityLine renders a key=value line: event, status, user, campaign, ts, ip, action, reason.
func FormatSecurityLine(e AuditLog) string {
	return "audit event=" + securityEventName(e.Status) +
		" status=" + strconv.Itoa(e.Status) +
		" user_id=" + strconv.FormatInt(e.UserID, 10) +
		" campaign_id=" + strconv.FormatInt(e.CampaignID, 10) +
		" ts=" + e.Timestamp +
		" ip=" + e.IPAddress +
		" action=" + strconv.Quote(e.Action) +
		" reason=" + strconv.Quote(e.Reason)
}

func securityEventName(status int) string {
	switch status {
	case 401:
		return "auth_failure"
	case 403:
		return "rbac_rejection"
	case 429:
		return "rate_limited"
	}
	return "other"
}

// IsSecurityStatus reports whether a status code must be logged as a security event.
func IsSecurityStatus(status int) bool { return status == 401 || status == 403 || status == 429 }

// bodyCapture keeps the first bytes of an error response so the "error" message
// can be used as the audit reason.
type bodyCapture struct {
	gin.ResponseWriter
	buf bytes.Buffer
}

func (w *bodyCapture) Write(b []byte) (int, error) {
	if w.Status() >= 400 && w.buf.Len() < 512 {
		room := 512 - w.buf.Len()
		if len(b) < room {
			room = len(b)
		}
		w.buf.Write(b[:room])
	}
	return w.ResponseWriter.Write(b)
}

func AuditLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		capture := &bodyCapture{ResponseWriter: c.Writer}
		c.Writer = capture

		c.Next()

		userID, _ := c.Get("user_id")
		entry := AuditLog{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			IPAddress: c.ClientIP(),
			Action:    c.Request.Method + " " + c.Request.URL.Path,
			Status:    c.Writer.Status(),
		}
		if uid, ok := userID.(int64); ok {
			entry.UserID = uid
		}
		if cid, exists := c.Get("campaign_id"); exists {
			if id, ok := cid.(int64); ok {
				entry.CampaignID = id
			}
		}
		if entry.CampaignID == 0 {
			if id, err := strconv.ParseInt(c.Param("id"), 10, 64); err == nil && strings.HasPrefix(c.Request.URL.Path, "/api/campaigns/") {
				entry.CampaignID = id
			}
		}
		details, _ := json.Marshal(map[string]interface{}{
			"method":      c.Request.Method,
			"path":        c.Request.URL.Path,
			"status":      entry.Status,
			"duration_ms": time.Since(start).Milliseconds(),
		})
		entry.Details = string(details)

		if IsSecurityStatus(entry.Status) {
			entry.Reason = auditReason(c, capture)
			LogSecurityEvent(entry)
			return
		}
		auditRing.Add(entry)
	}
}

func auditReason(c *gin.Context, capture *bodyCapture) string {
	if reason, ok := c.Get("audit_reason"); ok {
		if s, ok := reason.(string); ok && s != "" {
			return s
		}
	}
	var body struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(capture.buf.Bytes(), &body) == nil && body.Error != "" {
		return body.Error
	}
	return "http " + strconv.Itoa(capture.Status())
}

func FormatLogEntry(entry AuditLog) string {
	var buf bytes.Buffer
	buf.WriteString(entry.Timestamp)
	buf.WriteString(" | ")
	buf.WriteString(entry.IPAddress)
	buf.WriteString(" | ")
	if entry.UserID > 0 {
		buf.WriteString("user=")
		buf.WriteString(strconv.FormatInt(entry.UserID, 10))
	}
	if entry.CampaignID > 0 {
		buf.WriteString(" campaign=")
		buf.WriteString(strconv.FormatInt(entry.CampaignID, 10))
	}
	buf.WriteString(" | ")
	buf.WriteString(entry.Action)
	buf.WriteString(" | ")
	buf.WriteString(entry.Details)
	return buf.String()
}
