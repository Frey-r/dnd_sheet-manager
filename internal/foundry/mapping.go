package foundry

import (
	"encoding/json"
	"regexp"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// dnd5e actor system shape — only the fields we mirror.
type actorSystem struct {
	Abilities struct {
		Str ability `json:"str"`
		Dex ability `json:"dex"`
		Con ability `json:"con"`
		Int ability `json:"int"`
		Wis ability `json:"wis"`
		Cha ability `json:"cha"`
	} `json:"abilities"`
	Attributes struct {
		HP struct {
			Value int `json:"value"`
			Max   int `json:"max"`
			Temp  int `json:"temp"`
		} `json:"hp"`
		AC struct {
			Value int `json:"value"`
		} `json:"ac"`
		Movement struct {
			Walk float64 `json:"walk"`
		} `json:"movement"`
	} `json:"attributes"`
	Details struct {
		Level      int       `json:"level"`
		Race       flexLabel `json:"race"`
		Background flexLabel `json:"background"`
		Alignment  string    `json:"alignment"`
		Biography  struct {
			Value string `json:"value"`
		} `json:"biography"`
		Type struct {
			Value string `json:"value"`
		} `json:"type"` // npc creature type, e.g. "humanoid"
	} `json:"details"`
}

type ability struct {
	Value int `json:"value"`
}

// flexLabel handles dnd5e fields that may be a string or {value: "..."}.
type flexLabel struct{ s string }

func (f *flexLabel) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		f.s = s
		return nil
	}
	var o struct {
		Value string `json:"value"`
	}
	if err := json.Unmarshal(b, &o); err == nil {
		f.s = o.Value
		return nil
	}
	return nil // tolerate unknown shapes
}

// flexFloat handles weight that may be a number or {value: number}.
type flexFloat float64

func (f *flexFloat) UnmarshalJSON(b []byte) error {
	var n float64
	if err := json.Unmarshal(b, &n); err == nil {
		*f = flexFloat(n)
		return nil
	}
	var o struct {
		Value float64 `json:"value"`
	}
	if err := json.Unmarshal(b, &o); err == nil {
		*f = flexFloat(o.Value)
		return nil
	}
	return nil
}

type itemSystem struct {
	Quantity    int       `json:"quantity"`
	Weight      flexFloat `json:"weight"`
	Rarity      string    `json:"rarity"`
	Equipped    bool      `json:"equipped"`
	Attunement  int       `json:"attunement"` // 0 none, 1 required, 2 attuned (legacy) — best-effort
	Description struct {
		Value string `json:"value"`
	} `json:"description"`
}

// MapCharacter converts a Foundry "character" actor into a domain.Character.
// userID/campaignID are supplied by the caller (Foundry does not know app users).
func MapCharacter(doc *Document, userID, campaignID int64) domain.Character {
	var sys actorSystem
	_ = json.Unmarshal(doc.System, &sys)
	speed := int(sys.Attributes.Movement.Walk)
	if speed == 0 {
		speed = 30
	}
	level := sys.Details.Level
	if level == 0 {
		level = 1
	}
	uuid := doc.UUID
	return domain.Character{
		UserID:        userID,
		CampaignID:    campaignID,
		Name:          doc.Name,
		Race:          sys.Details.Race.s,
		Class:         firstClassName(doc),
		Level:         level,
		Background:    sys.Details.Background.s,
		Alignment:     sys.Details.Alignment,
		StrScore:      orDefault(sys.Abilities.Str.Value, 10),
		DexScore:      orDefault(sys.Abilities.Dex.Value, 10),
		ConScore:      orDefault(sys.Abilities.Con.Value, 10),
		IntScore:      orDefault(sys.Abilities.Int.Value, 10),
		WisScore:      orDefault(sys.Abilities.Wis.Value, 10),
		ChaScore:      orDefault(sys.Abilities.Cha.Value, 10),
		MaxHP:         sys.Attributes.HP.Max,
		CurrentHP:     sys.Attributes.HP.Value,
		TempHP:        sys.Attributes.HP.Temp,
		AC:            orDefault(sys.Attributes.AC.Value, 10),
		Speed:         speed,
		BackstoryText: stripHTML(sys.Details.Biography.Value),
		FoundryUUID:   &uuid,
	}
}

