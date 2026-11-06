package middleware

import (
	"bytes"
	"encoding/json"
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
}

var auditLogs []AuditLog // in-memory for now, would be persisted to DB

func AuditLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		// Log after request
		userID, _ := c.Get("user_id")
		action := c.Request.Method + " " + c.Request.URL.Path

		entry := AuditLog{
			Timestamp: time.Now().Format(time.RFC3339),
			IPAddress: c.ClientIP(),
			Action:    action,
		}

		if uid, ok := userID.(int64); ok {
			entry.UserID = uid
		}

		if cid, exists := c.Get("campaign_id"); exists {
			if id, ok := cid.(int64); ok {
				entry.CampaignID = id
			}
		}

		details, _ := json.Marshal(map[string]interface{}{
			"method":      c.Request.Method,
			"path":        c.Request.URL.Path,
			"status":      c.Writer.Status(),
			"duration_ms": time.Since(start).Milliseconds(),
		})
		entry.Details = string(details)

		auditLogs = append(auditLogs, entry)
	}
}

func GetAuditLogs() []AuditLog {
	return auditLogs
}

func FormatLogEntry(entry AuditLog) string {
	var buf bytes.Buffer
	buf.WriteString(entry.Timestamp)
	buf.WriteString(" | ")
	buf.WriteString(entry.IPAddress)
	buf.WriteString(" | ")
	if entry.UserID > 0 {
		buf.WriteString("user=")
		buf.WriteString(formatInt(entry.UserID))
	}
	if entry.CampaignID > 0 {
		buf.WriteString(" campaign=")
		buf.WriteString(formatInt(entry.CampaignID))
	}
	buf.WriteString(" | ")
	buf.WriteString(entry.Action)
	buf.WriteString(" | ")
	buf.WriteString(entry.Details)
	return buf.String()
}

func formatInt(n int64) string {
	if n == 0 {
		return "0"
	}
	digits := make([]byte, 0, 20)
	for n > 0 {
		digits = append(digits, '0'+byte(n%10))
		n /= 10
	}
	for i, j := 0, len(digits)-1; i < j; i, j = i+1, j-1 {
		digits[i], digits[j] = digits[j], digits[i]
	}
	return string(digits)
}
