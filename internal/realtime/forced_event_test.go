package realtime

import (
	"net/http"
	"testing"
)

func TestForcedEventOnFailedMutation(t *testing.T) {
	cases := []struct {
		name          string
		status        int
		method, path  string
		forced        string
		wantPublish   bool
		wantTypedName string
	}{
		{"accepted trade", http.StatusOK, http.MethodPut, "/api/trades/3/accept", "", true, "TRADE_ACCEPTED"},
		{"invalidated trade", http.StatusConflict, http.MethodPut, "/api/trades/3/accept", "TRADE_INVALIDATED", true, "TRADE_INVALIDATED"},
		{"plain conflict", http.StatusConflict, http.MethodPut, "/api/trades/3/accept", "", false, ""},
		{"read never publishes", http.StatusOK, http.MethodGet, "/api/trades", "TRADE_INVALIDATED", false, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := shouldPublish(tc.status, tc.method, tc.forced); got != tc.wantPublish {
				t.Fatalf("shouldPublish = %v, want %v", got, tc.wantPublish)
			}
			if !tc.wantPublish {
				return
			}
			if got := typedEventFor(tc.status, tc.method, tc.path, "player", tc.forced); got != tc.wantTypedName {
				t.Fatalf("typedEventFor = %q, want %q", got, tc.wantTypedName)
			}
		})
	}
}
