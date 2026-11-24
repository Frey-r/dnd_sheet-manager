package service

import (
	"context"
	"errors"
	"testing"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// T-24 · contratos/T-24-pnj-hoja-inventario.md — H3–H7 against a real, migrated Postgres.
func TestNPCSheetAndInventoryRealDB(t *testing.T) {
	f := newRouteFixture(t)
	ctx := context.Background()
	market := repository.NewMarketRepository(f.db)
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	var charID, foreignChar int64
	must(f.db.QueryRowx(`INSERT INTO characters(user_id,campaign_id,name,race,class,gold,silver,copper) VALUES($1,$2,'Lyra','Elf','Rogue',1,2,3) RETURNING id`, f.userID, f.campaignID).Scan(&charID))
	must(f.db.QueryRowx(`INSERT INTO characters(user_id,campaign_id,name,race,class) VALUES($1,$2,'Otro','Elf','Rogue') RETURNING id`, f.userID, f.otherCampaign).Scan(&foreignChar))
	_, err := f.db.Exec(`UPDATE campaign_npcs SET stats='{"combat":{"hp":22,"max_hp":30,"ac":16,"speed_ft":25}}', purse_cp=1450 WHERE id=$1`, f.guardNPC)
	must(err)

	// H3: the token mirrors the NPC HP (sheet until hp_current is set), and writing it reaches the NPC.
	id := f.guardToken(t, "npc")
	tok := f.token(t, id)
	if tok.HP != 22 || tok.MaxHP != 30 {
		t.Fatalf("linked token HP = %d/%d, want the sheet's 22/30", tok.HP, tok.MaxHP)
	}
	must(f.repo.SetNPCHP(ctx, f.guardNPC, 9))
	if tok = f.token(t, id); tok.HP != 9 {
		t.Fatalf("after hp_current = 9 the token shows %d", tok.HP)
	}

	// H4: purse.
	got, err := market.AdjustPurse(ctx, f.campaignID, f.guardNPC, -450, false)
	if err != nil || got != 1000 {
		t.Fatalf("purse -450 = %d, %v", got, err)
	}
	if _, err := market.AdjustPurse(ctx, f.campaignID, f.guardNPC, -5000, false); !errors.Is(err, repository.ErrInsufficientPurse) {
		t.Fatalf("overdraw = %v, want ErrInsufficientPurse", err)
	}
	if got, err = market.AdjustPurse(ctx, f.campaignID, f.guardNPC, 300, true); err != nil || got != 300 {
		t.Fatalf("set 300 = %d, %v", got, err)
	}
	if _, err := market.AdjustPurse(ctx, f.otherCampaign, f.guardNPC, 1, false); !errors.Is(err, repository.ErrMarketNotFound) {
		t.Fatalf("another campaign's NPC purse = %v", err)
	}

	// H5: equipped, never at home.
	v := int64(2000)
	must(market.SaveNPCItem(ctx, &domain.NPCItem{NPCID: f.guardNPC, Name: "Alabarda", Quantity: 3, ValueCP: &v, Location: "inventory", Equipped: true}))
	must(market.SaveNPCItem(ctx, &domain.NPCItem{NPCID: f.guardNPC, Name: "Carta", Quantity: 1, Location: "home", Equipped: true}))
	items, err := market.NPCItems(ctx, f.guardNPC)
	must(err)
	var halberdID int64
	for _, it := range items {
		if it.Name == "Carta" && it.Equipped {
			t.Fatal("an item at home cannot be equipped")
		}
		if it.Name == "Alabarda" {
			halberdID = it.ID
			if !it.Equipped {
				t.Fatal("equipped was not stored")
			}
		}
	}

	// H6: give items.
	if err := market.GiveNPCItem(ctx, f.campaignID, halberdID, charID, 5); !errors.Is(err, repository.ErrNotEnoughItems) {
		t.Fatalf("giving 5 of 3 = %v", err)
	}
	if err := market.GiveNPCItem(ctx, f.campaignID, halberdID, foreignChar, 1); !errors.Is(err, repository.ErrMarketNotFound) {
		t.Fatalf("giving to another campaign's character = %v", err)
	}
	must(market.GiveNPCItem(ctx, f.campaignID, halberdID, charID, 2))
	var invQty int
	var invValue *int64
	must(f.db.QueryRowx(`SELECT quantity, value_cp FROM inventory_items WHERE character_id=$1 AND name='Alabarda'`, charID).Scan(&invQty, &invValue))
	if invQty != 2 || invValue == nil || *invValue != 2000 {
		t.Fatalf("character got %d alabardas worth %v", invQty, invValue)
	}
	left, err := market.NPCItem(ctx, f.campaignID, halberdID)
	if err != nil || left.Quantity != 1 {
		t.Fatalf("NPC keeps %v, %v; want 1", left, err)
	}
	must(market.GiveNPCItem(ctx, f.campaignID, halberdID, charID, 1))
	if _, err := market.NPCItem(ctx, f.campaignID, halberdID); !errors.Is(err, repository.ErrMarketNotFound) {
		t.Fatal("an item given away entirely must be removed from the NPC")
	}

	// H7: give coins (purse is 300 cp).
	if err := market.GiveNPCCoins(ctx, f.campaignID, f.guardNPC, charID, 301); !errors.Is(err, repository.ErrInsufficientPurse) {
		t.Fatalf("giving more coins than the purse = %v", err)
	}
	must(market.GiveNPCCoins(ctx, f.campaignID, f.guardNPC, charID, 245))
	var g, s, c int
	var purse int64
	must(f.db.QueryRowx(`SELECT gold, silver, copper FROM characters WHERE id=$1`, charID).Scan(&g, &s, &c))
	must(f.db.QueryRowx(`SELECT purse_cp FROM campaign_npcs WHERE id=$1`, f.guardNPC).Scan(&purse))
	if g != 3 || s != 6 || c != 8 || purse != 55 {
		t.Fatalf("wallet %d/%d/%d purse %d; want 3/6/8 and 55", g, s, c, purse)
	}
}
