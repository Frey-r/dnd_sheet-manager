package foundry

import (
	"encoding/json"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// Reverse mapping: Foundry dnd5e compendium documents -> our domain.SRD* structs.
// Best-effort: only the fields our schema stores are extracted.

var schoolFull = map[string]string{
	"abj": "abjuration", "con": "conjuration", "div": "divination",
	"enc": "enchantment", "evo": "evocation", "ill": "illusion",
	"nec": "necromancy", "trs": "transmutation",
}

func ToSRDSpell(doc *Document) domain.SRDSpell {
	var sys struct {
		Description struct{ Value string } `json:"description"`
		Level       int                    `json:"level"`
		School      string                 `json:"school"`
		Properties  []string               `json:"properties"`
	}
	_ = json.Unmarshal(doc.System, &sys)
	school := sys.School
	if full, ok := schoolFull[school]; ok {
		school = full
	}
	has := func(p string) bool {
		for _, x := range sys.Properties {
			if x == p {
				return true
			}
		}
		return false
	}
	return domain.SRDSpell{
		Name:          doc.Name,
		Level:         sys.Level,
		School:        school,
		Description:   sys.Description.Value,
		Concentration: has("concentration"),
		Ritual:        has("ritual"),
		ComponentsV:   has("vocal"),
		ComponentsS:   has("somatic"),
		ComponentsM:   has("material"),
	}
}

func ToSRDMonster(doc *Document) domain.SRDMonster {
	var sys struct {
		Abilities  map[string]struct{ Value int } `json:"abilities"`
		Attributes struct {
			AC struct {
				Flat  int `json:"flat"`
				Value int `json:"value"`
			} `json:"ac"`
			HP struct {
				Max     int    `json:"max"`
				Value   int    `json:"value"`
				Formula string `json:"formula"`
			} `json:"hp"`
		} `json:"attributes"`
		Details struct {
			CR        float64                `json:"cr"`
			Alignment string                 `json:"alignment"`
			Type      struct{ Value string } `json:"type"`
		} `json:"details"`
		Traits struct {
			Size string `json:"size"`
		} `json:"traits"`
	}
	_ = json.Unmarshal(doc.System, &sys)
	ac := sys.Attributes.AC.Flat
	if ac == 0 {
		ac = sys.Attributes.AC.Value
	}
	hp := sys.Attributes.HP.Max
	if hp == 0 {
		hp = sys.Attributes.HP.Value
	}
	uuid := doc.UUID
	return domain.SRDMonster{
		Name:        doc.Name,
		Size:        sizeFull(sys.Traits.Size),
		Type:        sys.Details.Type.Value,
		Alignment:   sys.Details.Alignment,
		AC:          ac,
		HP:          hp,
		HitDice:     sys.Attributes.HP.Formula,
		STR:         sys.Abilities["str"].Value,
		DEX:         sys.Abilities["dex"].Value,
		CON:         sys.Abilities["con"].Value,
		INT:         sys.Abilities["int"].Value,
		WIS:         sys.Abilities["wis"].Value,
		CHA:         sys.Abilities["cha"].Value,
		CR:          crToString(sys.Details.CR),
		FoundryUUID: &uuid,
	}
}

func ToSRDEquipment(doc *Document) domain.SRDEquipment {
	var sys struct {
		Description struct{ Value string } `json:"description"`
		Weight      flexFloat              `json:"weight"`
		Price       struct {
			Value        float64 `json:"value"`
			Denomination string  `json:"denomination"`
		} `json:"price"`
	}
	_ = json.Unmarshal(doc.System, &sys)
	return domain.SRDEquipment{
		Name:        doc.Name,
		Category:    doc.Type,
		CostGP:      sys.Price.Value,
		CostUnit:    orDefaultStr(sys.Price.Denomination, "gp"),
		Weight:      float64(sys.Weight),
		Description: sys.Description.Value,
	}
}

func ToSRDMagicItem(doc *Document) domain.SRDMagicItem {
	var sys struct {
		Description struct{ Value string } `json:"description"`
		Rarity      string                 `json:"rarity"`
		Attunement  string                 `json:"attunement"`
	}
	_ = json.Unmarshal(doc.System, &sys)
	return domain.SRDMagicItem{
		Name:               doc.Name,
		Rarity:             sys.Rarity,
		RequiresAttunement: sys.Attunement != "",
		Description:        sys.Description.Value,
	}
}

func ToSRDClass(doc *Document) domain.SRDClass {
	var sys struct {
		Description  struct{ Value string }   `json:"description"`
		HitDice      string                   `json:"hitDice"`
		Spellcasting struct{ Ability string } `json:"spellcasting"`
	}
	_ = json.Unmarshal(doc.System, &sys)
	return domain.SRDClass{
		Name:                doc.Name,
		HitDie:              parseHitDie(sys.HitDice),
		SpellcastingAbility: strings.ToUpper(sys.Spellcasting.Ability),
		Description:         sys.Description.Value,
	}
}

func ToSRDSubclass(doc *Document) domain.SRDSubclass {
	var sys struct {
		Description     struct{ Value string } `json:"description"`
		ClassIdentifier string                 `json:"classIdentifier"`
	}
	_ = json.Unmarshal(doc.System, &sys)
	uuid := doc.UUID
	return domain.SRDSubclass{
		ClassName:   sys.ClassIdentifier,
		Name:        doc.Name,
		Description: sys.Description.Value,
		FoundryUUID: &uuid,
	}
}

func ToSRDRace(doc *Document) domain.SRDRace {
	var sys struct {
		Description struct{ Value string } `json:"description"`
		Movement    struct{ Walk int }     `json:"movement"`
	}
	_ = json.Unmarshal(doc.System, &sys)
	speed := sys.Movement.Walk
	if speed == 0 {
		speed = 30
	}
	return domain.SRDRace{
		Name:        doc.Name,
		Speed:       speed,
		Description: sys.Description.Value,
	}
}

func sizeFull(abbr string) string {
	switch abbr {
	case "tiny":
		return "Tiny"
	case "sm":
		return "Small"
	case "med":
		return "Medium"
	case "lg":
		return "Large"
	case "huge":
		return "Huge"
	case "grg":
		return "Gargantuan"
	default:
		return "Medium"
	}
}

func crToString(cr float64) string {
	switch cr {
	case 0.125:
		return "1/8"
	case 0.25:
		return "1/4"
	case 0.5:
		return "1/2"
	}
	s := strings.TrimRight(strings.TrimRight(jsonNumber(cr), "0"), ".")
	if s == "" {
		return "0"
	}
	return s
}

func jsonNumber(f float64) string {
	b, _ := json.Marshal(f)
	return string(b)
}

func parseHitDie(hd string) int {
	hd = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(hd)), "d")
	switch hd {
	case "6":
		return 6
	case "8":
		return 8
	case "10":
		return 10
	case "12":
		return 12
	default:
		return 8
	}
}
