package realtime

import (
	"encoding/json"
	"testing"
)

// The client watchdog (RealtimeProvider.tsx) keys on {"type":"heartbeat"}; keep the frame stable.
func TestHeartbeatFrameShape(t *testing.T) {
	var msg struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(heartbeatFrame, &msg); err != nil {
		t.Fatalf("heartbeat frame is not JSON: %v", err)
	}
	if msg.Type != "heartbeat" {
		t.Fatalf("heartbeat type = %q", msg.Type)
	}
}
