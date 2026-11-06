package domain

import "time"

// SRDClass represents a D&D 5e SRD character class.
type SRDClass struct {
	ID                  int64     `db:"id" json:"id"`
	Name                string    `db:"name" json:"name"`
	HitDie              int       `db:"hit_die" json:"hit_die"`
	PrimaryAbility      string    `db:"primary_ability" json:"primary_ability"`
	SavingThrows        string    `db:"saving_throws" json:"saving_throws"`               // JSON array
	ArmorProficiencies  string    `db:"armor_proficiencies" json:"armor_proficiencies"`   // JSON array
	WeaponProficiencies string    `db:"weapon_proficiencies" json:"weapon_proficiencies"` // JSON array
	ToolProficiencies   string    `db:"tool_proficiencies" json:"tool_proficiencies"`     // JSON array
	SkillChoices        string    `db:"skill_choices" json:"skill_choices"`               // JSON
	StartingEquipment   string    `db:"starting_equipment" json:"starting_equipment"`
	SpellcastingAbility string    `db:"spellcasting_ability" json:"spellcasting_ability"`
	Description         string    `db:"description" json:"description"`
	IsSRD               bool      `db:"is_srd" json:"is_srd"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	// Populated by joins or separate queries
	Features   []SRDClassFeature   `db:"-" json:"features,omitempty"`
	SpellSlots []SRDClassSpellSlot `db:"-" json:"spell_slots,omitempty"`
}

// SRDClassFeature represents a class feature at a specific level.
type SRDClassFeature struct {
	ID          int64     `db:"id" json:"id"`
	ClassID     int64     `db:"class_id" json:"class_id"`
	Name        string    `db:"name" json:"name"`
	Level       int       `db:"level" json:"level"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// SRDClassSpellSlot represents spell slots available at a specific class level.
type SRDClassSpellSlot struct {
	ID            int64 `db:"id" json:"id"`
	ClassID       int64 `db:"class_id" json:"class_id"`
	ClassLevel    int   `db:"class_level" json:"class_level"`
	CantripsKnown int   `db:"cantrips_known" json:"cantrips_known"`
	SpellsKnown   int   `db:"spells_known" json:"spells_known"`
	Slot1         int   `db:"slot_1" json:"slot_1"`
	Slot2         int   `db:"slot_2" json:"slot_2"`
	Slot3         int   `db:"slot_3" json:"slot_3"`
	Slot4         int   `db:"slot_4" json:"slot_4"`
	Slot5         int   `db:"slot_5" json:"slot_5"`
	Slot6         int   `db:"slot_6" json:"slot_6"`
	Slot7         int   `db:"slot_7" json:"slot_7"`
	Slot8         int   `db:"slot_8" json:"slot_8"`
	Slot9         int   `db:"slot_9" json:"slot_9"`
}
