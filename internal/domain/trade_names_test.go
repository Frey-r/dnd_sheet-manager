package domain

import (
	"encoding/json"
	"testing"
)

func TestNameTradeItemsSkipsMissing(t *testing.T) {
	decode := func(raw string) []int64 {
		var ids []int64
		_ = json.Unmarshal([]byte(raw), &ids)
		return ids
	}
	offers := []TradeOffer{{OfferedItemIDs: "[1,9]", RequestedItemIDs: "[2]"}, {OfferedItemIDs: "[]", RequestedItemIDs: ""}}
	NameTradeItems(offers, []TradeItemRef{{ID: 1, Name: "Espada", Quantity: 1}, {ID: 2, Name: "Anillo", Quantity: 2}}, decode)
	if len(offers[0].OfferedItems) != 1 || offers[0].OfferedItems[0].Name != "Espada" {
		t.Fatalf("offered: %+v", offers[0].OfferedItems)
	}
	if len(offers[0].RequestedItems) != 1 || offers[0].RequestedItems[0].Quantity != 2 {
		t.Fatalf("requested: %+v", offers[0].RequestedItems)
	}
	if len(offers[1].OfferedItems) != 0 || len(offers[1].RequestedItems) != 0 {
		t.Fatalf("empty offer got items: %+v", offers[1])
	}
}
