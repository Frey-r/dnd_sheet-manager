package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"dnd-campaign-manager/internal/domain"

	"github.com/gin-gonic/gin"
)

// Players must not list the DM's notes, events, NPCs or maps (frontend-screens.md, GM tools).
func TestCampaignResourceListRequiresGM(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewCampaignResourceHandler(nil)
	for _, kind := range []string{"notes", "events", "npcs", "maps"} {
		r := gin.New()
		r.GET("/api/campaigns/:id/"+kind, func(c *gin.Context) { c.Set("is_gm", false) }, h.List(kind))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/campaigns/1/"+kind, nil))
		if w.Code != http.StatusForbidden {
			t.Errorf("%s: player got %d, want 403", kind, w.Code)
		}
	}
}

func TestTradeAuditDetails(t *testing.T) {
	got := tradeAuditDetails(&domain.TradeOffer{ID: 3, OfferorCharacterID: 1, RecipientCharacterID: 2, OfferedGold: 5, RequestedGold: 0, OfferedItemIDs: "[7]", RequestedItemIDs: ""})
	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"offered_gold":5,"offered_item_ids":[7],"offeror_character_id":1,"recipient_character_id":2,"requested_gold":0,"requested_item_ids":[],"trade_id":3}`
	if string(raw) != want {
		t.Fatalf("got %s\nwant %s", raw, want)
	}
}

func TestDeliveryStatus(t *testing.T) {
	to := int64(5)
	direct := &domain.Message{CampaignID: 1, RecipientUserID: &to, MessageType: domain.MessageTypePlayerDirect}
	if got := deliveryStatus(fakePresence{online: true}, direct); got != "delivered" {
		t.Errorf("online: %s", got)
	}
	if got := deliveryStatus(fakePresence{}, direct); got != "queued" {
		t.Errorf("offline: %s", got)
	}
	broadcast := &domain.Message{CampaignID: 1, MessageType: domain.MessageTypeGMBroadcast}
	if got := deliveryStatus(fakePresence{}, broadcast); got != "delivered" {
		t.Errorf("broadcast: %s", got)
	}
}

type fakePresence struct{ online bool }

func (f fakePresence) IsOnline(int64, int64) bool { return f.online }
func (f fakePresence) OnlineUsers(int64) []int64 {
	if f.online {
		return []int64{5}
	}
	return nil
}
