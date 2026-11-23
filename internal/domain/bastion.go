package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/lib/pq"
)

// Bastions (openspec/specs/market-bastions.md §6).

// JSONB is a raw JSON column (null when empty).
type JSONB json.RawMessage

func (j *JSONB) Scan(v any) error {
	switch t := v.(type) {
	case nil:
		*j = nil
	case []byte:
		*j = append((*j)[:0], t...)
	case string:
		*j = JSONB(t)
	default:
		return fmt.Errorf("JSONB: unsupported type %T", v)
	}
	return nil
}

func (j JSONB) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return string(j), nil
}

func (j JSONB) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *JSONB) UnmarshalJSON(b []byte) error {
	*j = append((*j)[:0], b...)
	return nil
}

// BastionOption is one thing an order of a facility can produce.
// Kind: item | gold | defender | narrative.
type BastionOption struct {
	ID          string `json:"id"`
	Order       string `json:"order"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Turns       int    `json:"turns"`
	CostCP      int64  `json:"cost_cp"`
	Kind        string `json:"kind"`
	ItemName    string `json:"item_name,omitempty"`
	ItemType    string `json:"item_type,omitempty"`
	Rarity      string `json:"rarity,omitempty"`
	Qty         int    `json:"qty,omitempty"`
	ValueCP     int64  `json:"value_cp,omitempty"`
	GoldDice    string `json:"gold_dice,omitempty"`
	GoldMultCP  int64  `json:"gold_mult_cp,omitempty"`
	Defenders   int    `json:"defenders,omitempty"`
	Text        string `json:"text,omitempty"`
}

// BastionOptions is stored as JSONB.
type BastionOptions []BastionOption

func (o *BastionOptions) Scan(v any) error {
	var b []byte
	switch t := v.(type) {
	case nil:
		*o = BastionOptions{}
		return nil
	case []byte:
		b = t
	case string:
		b = []byte(t)
	default:
		return fmt.Errorf("BastionOptions: unsupported type %T", v)
	}
	return json.Unmarshal(b, o)
}

func (o BastionOptions) Value() (driver.Value, error) {
	if o == nil {
		o = BastionOptions{}
	}
	b, err := json.Marshal(o)
	return string(b), err
}

// BastionCatalogEntry is a special facility of the catalogue (per campaign, editable).
type BastionCatalogEntry struct {
	ID           int64          `db:"id" json:"id"`
	CampaignID   *int64         `db:"campaign_id" json:"-"`
	Name         string         `db:"name" json:"name"`
	MinLevel     int            `db:"min_level" json:"min_level"`
	Prerequisite string         `db:"prerequisite" json:"prerequisite"`
	Size         string         `db:"size" json:"size"`
	Description  string         `db:"description" json:"description"`
	Hirelings    int            `db:"hirelings" json:"hirelings"`
	Orders       pq.StringArray `db:"orders" json:"orders"`
	Options      BastionOptions `db:"options" json:"options"`
	SortOrder    int            `db:"sort_order" json:"sort_order"`
}

// BastionEvent is a row of the d100 events table.
type BastionEvent struct {
	ID           int64  `db:"id" json:"id"`
	CampaignID   *int64 `db:"campaign_id" json:"-"`
	RollMin      int    `db:"roll_min" json:"roll_min"`
	RollMax      int    `db:"roll_max" json:"roll_max"`
	Name         string `db:"name" json:"name"`
	Description  string `db:"description" json:"description"`
	RewardDice   string `db:"reward_dice" json:"reward_dice"`
	RewardMultCP int64  `db:"reward_mult_cp" json:"reward_mult_cp"`
}

type BastionFacility struct {
	ID          int64     `db:"id" json:"id"`
	BastionID   int64     `db:"bastion_id" json:"bastion_id"`
	Kind        string    `db:"kind" json:"kind"` // basic | special
	CatalogID   *int64    `db:"catalog_id" json:"catalog_id"`
	Name        string    `db:"name" json:"name"`
	BasicKind   string    `db:"basic_kind" json:"basic_kind"`
	Size        string    `db:"size" json:"size"`
	OrderName   string    `db:"order_name" json:"order_name"`
	OrderOption JSONB     `db:"order_option" json:"order_option"`
	TurnsLeft   int       `db:"turns_left" json:"turns_left"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`

	// Filled from the catalogue.
	Description  string         `db:"-" json:"description,omitempty"`
	Prerequisite string         `db:"-" json:"prerequisite,omitempty"`
	Orders       []string       `db:"-" json:"orders,omitempty"`
	Options      BastionOptions `db:"-" json:"options,omitempty"`
}

type BastionHireling struct {
	ID         int64  `db:"id" json:"id"`
	BastionID  int64  `db:"bastion_id" json:"bastion_id"`
	FacilityID *int64 `db:"facility_id" json:"facility_id"`
	Name       string `db:"name" json:"name"`
}

type BastionDefender struct {
	ID        int64     `db:"id" json:"id"`
	BastionID int64     `db:"bastion_id" json:"bastion_id"`
	Name      string    `db:"name" json:"name"`
	Source    string    `db:"source" json:"source"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type WarehouseItem struct {
	ID          int64     `db:"id" json:"id"`
	BastionID   int64     `db:"bastion_id" json:"bastion_id"`
	Name        string    `db:"name" json:"name"`
	ItemType    string    `db:"item_type" json:"item_type"`
	Rarity      string    `db:"rarity" json:"rarity"`
	Quantity    int       `db:"quantity" json:"quantity"`
	ValueCP     int64     `db:"value_cp" json:"value_cp"`
	Description string    `db:"description" json:"description"`
	Source      string    `db:"source" json:"source"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type BastionConstruction struct {
	ID         int64     `db:"id" json:"id"`
	BastionID  int64     `db:"bastion_id" json:"bastion_id"`
	Kind       string    `db:"kind" json:"kind"` // add | enlarge
	FacilityID *int64    `db:"facility_id" json:"facility_id"`
	BasicKind  string    `db:"basic_kind" json:"basic_kind"`
	TargetSize string    `db:"target_size" json:"target_size"`
	DaysLeft   int       `db:"days_left" json:"days_left"`
	TotalDays  int       `db:"total_days" json:"total_days"`
	CostCP     int64     `db:"cost_cp" json:"cost_cp"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

type BastionLogEntry struct {
	ID         int64          `db:"id" json:"id"`
	BastionID  int64          `db:"bastion_id" json:"bastion_id"`
	CampaignID int64          `db:"campaign_id" json:"-"`
	TurnNumber int            `db:"turn_number" json:"turn_number"`
	Entries    pq.StringArray `db:"entries" json:"entries"`
	EventName  string         `db:"event_name" json:"event_name"`
	EventRoll  int            `db:"event_roll" json:"event_roll"`
	CreatedAt  time.Time      `db:"created_at" json:"created_at"`
}

type Bastion struct {
	ID          int64     `db:"id" json:"id"`
	CampaignID  int64     `db:"campaign_id" json:"campaign_id"`
	CharacterID int64     `db:"character_id" json:"character_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`

	CharacterName  string `db:"character_name" json:"character_name"`
	CharacterLevel int    `db:"character_level" json:"character_level"`
	OwnerUserID    int64  `db:"owner_user_id" json:"owner_user_id"`

	Facilities   []BastionFacility     `db:"-" json:"facilities"`
	Hirelings    []BastionHireling     `db:"-" json:"hirelings"`
	Defenders    []BastionDefender     `db:"-" json:"defenders"`
	Warehouse    []WarehouseItem       `db:"-" json:"warehouse"`
	Construction []BastionConstruction `db:"-" json:"construction"`
	Log          []BastionLogEntry     `db:"-" json:"log"`
}

// FacilityOrderState is the order state a turn leaves a facility in.
type FacilityOrderState struct {
	ID          int64
	OrderName   string
	OrderOption JSONB
	TurnsLeft   int
}

// ConstructionUpdate is the progress of a construction after a turn.
type ConstructionUpdate struct {
	ID       int64
	DaysLeft int
	Done     bool
}

// BastionTurnResult is everything a Bastion turn changes for one Bastion.
type BastionTurnResult struct {
	BastionID    int64
	CharacterID  int64
	TurnNumber   int
	Log          []string
	EventName    string
	EventRoll    int
	GoldCP       int64
	Items        []WarehouseItem
	Defenders    []BastionDefender
	Facilities   []FacilityOrderState
	Construction []ConstructionUpdate
}
