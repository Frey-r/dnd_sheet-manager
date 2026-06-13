package domain

import "time"

type ItemType string
type Rarity string
type SlotType string

const (
	ItemTypeWeapon    ItemType = "weapon"
	ItemTypeArmor     ItemType = "armor"
	ItemTypePotion    ItemType = "potion"
	ItemTypeScroll    ItemType = "scroll"
	ItemTypeGear      ItemType = "gear"
	ItemTypeMagicItem ItemType = "magic_item"
	ItemTypeAmmo      ItemType = "ammunition"
	ItemTypeMisc      ItemType = "misc"

	RarityCommon    Rarity = "common"
	RarityUncommon  Rarity = "uncommon"
	RarityRare      Rarity = "rare"
	RarityVeryRare  Rarity = "very_rare"
	RarityLegendary Rarity = "legendary"
)

type InventoryItem struct {
	ID                 int64     `db:"id" json:"id"`
	CharacterID        int64     `db:"character_id" json:"character_id"`
	Name               string    `db:"name" json:"name"`
	ItemType           ItemType  `db:"item_type" json:"item_type"`
	Rarity             Rarity    `db:"rarity" json:"rarity"`
	Weight             float64   `db:"weight" json:"weight"`
	Quantity           int       `db:"quantity" json:"quantity"`
	Description        string    `db:"description" json:"description"`
	IsEquipped         bool      `db:"is_equipped" json:"is_equipped"`
	SlotType           string    `db:"slot_type" json:"slot_type"`
	RequiresAttunement bool      `db:"requires_attunement" json:"requires_attunement"`
	IsAttuned          bool      `db:"is_attuned" json:"is_attuned"`
	IsTradeable        bool      `db:"is_tradeable" json:"is_tradeable"`
	QuestBound         bool      `db:"quest_bound" json:"quest_bound"`
	TradeLocked        bool      `db:"trade_locked" json:"trade_locked"`
	SRDRefID           *int64    `db:"srd_ref_id" json:"srd_ref_id,omitempty"`
	FoundryUUID        *string   `db:"foundry_uuid" json:"foundry_uuid,omitempty"`
	IsFoundryOrphan    bool      `db:"is_foundry_orphan" json:"is_foundry_orphan"`
	CreatedAt          time.Time `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time `db:"updated_at" json:"updated_at"`
}

type MarketplaceItem struct {
	ID                 int64     `db:"id" json:"id"`
	CampaignID         int64     `db:"campaign_id" json:"campaign_id"`
	Name               string    `db:"name" json:"name"`
	ItemType           ItemType  `db:"item_type" json:"item_type"`
	Rarity             Rarity    `db:"rarity" json:"rarity"`
	Price              int       `db:"price" json:"price"`
	Weight             float64   `db:"weight" json:"weight"`
	Description        string    `db:"description" json:"description"`
	AttunementRequired bool      `db:"attunement_required" json:"attunement_required"`
	SRDRefID           *int64    `db:"srd_ref_id" json:"srd_ref_id,omitempty"`
	CreatedAt          time.Time `db:"created_at" json:"created_at"`
}

type CreateItemRequest struct {
	Name               string  `json:"name" binding:"required"`
	ItemType           string  `json:"item_type" binding:"required"`
	Rarity             string  `json:"rarity"`
	Weight             float64 `json:"weight"`
	Quantity           int     `json:"quantity"`
	Description        string  `json:"description"`
	RequiresAttunement bool    `json:"requires_attunement"`
	IsTradeable        bool    `json:"is_tradeable"`
	SRDRefID           *int64  `json:"srd_ref_id"`
}

type UpdateItemRequest struct {
	Name        *string `json:"name"`
	Quantity    *int    `json:"quantity"`
	IsEquipped  *bool   `json:"is_equipped"`
	SlotType    *string `json:"slot_type"`
	IsAttuned   *bool   `json:"is_attuned"`
	IsTradeable *bool   `json:"is_tradeable"`
	QuestBound  *bool   `json:"quest_bound"`
}
