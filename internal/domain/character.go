package domain

import (
	"encoding/json"
	"time"
)

type Character struct {
	ID                  int64     `db:"id" json:"id"`
	UserID              int64     `db:"user_id" json:"user_id"`
	CampaignID          int64     `db:"campaign_id" json:"campaign_id"`
	Name                string    `db:"name" json:"name"`
	Race                string    `db:"race" json:"race"`
	Class               string    `db:"class" json:"class"`
	Level               int       `db:"level" json:"level"`
	Background          string    `db:"background" json:"background"`
	Alignment           string    `db:"alignment" json:"alignment"`
	StrScore            int       `db:"str_score" json:"str_score"`
	DexScore            int       `db:"dex_score" json:"dex_score"`
	ConScore            int       `db:"con_score" json:"con_score"`
	IntScore            int       `db:"int_score" json:"int_score"`
	WisScore            int       `db:"wis_score" json:"wis_score"`
	ChaScore            int       `db:"cha_score" json:"cha_score"`
	MaxHP               int       `db:"max_hp" json:"max_hp"`
	CurrentHP           int       `db:"current_hp" json:"current_hp"`
	TempHP              int       `db:"temp_hp" json:"temp_hp"`
	AC                  int       `db:"ac" json:"ac"`
	Speed               int       `db:"speed" json:"speed"`
	InitiativeBonus     int       `db:"initiative_bonus" json:"initiative_bonus"`
	ProficiencyBonus    int       `db:"proficiency_bonus" json:"proficiency_bonus"`
	Inspiration         bool      `db:"inspiration" json:"inspiration"`
	PassivePerception   int       `db:"passive_perception" json:"passive_perception"`
	DeathSaveSuccesses  int       `db:"death_save_successes" json:"death_save_successes"`
	DeathSaveFailures   int       `db:"death_save_failures" json:"death_save_failures"`
	XP                  int       `db:"xp" json:"xp"`
	Gold                int       `db:"gold" json:"gold"`
	Silver              int       `db:"silver" json:"silver"`
	Copper              int       `db:"copper" json:"copper"`
	CarryingCapacity    int       `db:"carrying_capacity" json:"carrying_capacity"`
	PersonalityTraits   string    `db:"personality_traits" json:"personality_traits"`
	Ideals              string    `db:"ideals" json:"ideals"`
	Bonds               string    `db:"bonds" json:"bonds"`
	Flaws               string    `db:"flaws" json:"flaws"`
	PhysicalDescription string    `db:"physical_description" json:"physical_description"`
	BackstoryText       string    `db:"backstory_text" json:"backstory_text"`
	Notes               string    `db:"notes" json:"notes"`
	SpellcastingAbility string    `db:"spellcasting_ability" json:"spellcasting_ability"`
	Appearance          RawJSON   `db:"appearance" json:"appearance"`
	FoundryUUID         *string   `db:"foundry_uuid" json:"foundry_uuid,omitempty"`
	IsFoundryOrphan     bool      `db:"is_foundry_orphan" json:"is_foundry_orphan"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time `db:"updated_at" json:"updated_at"`
}

type PhysicalDescription struct {
	Height string `json:"height"`
	Weight string `json:"weight"`
	Age    string `json:"age"`
	Eyes   string `json:"eyes"`
	Skin   string `json:"skin"`
	Hair   string `json:"hair"`
}

func (c *Character) GetModifier(score int) int {
	return (score - 10) / 2
}

func (c *Character) StrModifier() int { return c.GetModifier(c.StrScore) }
func (c *Character) DexModifier() int { return c.GetModifier(c.DexScore) }
func (c *Character) ConModifier() int { return c.GetModifier(c.ConScore) }
func (c *Character) IntModifier() int { return c.GetModifier(c.IntScore) }
func (c *Character) WisModifier() int { return c.GetModifier(c.WisScore) }
func (c *Character) ChaModifier() int { return c.GetModifier(c.ChaScore) }

func (c *Character) SpellSaveDC() int {
	abilityMod := 0
	switch c.SpellcastingAbility {
	case "INT":
		abilityMod = c.IntModifier()
	case "WIS":
		abilityMod = c.WisModifier()
	case "CHA":
		abilityMod = c.ChaModifier()
	}
	return 8 + c.ProficiencyBonus + abilityMod
}

func ParsePhysicalDescription(dbVal string) (PhysicalDescription, error) {
	if dbVal == "" {
		return PhysicalDescription{}, nil
	}
	var pd PhysicalDescription
	err := json.Unmarshal([]byte(dbVal), &pd)
	return pd, err
}

type UpdateCharacterRequest struct {
	Name                *string `json:"name"`
	Race                *string `json:"race"`
	Class               *string `json:"class"`
	Level               *int    `json:"level"`
	Background          *string `json:"background"`
	Alignment           *string `json:"alignment"`
	StrScore            *int    `json:"str_score"`
	DexScore            *int    `json:"dex_score"`
	ConScore            *int    `json:"con_score"`
	IntScore            *int    `json:"int_score"`
	WisScore            *int    `json:"wis_score"`
	ChaScore            *int    `json:"cha_score"`
	MaxHP               *int    `json:"max_hp"`
	CurrentHP           *int    `json:"current_hp"`
	TempHP              *int    `json:"temp_hp"`
	AC                  *int    `json:"ac"`
	Speed               *int    `json:"speed"`
	Inspiration         *bool   `json:"inspiration"`
	XP                  *int    `json:"xp"`
	Gold                *int    `json:"gold"`
	PersonalityTraits   *string `json:"personality_traits"`
	Ideals              *string `json:"ideals"`
	Bonds               *string `json:"bonds"`
	Flaws               *string `json:"flaws"`
	BackstoryText       *string `json:"backstory_text"`
	Notes               *string `json:"notes"`
	SpellcastingAbility *string `json:"spellcasting_ability"`
}

type CharacterWithOwner struct {
	Character
	Username string `db:"username" json:"username"`
}

type SpellSlot struct {
	ID          int64 `db:"id"`
	CharacterID int64 `db:"character_id"`
	Level       int   `db:"level"`
	Total       int   `db:"total"`
	Used        int   `db:"used"`
}

func (s *SpellSlot) Remaining() int {
	return s.Total - s.Used
}

type CharacterFeature struct {
	ID          int64  `db:"id" json:"id"`
	CharacterID int64  `db:"character_id" json:"character_id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
	Type        string `db:"type" json:"type"` // "class", "racial", "feat"
	UsesPerRest int    `db:"uses_per_rest" json:"uses_per_rest"`
	RestType    string `db:"rest_type" json:"rest_type"` // "short", "long", "" (none)
}

type CreateCharacterRequest struct {
	Name       string `json:"name" binding:"required"`
	Race       string `json:"race" binding:"required"`
	Class      string `json:"class" binding:"required"`
	CampaignID int64  `json:"campaign_id" binding:"required"`
	Background string `json:"background"`
	Alignment  string `json:"alignment"`
	// Optional ability scores (3–20); 0 means "use 10".
	StrScore int `json:"str_score"`
	DexScore int `json:"dex_score"`
	ConScore int `json:"con_score"`
	IntScore int `json:"int_score"`
	WisScore int `json:"wis_score"`
	ChaScore int `json:"cha_score"`
	// Rolled characters: the server-made roll set and the scores before increases, so the
	// assignment and the +2/+1 or +1/+1/+1 increases can be verified.
	StatRollID *int64  `json:"stat_roll_id"`
	BaseScores *[6]int `json:"base_scores"`
	// Walking speed from the chosen race (ft); 0 = derive from the race name.
	Speed int `json:"speed"`
	// Pixel-art avatar (character-appearance.md); optional.
	Appearance RawJSON `json:"appearance"`
}
