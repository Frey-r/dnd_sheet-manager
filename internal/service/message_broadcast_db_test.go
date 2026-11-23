package service

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestGMBroadcastReachesEveryPlayerRealDB: a GM announcement is stored once per member, so it
// shows in each player's conversation list, history and unread count (user-stories.md).
func TestGMBroadcastReachesEveryPlayerRealDB(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set")
	}
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	tag := fmt.Sprintf("bcast%d", time.Now().UnixNano())
	ids := map[string]int64{}
	for _, name := range []string{"gm", "p1", "p2"} {
		var id int64
		if err := db.Get(&id, `INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag+name, tag+name+"@test.local"); err != nil {
			t.Fatal(err)
		}
		ids[name] = id
	}
	var campaignID int64
	if err := db.Get(&campaignID, `INSERT INTO campaigns(name,join_code,gm_user_id) VALUES($1,$2,$3) RETURNING id`, tag, tag[len(tag)-12:], ids["gm"]); err != nil {
		t.Fatal(err)
	}
	for name, role := range map[string]string{"gm": "gm", "p1": "player", "p2": "player"} {
		if _, err := db.Exec(`INSERT INTO campaign_members(campaign_id,user_id,role) VALUES($1,$2,$3)`, campaignID, ids[name], role); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM messages WHERE campaign_id=$1`, campaignID)
		_, _ = db.Exec(`DELETE FROM campaign_members WHERE campaign_id=$1`, campaignID)
		_, _ = db.Exec(`DELETE FROM campaigns WHERE id=$1`, campaignID)
		_, _ = db.Exec(`DELETE FROM users WHERE id IN ($1,$2,$3)`, ids["gm"], ids["p1"], ids["p2"])
	})

	svc := NewMessageService(repository.NewMessageRepository(db), repository.NewCampaignRepository(db), repository.NewUserRepository(db))
	msg, err := svc.SendMessage(ctx, ids["gm"], campaignID, true, &domain.SendMessageRequest{MessageType: domain.MessageTypeGMBroadcast, Body: "Sesión el viernes"})
	if err != nil || msg.ID == 0 {
		t.Fatalf("broadcast: %v %+v", err, msg)
	}
	for _, player := range []string{"p1", "p2"} {
		convs, err := svc.GetConversations(ctx, campaignID, ids[player])
		if err != nil || len(convs) != 1 || convs[0].OtherUserID != ids["gm"] || convs[0].UnreadCount != 1 {
			t.Fatalf("%s conversations: %v %+v", player, err, convs)
		}
		history, err := svc.GetConversation(ctx, campaignID, ids[player], ids["gm"], 50, 0)
		if err != nil || len(history) != 1 || history[0].Body != "Sesión el viernes" {
			t.Fatalf("%s history: %v %+v", player, err, history)
		}
	}
	if _, err := svc.SendMessage(ctx, ids["p1"], campaignID, false, &domain.SendMessageRequest{MessageType: domain.MessageTypeGMBroadcast, Body: "x"}); err != ErrForbidden {
		t.Fatalf("player broadcast: want ErrForbidden, got %v", err)
	}
}
