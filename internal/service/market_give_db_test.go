package service

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"dnd-campaign-manager/internal/repository"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// TestMarketBuyGivesToChosenCharacterRealDB checks the GM `buy` shortcut (market-bastions.md §3):
// the GM picks a player character, the list price is charged to that character's wallet and the
// item lands in its inventory; a character from another campaign is refused.
func TestMarketBuyGivesToChosenCharacterRealDB(t *testing.T) {
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
	tag := fmt.Sprintf("give%d", time.Now().UnixNano())

	mustID := func(query string, args ...any) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRowxContext(ctx, query, args...).Scan(&id); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		return id
	}
	gm := mustID(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag+"gm", tag+"gm@test.local")
	player := mustID(`INSERT INTO users(username,email,password_hash) VALUES($1,$2,'x') RETURNING id`, tag+"pl", tag+"pl@test.local")
	campaign := mustID(`INSERT INTO campaigns(name,gm_user_id,join_code) VALUES($1,$2,$3) RETURNING id`, tag, gm, tag[len(tag)-8:])
	other := mustID(`INSERT INTO campaigns(name,gm_user_id,join_code) VALUES($1,$2,$3) RETURNING id`, tag+"b", gm, "B"+tag[len(tag)-7:])
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM campaigns WHERE id IN ($1,$2)`, campaign, other)
		_, _ = db.Exec(`DELETE FROM users WHERE id IN ($1,$2)`, gm, player)
	})
	hero := mustID(`INSERT INTO characters(name,user_id,campaign_id,gold) VALUES('Héroe',$1,$2,10) RETURNING id`, player, campaign)
	stranger := mustID(`INSERT INTO characters(name,user_id,campaign_id,gold) VALUES('Ajeno',$1,$2,10) RETURNING id`, player, other)
	shop := mustID(`INSERT INTO shops(campaign_id,name,availability) VALUES($1,'Herrería','closed') RETURNING id`, campaign)
	item := mustID(`INSERT INTO shop_items(shop_id,name,item_type,price_cp,stock) VALUES($1,'Daga','weapon',200,3) RETURNING id`, shop)

	market := NewMarket(repository.NewMarketRepository(db), repository.NewVTTRepository(db))
	res, err := market.Buy(ctx, campaign, gm, true, shop, item, hero, 1)
	if err != nil {
		t.Fatalf("buy for hero: %v", err)
	}
	if res.PaidCP != 200 {
		t.Fatalf("paid %d cp, want 200", res.PaidCP)
	}
	var gold int
	if err := db.Get(&gold, `SELECT gold FROM characters WHERE id=$1`, hero); err != nil || gold != 8 {
		t.Fatalf("hero gold = %d (%v), want 8", gold, err)
	}
	var owned int
	if err := db.Get(&owned, `SELECT COUNT(*) FROM inventory_items WHERE character_id=$1 AND name='Daga' AND value_cp=200`, hero); err != nil || owned != 1 {
		t.Fatalf("hero owns %d daggers (%v), want 1", owned, err)
	}

	if _, err := market.Buy(ctx, campaign, gm, true, shop, item, stranger, 1); err == nil {
		t.Fatal("handing an item to a character of another campaign must fail")
	}
}
