package domain

import (
	"time"

	"github.com/lib/pq"
)

// Shop is a market stall of a campaign (openspec/specs/market-bastions.md §3).
type Shop struct {
	ID           int64          `db:"id" json:"id"`
	CampaignID   int64          `db:"campaign_id" json:"campaign_id"`
	Name         string         `db:"name" json:"name"`
	Description  string         `db:"description" json:"description"`
	Icon         string         `db:"icon" json:"icon"`
	NPCID        *int64         `db:"npc_id" json:"npc_id"`
	Availability string         `db:"availability" json:"availability"`
	SceneID      *int64         `db:"scene_id" json:"scene_id"`
	ObjectID     *int64         `db:"object_id" json:"object_id"`
	PricePct     int            `db:"price_pct" json:"price_pct"`
	BuyRatePct   int            `db:"buy_rate_pct" json:"buy_rate_pct"`
	BuysTypes    pq.StringArray `db:"buys_types" json:"buys_types"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time      `db:"updated_at" json:"updated_at"`

	// Derived for the caller.
	Available bool   `db:"-" json:"available"`
	Reason    string `db:"-" json:"reason,omitempty"`
	NPCName   string `db:"npc_name" json:"npc_name,omitempty"`
	SceneName string `db:"scene_name" json:"scene_name,omitempty"`
	ItemCount int    `db:"item_count" json:"item_count"`
}

// ShopItem is one stock line of a shop. Stock -1 means unlimited.
type ShopItem struct {
	ID                 int64     `db:"id" json:"id"`
	ShopID             int64     `db:"shop_id" json:"shop_id"`
	Name               string    `db:"name" json:"name"`
	ItemType           string    `db:"item_type" json:"item_type"`
	Rarity             string    `db:"rarity" json:"rarity"`
	PriceCP            int64     `db:"price_cp" json:"price_cp"`
	Weight             float64   `db:"weight" json:"weight"`
	Description        string    `db:"description" json:"description"`
	AttunementRequired bool      `db:"attunement_required" json:"attunement_required"`
	SRDRefID           *int64    `db:"srd_ref_id" json:"srd_ref_id"`
	SRDKind            *string   `db:"srd_kind" json:"srd_kind"`
	Stock              int       `db:"stock" json:"stock"`
	CreatedAt          time.Time `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time `db:"updated_at" json:"updated_at"`

	// Price after the shop's markup, filled for the caller.
	FinalPriceCP int64 `db:"-" json:"final_price_cp"`
}

// NPCItem is something a campaign NPC owns (§5).
type NPCItem struct {
	ID          int64     `db:"id" json:"id"`
	NPCID       int64     `db:"npc_id" json:"npc_id"`
	Name        string    `db:"name" json:"name"`
	Quantity    int       `db:"quantity" json:"quantity"`
	ValueCP     *int64    `db:"value_cp" json:"value_cp"`
	Description string    `db:"description" json:"description"`
	Location    string    `db:"location" json:"location"`
	Source      string    `db:"source" json:"source"`
	Equipped    bool      `db:"equipped" json:"equipped"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ShopOffer is a haggling offer from a player to a shopkeeper (the GM).
type ShopOffer struct {
	ID          int64      `db:"id" json:"id"`
	CampaignID  int64      `db:"campaign_id" json:"campaign_id"`
	ShopID      int64      `db:"shop_id" json:"shop_id"`
	ItemID      *int64     `db:"item_id" json:"-"`
	CharacterID int64      `db:"character_id" json:"character_id"`
	UserID      int64      `db:"user_id" json:"user_id"`
	Qty         int        `db:"qty" json:"qty"`
	ListCP      int64      `db:"list_cp" json:"list_cp"`
	OfferedCP   int64      `db:"offered_cp" json:"offered_cp"`
	CounterCP   *int64     `db:"counter_cp" json:"counter_cp"`
	AgreedCP    *int64     `db:"agreed_cp" json:"agreed_cp"`
	Message     string     `db:"message" json:"message"`
	Skill       string     `db:"skill" json:"skill"`
	RollTotal   *int       `db:"roll_total" json:"roll_total,omitempty"`
	RollDetail  string     `db:"roll_detail" json:"roll_detail,omitempty"`
	Status      string     `db:"status" json:"status"`
	Note        string     `db:"note" json:"note"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	ResolvedAt  *time.Time `db:"resolved_at" json:"resolved_at"`

	ShopName      string `db:"shop_name" json:"shop_name"`
	CharacterName string `db:"character_name" json:"character_name"`
	NPCName       string `db:"npc_name" json:"npc_name,omitempty"`

	Lines   []ShopOfferLine `db:"-" json:"lines"`
	Summary string          `db:"-" json:"summary"`
}

// ShopOfferLine is one cart line of an offer.
type ShopOfferLine struct {
	ID         int64  `db:"id" json:"id"`
	OfferID    int64  `db:"offer_id" json:"-"`
	ItemID     *int64 `db:"item_id" json:"item_id"`
	Name       string `db:"name" json:"name"`
	Qty        int    `db:"qty" json:"qty"`
	UnitListCP int64  `db:"unit_list_cp" json:"unit_list_cp"`
}
