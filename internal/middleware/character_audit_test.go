package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

type denyAuthorizer struct{ campaignID int64 }

func (d denyAuthorizer) AuthorizeInCampaign(context.Context, int64, int64) (bool, int64, error) {
	return false, d.campaignID, service.ErrForbidden
}

// security.md: editing another player's sheet answers 403 and the audit entry names the
// user and the character's campaign (not campaign 0).
func TestCharacter403IsAuditedWithCampaign(t *testing.T) {
	gin.SetMode(gin.TestMode)
	SetAuditCapacity(16)
	r := gin.New()
	r.Use(AuditLogger())
	r.PUT("/api/characters/:id", func(c *gin.Context) { c.Set("user_id", int64(9)) }, CharacterAuthorizationMiddleware(denyAuthorizer{campaignID: 42}), func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/characters/5", nil))
	if w.Code != http.StatusForbidden {
		t.Fatalf("status %d, want 403", w.Code)
	}
	logs := GetAuditLogs()
	if len(logs) == 0 {
		t.Fatal("no audit entry")
	}
	last := logs[len(logs)-1]
	if last.CampaignID != 42 || last.UserID != 9 || last.Status != http.StatusForbidden {
		t.Fatalf("audit entry %+v, want campaign 42 user 9 status 403", last)
	}
}
