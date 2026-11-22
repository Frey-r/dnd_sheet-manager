package realtime

import (
	"testing"
	"time"
)

func TestMsgLimiterAllowsFivePerSecondThenRejects(t *testing.T) {
	now := time.Unix(1000, 0)
	l := newMsgLimiterClock(5, time.Second, func() time.Time { return now })
	for i := 0; i < 5; i++ {
		if !l.Allow() {
			t.Fatalf("message %d within limit rejected", i+1)
		}
		now = now.Add(100 * time.Millisecond) // 5 messages in 500ms
	}
	if l.Allow() {
		t.Fatal("6th message inside the 1s window must be rejected")
	}
}

func TestMsgLimiterWindowSlides(t *testing.T) {
	now := time.Unix(1000, 0)
	l := newMsgLimiterClock(5, time.Second, func() time.Time { return now })
	for i := 0; i < 5; i++ {
		l.Allow()
	}
	now = now.Add(time.Second) // the whole first burst left the window
	for i := 0; i < 5; i++ {
		if !l.Allow() {
			t.Fatalf("message %d after the window elapsed rejected", i+1)
		}
	}
	if l.Allow() {
		t.Fatal("limit must apply again once 5 new messages are in the window")
	}
}

func TestMsgLimiterSustainedRateIsFine(t *testing.T) {
	now := time.Unix(1000, 0)
	l := newMsgLimiterClock(5, time.Second, func() time.Time { return now })
	for i := 0; i < 50; i++ {
		if !l.Allow() {
			t.Fatalf("steady 4 msg/s rejected at message %d", i)
		}
		now = now.Add(250 * time.Millisecond)
	}
}

func TestTypedEventName(t *testing.T) {
	cases := []struct{ method, path, role, want string }{
		{"PUT", "/api/trades/3/accept", "", "TRADE_ACCEPTED"},
		{"PUT", "/api/trades/3/reject", "", "TRADE_REJECTED"},
		{"POST", "/api/trades/3/counter", "", "TRADE_OFFER"},
		{"POST", "/api/characters/4/trades", "", "TRADE_OFFER"},
		{"POST", "/api/campaigns/1/messages", "gm", "MESSAGE_GM"},
		{"POST", "/api/campaigns/1/messages", "player", "MESSAGE_PLAYER"},
		{"PUT", "/api/characters/4/hp", "", "CHARACTER_UPDATE"},
		{"POST", "/api/characters/4/spells/9/cast", "", "SPELL_CAST"},
		{"PUT", "/api/campaigns/1", "gm", ""},
		{"POST", "/api/campaigns/1/combat/encounter", "gm", "ENCOUNTER_STARTED"},
		{"POST", "/api/campaigns/1/bastions/turn", "gm", "BASTION_TURN"},
		{"GET", "/api/campaigns/1/bastions/turn", "gm", ""},
		{"POST", "/api/campaigns/1/lore/search", "player", "LORE_QUERY"},
		{"POST", "/api/campaigns/1/lore", "gm", ""},
	}
	for _, c := range cases {
		if got := TypedEventName(c.method, c.path, c.role); got != c.want {
			t.Errorf("%s %s (%s) = %q, want %q", c.method, c.path, c.role, got, c.want)
		}
	}
}