// MapNPC converts a Foundry "npc" actor into a domain.NPC.
func MapNPC(doc *Document, campaignID int64) domain.NPC {
	var sys actorSystem
	_ = json.Unmarshal(doc.System, &sys)
	speed := int(sys.Attributes.Movement.Walk)
	if speed == 0 {
		speed = 30
	}
	uuid := doc.UUID
	return domain.NPC{
		CampaignID:  campaignID,
		FoundryUUID: &uuid,
		Name:        doc.Name,
		Role:        sys.Details.Type.Value,
		Status:      "alive",
		AvatarURL:   doc.Img,
		AC:          orDefault(sys.Attributes.AC.Value, 10),
		HP:          sys.Attributes.HP.Max,
		Speed:       speed,
		Description: stripHTML(sys.Details.Biography.Value),
	}
}

// MapItem converts an actor-embedded Foundry item into a domain.InventoryItem.
func MapItem(item *Document, characterID int64) domain.InventoryItem {
	var sys itemSystem
	_ = json.Unmarshal(item.System, &sys)
	qty := sys.Quantity
	if qty == 0 {
		qty = 1
	}
	uuid := item.UUID
	return domain.InventoryItem{
		CharacterID:        characterID,
		Name:               item.Name,
		ItemType:           mapItemType(item.Type),
		Rarity:             mapRarity(sys.Rarity),
		Weight:             float64(sys.Weight),
		Quantity:           qty,
		Description:        stripHTML(sys.Description.Value),
		IsEquipped:         sys.Equipped,
		RequiresAttunement: sys.Attunement > 0,
		IsAttuned:          sys.Attunement == 2,
		IsTradeable:        true,
		FoundryUUID:        &uuid,
	}
}

// MapScene converts a Foundry scene into a domain.Map.
func MapScene(doc *Document, campaignID int64) domain.Map {
	uuid := doc.UUID
	img := doc.Background.Src
	if img == "" {
		img = doc.Img
	}
	return domain.Map{
		CampaignID:  campaignID,
		FoundryUUID: &uuid,
		Name:        doc.Name,
		ImageURL:    img,
	}
}

// JournalText extracts a title and plain-text content from a journal entry document.
func JournalText(doc *Document) (title, content string) {
	title = doc.Name
	if len(doc.Pages) > 0 {
		var b strings.Builder
		for _, p := range doc.Pages {
			if p.Text.Content != "" {
				b.WriteString(stripHTML(p.Text.Content))
				b.WriteString("\n\n")
			}
		}
		return title, strings.TrimSpace(b.String())
	}
	return title, stripHTML(doc.Content)
}

func firstClassName(doc *Document) string {
	for _, it := range doc.Items {
		if it.Type == "class" {
			return it.Name
		}
	}
	return ""
}

func mapItemType(foundryType string) domain.ItemType {
	switch foundryType {
	case "weapon":
		return domain.ItemTypeWeapon
	case "equipment":
		return domain.ItemTypeArmor
	case "consumable":
		return domain.ItemTypePotion
	case "loot", "tool", "backpack", "container":
		return domain.ItemTypeGear
	default:
		return domain.ItemTypeMisc
	}
}

func mapRarity(r string) domain.Rarity {
	switch strings.ToLower(strings.ReplaceAll(r, " ", "")) {
	case "uncommon":
		return domain.RarityUncommon
	case "rare":
		return domain.RarityRare
	case "veryrare":
		return domain.RarityVeryRare
	case "legendary", "artifact":
		return domain.RarityLegendary
	default:
		return domain.RarityCommon
	}
}

func orDefault(v, def int) int {
	if v == 0 {
		return def
	}
	return v
}

var htmlTag = regexp.MustCompile(`<[^>]*>`)

func stripHTML(s string) string {
	if s == "" {
		return ""
	}
	out := htmlTag.ReplaceAllString(s, " ")
	out = strings.ReplaceAll(out, "&nbsp;", " ")
	out = strings.ReplaceAll(out, "&amp;", "&")
	return strings.TrimSpace(strings.Join(strings.Fields(out), " "))
}
