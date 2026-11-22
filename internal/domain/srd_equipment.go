package domain

import "time"

// SRDEquipment represents a D&D 5e SRD equipment entry (weapons, armor, gear).
type SRDEquipment struct {
	ID                  int64     `db:"id" json:"id"`
	Name                string    `db:"name" json:"name"`
	Category            string    `db:"category" json:"category"`
	CostGP              float64   `db:"cost_gp" json:"cost_gp"`
	CostUnit            string    `db:"cost_unit" json:"cost_unit"`
	Weight              float64   `db:"weight" json:"weight"`
	Description         string    `db:"description" json:"description"`
	DamageDice          string    `db:"damage_dice" json:"damage_dice"`
	DamageType          string    `db:"damage_type" json:"damage_type"`
	WeaponCategory      string    `db:"weapon_category" json:"weapon_category"`
	WeaponRange         string    `db:"weapon_range" json:"weapon_range"`
	RangeNormal         int       `db:"range_normal" json:"range_normal"`
	RangeLong           int       `db:"range_long" json:"range_long"`
	Properties          string    `db:"properties" json:"properties"` // JSON array
	ACBase              *int      `db:"ac_base" json:"ac_base"`
	ACDexBonus          *bool     `db:"ac_dex_bonus" json:"ac_dex_bonus"`
	ACMaxBonus          *int      `db:"ac_max_bonus" json:"ac_max_bonus"`
	StrMinimum          *int      `db:"str_minimum" json:"str_minimum"`
	StealthDisadvantage bool      `db:"stealth_disadvantage" json:"stealth_disadvantage"`
	ArmorCategory       string    `db:"armor_category" json:"armor_category"`
	IsSRD               bool      `db:"is_srd" json:"is_srd"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	Rank                float64   `db:"rank" json:"rank,omitempty"`
}

// SRDMagicItem represents a D&D 5e SRD magic item entry.
type SRDMagicItem struct {
	ID                 int64     `db:"id" json:"id"`
	Name               string    `db:"name" json:"name"`
	Rarity             string    `db:"rarity" json:"rarity"`
	RequiresAttunement bool      `db:"requires_attunement" json:"requires_attunement"`
	AttunementDesc     string    `db:"attunement_desc" json:"attunement_desc"`
	Description        string    `db:"description" json:"description"`
	Category           string    `db:"category" json:"category"`
	IsSRD              bool      `db:"is_srd" json:"is_srd"`
	CreatedAt          time.Time `db:"created_at" json:"created_at"`
	Rank               float64   `db:"rank" json:"rank,omitempty"`
}

// EquipmentFilters holds search/filter parameters for SRD equipment queries.
type EquipmentFilters struct {
	Query          string `form:"query"`
	Category       string `form:"category"`
	WeaponCategory string `form:"weapon_category"`
	ArmorCategory  string `form:"armor_category"`
	IsSRD          *bool  `form:"is_srd"`
	Limit          int    `form:"limit"`
	Offset         int    `form:"offset"`
}

// MagicItemFilters holds search/filter parameters for SRD magic item queries.
type MagicItemFilters struct {
	Query  string `form:"query"`
	Rarity string `form:"rarity"`
	IsSRD  *bool  `form:"is_srd"`
	Limit  int    `form:"limit"`
	Offset int    `form:"offset"`
}
