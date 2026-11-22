package repository

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestTradeItemsNamedAndInvalidatedRealDB runs against a migrated Postgres (TEST_DATABASE_DSN):
// the trade list names the offered and requested items, and deleting a requested item
// invalidates the pending offer and releases the offeror's locked items.
func TestTradeItemsNamedAndInvalidatedRealDB(t *testing.T) {
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
	tag := fmt.Sprintf("tri%d", time.Now().UnixNano())
	mustID := func(query string, args ...any) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRowxContext(ctx, query, args...).Scan(&id); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		return id
	}
	userA := mustID(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag+"a", tag+"a@test.local")
	userB := mustID(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag+"b", tag+"b@test.local")
	campaign := mustID(`INSERT INTO campaigns(name,gm_user_id,join_code) VALUES($1,$2,$3) RETURNING id`, tag, userA, tag[len(tag)-8:])
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM campaigns WHERE id=$1`, campaign)
		_, _ = db.Exec(`DELETE FROM users WHERE id IN ($1,$2)`, userA, userB)
	})
	for _, u := range []int64{userA, userB} {
		if _, err := db.Exec(`INSERT INTO campaign_members(campaign_id,user_id,role) VALUES($1,$2,'player')`, campaign, u); err != nil {
			t.Fatal(err)
		}
	}
	charA := mustID(`INSERT INTO characters(name,user_id,campaign_id) VALUES('A',$1,$2) RETURNING id`, userA, campaign)
	charB := mustID(`INSERT INTO characters(name,user_id,campaign_id) VALUES('B',$1,$2) RETURNING id`, userB, campaign)
	sword := mustID(`INSERT INTO inventory_items(character_id,name,item_type,quantity,is_tradeable) VALUES($1,'Espada','weapon',1,true) RETURNING id`, charA)
	ring := mustID(`INSERT INTO inventory_items(character_id,name,item_type,quantity,is_tradeable) VALUES($1,'Anillo','ring',2,true) RETURNING id`, charB)

	trades := NewTradeRepository(db)
	a := &domain.Character{ID: charA, CampaignID: campaign, UserID: userA}
	b := &domain.Character{ID: charB, CampaignID: campaign, UserID: userB}
	offer, err := trades.CreateTransactional(ctx, a, b, &domain.CreateTradeRequest{RecipientCharacterID: charB, OfferedItemIDs: []int64{sword}, RequestedItemIDs: []int64{ring}})
	if err != nil {
		t.Fatalf("create offer: %v", err)
	}

	list, err := trades.ListForUser(ctx, userB)
	if err != nil || len(list) != 1 {
		t.Fatalf("list: %v (%d offers)", err, len(list))
	}
	if len(list[0].OfferedItems) != 1 || list[0].OfferedItems[0].Name != "Espada" || len(list[0].RequestedItems) != 1 || list[0].RequestedItems[0].Quantity != 2 {
		t.Fatalf("named items: %+v / %+v", list[0].OfferedItems, list[0].RequestedItems)
	}

	if err := NewItemRepository(db).DeleteForCharacter(ctx, charB, ring); err != nil {
		t.Fatalf("delete requested item: %v", err)
	}
	var status string
	var locked bool
	if err := db.Get(&status, `SELECT status FROM trade_offers WHERE id=$1`, offer.ID); err != nil || status != string(domain.TradeInvalidated) {
		t.Fatalf("status = %q (%v), want invalidated", status, err)
	}
	if err := db.Get(&locked, `SELECT trade_locked FROM inventory_items WHERE id=$1`, sword); err != nil || locked {
		t.Fatalf("offered item still locked=%v (%v)", locked, err)
	}
}
