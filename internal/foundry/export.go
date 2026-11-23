package foundry

import (
	"crypto/sha1"
	"encoding/json"
	"strconv"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// Doc is a dnd5e document ready to be serialized as Foundry compendium source.
type Doc struct {
	ID   string                 // Foundry _id (16 chars, deterministic)
	Name string                 // for filename slug
	Body map[string]interface{} // full document
}

const idCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

// DeterministicID derives a stable 16-char Foundry id from the given parts, so
// re-exports keep the same compendium UUID (idempotent).
func DeterministicID(parts ...string) string {
	h := sha1.Sum([]byte(strings.Join(parts, "|")))
	out := make([]byte, 16)
	for i := 0; i < 16; i++ {
		out[i] = idCharset[int(h[i])%len(idCharset)]
	}
	return string(out)
}

func descBlock(html string) map[string]interface{} {
	return map[string]interface{}{"value": html, "chat": ""}
}

// ── Spell ───────────────────────────────────────────────────

var schoolAbbrev = map[string]string{
	"abjuration": "abj", "conjuration": "con", "divination": "div",
	"enchantment": "enc", "evocation": "evo", "illusion": "ill",
	"necromancy": "nec", "transmutation": "trs",
}

func BuildSpellDoc(s domain.SRDSpell) Doc {
	id := DeterministicID("spell", s.Name)
	school := strings.ToLower(s.School)
	if ab, ok := schoolAbbrev[school]; ok {
		school = ab
	} else if len(school) > 3 {
		school = school[:3]
	}
	props := []string{}
	if s.ComponentsV {
		props = append(props, "vocal")
	}
	if s.ComponentsS {
		props = append(props, "somatic")
	}
	if s.ComponentsM {
		props = append(props, "material")
	}
	if s.Concentration {
		props = append(props, "concentration")
	}
	if s.Ritual {
		props = append(props, "ritual")
	}
	desc := s.Description
	if s.HigherLevels != "" {
		desc += "<p><strong>At Higher Levels.</strong> " + s.HigherLevels + "</p>"
	}
	return Doc{ID: id, Name: s.Name, Body: map[string]interface{}{
		"_id": id, "name": s.Name, "type": "spell", "img": "icons/magic/symbols/runes-star-blue.webp",
		"system": map[string]interface{}{
			"description": descBlock(desc),
			"level":       s.Level,
			"school":      school,
			"properties":  props,
			"materials":   map[string]interface{}{"value": s.MaterialDesc, "consumed": false, "cost": 0, "supply": 0},
			"preparation": map[string]interface{}{"mode": "prepared", "prepared": false},
			"activation":  map[string]interface{}{"type": activationType(s.CastingTime), "value": 1, "condition": ""},
			"duration":    map[string]interface{}{"value": "", "units": durationUnits(s.Duration)},
			"range":       rangeBlock(s.Range),
			"source":      map[string]interface{}{"custom": originLabel(s.IsSRD)},
		},
	}}
}

// ── Monster (Actor npc) ─────────────────────────────────────

func BuildMonsterDoc(m domain.SRDMonster) Doc {
	id := DeterministicID("monster", m.Name)
	ability := func(v int) map[string]interface{} {
		return map[string]interface{}{"value": v, "proficient": 0}
	}
	return Doc{ID: id, Name: m.Name, Body: map[string]interface{}{
		"_id": id, "name": m.Name, "type": "npc", "img": "icons/svg/mystery-man.svg",
		"system": map[string]interface{}{
			"abilities": map[string]interface{}{
				"str": ability(m.STR), "dex": ability(m.DEX), "con": ability(m.CON),
				"int": ability(m.INT), "wis": ability(m.WIS), "cha": ability(m.CHA),
			},
			"attributes": map[string]interface{}{
				"ac":       map[string]interface{}{"flat": m.AC, "calc": "natural"},
				"hp":       map[string]interface{}{"value": m.HP, "max": m.HP, "formula": m.HitDice},
				"movement": movementFromSpeed(m.Speed),
			},
			"details": map[string]interface{}{
				"cr":        crToNumber(m.CR),
				"type":      map[string]interface{}{"value": strings.ToLower(m.Type)},
				"alignment": m.Alignment,
				"biography": descBlock(monsterBio(m)),
			},
			"traits": map[string]interface{}{
				"size":      sizeAbbrev(m.Size),
				"languages": map[string]interface{}{"value": []string{}, "custom": m.Languages},
			},
			"source": map[string]interface{}{"custom": originLabel(m.IsSRD)},
		},
	}}
}

// ── Equipment / Magic item (Item) ───────────────────────────

func BuildEquipmentDoc(e domain.SRDEquipment) Doc {
	id := DeterministicID("equipment", e.Name)
	itype := equipmentType(e)
	system := map[string]interface{}{
		"description": descBlock(e.Description),
		"weight":      map[string]interface{}{"value": e.Weight, "units": "lb"},
		"price":       map[string]interface{}{"value": e.CostGP, "denomination": orDefaultStr(e.CostUnit, "gp")},
		"rarity":      "",
		"source":      map[string]interface{}{"custom": originLabel(e.IsSRD)},
	}
	if e.DamageDice != "" {
		system["damage"] = map[string]interface{}{
			"base": map[string]interface{}{"number": nil, "denomination": nil, "types": []string{strings.ToLower(e.DamageType)}, "custom": map[string]interface{}{"enabled": true, "formula": e.DamageDice}},
		}
	}
	if e.ACBase != nil {
		system["armor"] = map[string]interface{}{"value": *e.ACBase}
	}
	return Doc{ID: id, Name: e.Name, Body: map[string]interface{}{
		"_id": id, "name": e.Name, "type": itype, "img": "icons/svg/item-bag.svg",
		"system": system,
	}}
}

func BuildMagicItemDoc(mi domain.SRDMagicItem) Doc {
	id := DeterministicID("magicitem", mi.Name)
	return Doc{ID: id, Name: mi.Name, Body: map[string]interface{}{
		"_id": id, "name": mi.Name, "type": "loot", "img": "icons/svg/item-bag.svg",
		"system": map[string]interface{}{
			"description": descBlock(mi.Description),
			"rarity":      strings.ToLower(strings.ReplaceAll(mi.Rarity, " ", "")),
			"attunement":  attunement(mi.RequiresAttunement),
			"source":      map[string]interface{}{"custom": originLabel(mi.IsSRD)},
		},
	}}
}

// ── Class / Subclass / Race (descriptive, no advancement) ───

func BuildClassDoc(c domain.SRDClass) Doc {
	id := DeterministicID("class", c.Name)
	return Doc{ID: id, Name: c.Name, Body: map[string]interface{}{
		"_id": id, "name": c.Name, "type": "class", "img": "icons/svg/upgrade.svg",
		"system": map[string]interface{}{
			"description":  descBlock(c.Description),
			"hitDice":      "d" + strconv.Itoa(c.HitDie),
			"hitDiceUsed":  0,
			"advancement":  []interface{}{},
			"spellcasting": map[string]interface{}{"ability": strings.ToLower(c.SpellcastingAbility)},
			"saves":        classSaves(c.SavingThrows),
			"source":       map[string]interface{}{"custom": originLabel(c.IsSRD)},
		},
	}}
}

func BuildSubclassDoc(sc domain.SRDSubclass) Doc {
	id := DeterministicID("subclass", sc.ClassName, sc.Name)
	return Doc{ID: id, Name: sc.Name, Body: map[string]interface{}{
		"_id": id, "name": sc.Name, "type": "subclass", "img": "icons/svg/upgrade.svg",
		"system": map[string]interface{}{
			"description":     descBlock(sc.Description),
			"classIdentifier": slug(sc.ClassName),
			"advancement":     []interface{}{},
			"source":          map[string]interface{}{"custom": originLabel(sc.IsSRD)},
		},
	}}
}

func BuildRaceDoc(r domain.SRDRace) Doc {
	id := DeterministicID("race", r.Name)
	return Doc{ID: id, Name: r.Name, Body: map[string]interface{}{
		"_id": id, "name": r.Name, "type": "race", "img": "icons/svg/mystery-man.svg",
		"system": map[string]interface{}{
			"description": descBlock(r.Description),
			"movement":    map[string]interface{}{"walk": r.Speed},
			"type":        map[string]interface{}{"value": "humanoid", "subtype": ""},
			"advancement": []interface{}{},
			"source":      map[string]interface{}{"custom": originLabel(r.IsSRD)},
		},
	}}
}

// ── helpers ─────────────────────────────────────────────────

// classSaves turns the stored saving-throw list (JSON array such as ["str","con"] or
// ["Strength","Constitution"]) into dnd5e ability keys, descriptive only (foundry-integration.md).
func classSaves(raw string) []string {
	var names []string
	if json.Unmarshal([]byte(raw), &names) != nil {
		return []string{}
	}
	out := make([]string, 0, len(names))
	for _, n := range names {
		key := strings.ToLower(strings.TrimSpace(n))
		if len(key) >= 3 {
			key = key[:3]
		}
		switch key {
		case "str", "dex", "con", "int", "wis", "cha":
			out = append(out, key)
		}
	}
	return out
}

// homebrewLabel is the source.custom value the export writes for non-SRD content.
const homebrewLabel = "Homebrew"

// IsSRDDocument reports whether a compendium document is SRD content: anything the export marked
// as homebrew in system.source.custom is not (foundry-integration.md keeps homebrew is_srd=FALSE).
func IsSRDDocument(doc *Document) bool {
	var probe struct {
		Source struct {
			Custom string `json:"custom"`
		} `json:"source"`
	}
	if doc == nil || json.Unmarshal(doc.System, &probe) != nil {
		return true
	}
	return !strings.EqualFold(strings.TrimSpace(probe.Source.Custom), homebrewLabel)
}

func originLabel(isSRD bool) string {
	if isSRD {
		return "SRD 5.1"
	}
	return homebrewLabel
}

func activationType(castingTime string) string {
	ct := strings.ToLower(castingTime)
	switch {
	case strings.Contains(ct, "bonus"):
		return "bonus"
	case strings.Contains(ct, "reaction"):
		return "reaction"
	case strings.Contains(ct, "minute"), strings.Contains(ct, "hour"):
		return "special"
	default:
		return "action"
	}
}

func durationUnits(d string) string {
	dl := strings.ToLower(d)
	switch {
	case strings.Contains(dl, "instant"):
		return "inst"
	case strings.Contains(dl, "round"):
		return "round"
	case strings.Contains(dl, "minute"):
		return "minute"
	case strings.Contains(dl, "hour"):
		return "hour"
	case strings.Contains(dl, "day"):
		return "day"
	default:
		return ""
	}
}

func rangeBlock(r string) map[string]interface{} {
	rl := strings.ToLower(r)
	if strings.Contains(rl, "self") {
		return map[string]interface{}{"units": "self"}
	}
	if strings.Contains(rl, "touch") {
		return map[string]interface{}{"units": "touch"}
	}
	// extract leading number e.g. "120 feet"
	if fields := strings.Fields(r); len(fields) > 0 {
		num := strings.TrimRight(fields[0], "ft.")
		if _, err := strconv.Atoi(num); err == nil {
			return map[string]interface{}{"value": num, "units": "ft"}
		}
	}
	return map[string]interface{}{"units": ""}
}

func crToNumber(cr string) float64 {
	switch strings.TrimSpace(cr) {
	case "0", "":
		return 0
	case "1/8":
		return 0.125
	case "1/4":
		return 0.25
	case "1/2":
		return 0.5
	}
	if f, err := strconv.ParseFloat(cr, 64); err == nil {
		return f
	}
	return 0
}

func sizeAbbrev(size string) string {
	switch strings.ToLower(size) {
	case "tiny":
		return "tiny"
	case "small":
		return "sm"
	case "medium":
		return "med"
	case "large":
		return "lg"
	case "huge":
		return "huge"
	case "gargantuan":
		return "grg"
	default:
		return "med"
	}
}

// monsterBio assembles an HTML biography from the monster's senses, languages,
// traits and actions (stored as JSON arrays of {name, description}).
func monsterBio(m domain.SRDMonster) string {
	var b strings.Builder
	if m.Senses != "" {
		b.WriteString("<p><strong>Senses.</strong> " + m.Senses + "</p>")
	}
	if m.Languages != "" {
		b.WriteString("<p><strong>Languages.</strong> " + m.Languages + "</p>")
	}
	appendNamed := func(label, raw string) {
		var items []struct {
			Name string `json:"name"`
			Desc string `json:"description"`
		}
		if json.Unmarshal([]byte(raw), &items) != nil || len(items) == 0 {
			return
		}
		b.WriteString("<h3>" + label + "</h3>")
		for _, it := range items {
			b.WriteString("<p><strong>" + it.Name + ".</strong> " + it.Desc + "</p>")
		}
	}
	appendNamed("Traits", m.Traits)
	appendNamed("Actions", m.Actions)
	appendNamed("Reactions", m.Reactions)
	appendNamed("Legendary Actions", m.LegendaryActions)
	return b.String()
}

func movementFromSpeed(speedJSON string) map[string]interface{} {
	mv := map[string]interface{}{"walk": 30, "units": "ft"}
	if speedJSON == "" {
		return mv
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(speedJSON), &parsed); err == nil {
		for k, v := range parsed {
			mv[k] = v
		}
	}
	return mv
}

func equipmentType(e domain.SRDEquipment) string {
	switch {
	case e.DamageDice != "" || e.WeaponCategory != "":
		return "weapon"
	case e.ACBase != nil || e.ArmorCategory != "":
		return "equipment"
	case strings.Contains(strings.ToLower(e.Category), "potion"), strings.Contains(strings.ToLower(e.Category), "consum"):
		return "consumable"
	case strings.Contains(strings.ToLower(e.Category), "tool"):
		return "tool"
	default:
		return "loot"
	}
}

func attunement(required bool) string {
	if required {
		return "required"
	}
	return ""
}

func orDefaultStr(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

func slug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ', r == '_', r == '/':
			b.WriteRune('-')
		}
	}
	out := b.String()
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	return strings.Trim(out, "-")
}

// Slug is the exported filename helper used by the export command.
func Slug(s string) string { return slug(s) }
