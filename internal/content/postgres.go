package content

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type ImportSummary struct {
	Inserted  int            `json:"inserted"`
	Updated   int            `json:"updated"`
	Unchanged int            `json:"unchanged"`
	Counts    map[string]int `json:"counts"`
	Sources   map[string]int `json:"sources"`
	Warnings  []string       `json:"warnings"`
}

func Import(ctx context.Context, db *sql.DB, root string, loaded *LoadResult) (*ImportSummary, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rootHash := sha256.Sum256([]byte(root))
	var importID int64
	if err := tx.QueryRowContext(ctx, `INSERT INTO content_imports(root_path_hash, status) VALUES($1, 'running') RETURNING id`, hex.EncodeToString(rootHash[:])).Scan(&importID); err != nil {
		return nil, fmt.Errorf("create import record: %w", err)
	}
	summary := &ImportSummary{Counts: loaded.Counts, Sources: loaded.Sources, Warnings: loaded.Warnings}
	ids := map[string]int64{}
	stmt, err := tx.PrepareContext(ctx, `INSERT INTO content_entities
		(entity_type, name, normalized_name, source, page, is_srd, origin, data, search_text, source_file, content_hash, updated_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
		ON CONFLICT(entity_type, normalized_name, source) DO UPDATE SET
			name=EXCLUDED.name, page=EXCLUDED.page, is_srd=EXCLUDED.is_srd, data=EXCLUDED.data,
			search_text=EXCLUDED.search_text, source_file=EXCLUDED.source_file, content_hash=EXCLUDED.content_hash,
			updated_at=NOW()
		WHERE content_entities.origin='official'
		RETURNING id`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()
	for _, entity := range loaded.Entities {
		key := identity(entity.Type, entity.Name, entity.Source)
		var existingID int64
		var existingHash string
		err := tx.QueryRowContext(ctx, `SELECT id, content_hash FROM content_entities WHERE entity_type=$1 AND normalized_name=$2 AND source=$3`, entity.Type, normalize(entity.Name), entity.Source).Scan(&existingID, &existingHash)
		if err != nil && err != sql.ErrNoRows {
			return nil, fmt.Errorf("read %s: %w", key, err)
		}
		encoded, err := json.Marshal(entity.Data)
		if err != nil {
			return nil, err
		}
		if err == sql.ErrNoRows {
			summary.Inserted++
		} else if existingHash == entity.Hash {
			summary.Unchanged++
		} else {
			summary.Updated++
		}
		var id int64
		err = stmt.QueryRowContext(ctx, entity.Type, entity.Name, normalize(entity.Name), entity.Source, entity.Page, entity.IsSRD, entity.Origin, encoded, searchText(entity.Data), entity.SourceFile, entity.Hash).Scan(&id)
		if err == sql.ErrNoRows {
			id = existingID
		} else if err != nil {
			return nil, fmt.Errorf("store %s: %w", key, err)
		}
		ids[key] = id
		if _, err := tx.ExecContext(ctx, `DELETE FROM content_references WHERE entity_id=$1`, id); err != nil {
			return nil, err
		}
		if err := projectLegacy(ctx, tx, id, entity); err != nil {
			return nil, fmt.Errorf("project %s: %w", key, err)
		}
	}
	for _, entity := range loaded.Entities {
		id := ids[identity(entity.Type, entity.Name, entity.Source)]
		for _, ref := range entity.References {
			var targetID any
			var candidates []int64
			rows, err := tx.QueryContext(ctx, `SELECT id FROM content_entities WHERE entity_type=$1 AND normalized_name=$2 LIMIT 2`, ref.Type, normalize(ref.Name))
			if err != nil {
				return nil, err
			}
			for rows.Next() {
				var candidate int64
				if err := rows.Scan(&candidate); err != nil {
					rows.Close()
					return nil, err
				}
				candidates = append(candidates, candidate)
			}
			rows.Close()
			if len(candidates) == 1 {
				targetID = candidates[0]
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO content_references(entity_id, reference_text, reference_type, target_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, id, ref.Text, ref.Type, targetID); err != nil {
				return nil, err
			}
		}
	}
	counts, _ := json.Marshal(summary)
	if _, err := tx.ExecContext(ctx, `UPDATE content_imports SET status='completed', counts=$1, completed_at=NOW() WHERE id=$2`, counts, importID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit import: %w", err)
	}
	return summary, nil
}

func projectLegacy(ctx context.Context, tx *sql.Tx, contentID int64, entity Entity) error {
	data := entity.Data
	jsonValue := func(value any) string { encoded, _ := json.Marshal(value); return string(encoded) }
	switch entity.Type {
	case "spell":
		components, _ := data["components"].(map[string]any)
		_, err := tx.ExecContext(ctx, `INSERT INTO srd_spells(name,level,school,casting_time,range,duration,concentration,ritual,components_v,components_s,components_m,material_desc,description,higher_levels,classes,damage_type,area_type,is_srd,source,content_entity_id)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
			ON CONFLICT(name,source) DO UPDATE SET level=EXCLUDED.level,school=EXCLUDED.school,casting_time=EXCLUDED.casting_time,range=EXCLUDED.range,duration=EXCLUDED.duration,concentration=EXCLUDED.concentration,ritual=EXCLUDED.ritual,components_v=EXCLUDED.components_v,components_s=EXCLUDED.components_s,components_m=EXCLUDED.components_m,material_desc=EXCLUDED.material_desc,description=EXCLUDED.description,higher_levels=EXCLUDED.higher_levels,classes=EXCLUDED.classes,damage_type=EXCLUDED.damage_type,area_type=EXCLUDED.area_type,is_srd=EXCLUDED.is_srd,content_entity_id=EXCLUDED.content_entity_id`,
			entity.Name, intValue(data["level"]), schoolName(stringValue(data["school"])), flatText(data["time"]), flatText(data["range"]), flatText(data["duration"]), nestedBool(data, "duration", "concentration"), nestedBool(data, "meta", "ritual"), components["v"] == true, components["s"] == true, components["m"] != nil && components["m"] != false, flatText(components["m"]), flatText(data["entries"]), flatText(data["entriesHigherLevel"]), jsonValue(classNames(data["classes"])), flatText(data["damageInflict"]), flatText(data["areaTags"]), entity.IsSRD, entity.Source, contentID)
		return err
	case "monster":
		ac := firstNumber(data["ac"], 10)
		hp := monsterHP(data["hp"])
		monsterType, subtype := monsterTypeParts(data["type"])
		cr := flatText(data["cr"])
		if crData, ok := data["cr"].(map[string]any); ok {
			cr = flatText(crData["cr"])
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO srd_monsters(name,size,type,subtype,alignment,ac,ac_type,hp,hit_dice,speed,str,dex,con,"int",wis,cha,cr,xp,senses,languages,traits,actions,legendary_actions,reactions,resistances,immunities,vulnerabilities,condition_immunities,saving_throws,skills,proficiency_bonus,is_srd,source,content_entity_id)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
			ON CONFLICT(name,source) DO UPDATE SET size=EXCLUDED.size,type=EXCLUDED.type,subtype=EXCLUDED.subtype,alignment=EXCLUDED.alignment,ac=EXCLUDED.ac,hp=EXCLUDED.hp,hit_dice=EXCLUDED.hit_dice,speed=EXCLUDED.speed,str=EXCLUDED.str,dex=EXCLUDED.dex,con=EXCLUDED.con,"int"=EXCLUDED.int,wis=EXCLUDED.wis,cha=EXCLUDED.cha,cr=EXCLUDED.cr,xp=EXCLUDED.xp,senses=EXCLUDED.senses,languages=EXCLUDED.languages,traits=EXCLUDED.traits,actions=EXCLUDED.actions,legendary_actions=EXCLUDED.legendary_actions,reactions=EXCLUDED.reactions,is_srd=EXCLUDED.is_srd,content_entity_id=EXCLUDED.content_entity_id`,
			entity.Name, sizeName(firstString(data["size"], "M")), monsterType, subtype, flatText(data["alignment"]), ac, flatText(data["ac"]), hp, nestedString(data, "hp", "formula"), jsonValue(data["speed"]), intValue(data["str"]), intValue(data["dex"]), intValue(data["con"]), intValue(data["int"]), intValue(data["wis"]), intValue(data["cha"]), cr, crXP(cr), flatText(data["senses"]), flatText(data["languages"]), jsonValue(data["trait"]), jsonValue(data["action"]), jsonValue(data["legendary"]), jsonValue(data["reaction"]), flatText(data["resist"]), flatText(data["immune"]), flatText(data["vulnerable"]), flatText(data["conditionImmune"]), jsonValue(data["save"]), jsonValue(data["skill"]), proficiency(cr), entity.IsSRD, entity.Source, contentID)
		return err
	case "class":
		hitDie := 8
		if hd, ok := data["hd"].(map[string]any); ok {
			hitDie = intValue(hd["faces"])
		}
		var classID int64
		err := tx.QueryRowContext(ctx, `INSERT INTO srd_classes(name,hit_die,primary_ability,saving_throws,armor_proficiencies,weapon_proficiencies,tool_proficiencies,skill_choices,starting_equipment,spellcasting_ability,description,is_srd,source,content_entity_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(name,source) DO UPDATE SET hit_die=EXCLUDED.hit_die,primary_ability=EXCLUDED.primary_ability,saving_throws=EXCLUDED.saving_throws,armor_proficiencies=EXCLUDED.armor_proficiencies,weapon_proficiencies=EXCLUDED.weapon_proficiencies,tool_proficiencies=EXCLUDED.tool_proficiencies,skill_choices=EXCLUDED.skill_choices,starting_equipment=EXCLUDED.starting_equipment,spellcasting_ability=EXCLUDED.spellcasting_ability,description=EXCLUDED.description,is_srd=EXCLUDED.is_srd,content_entity_id=EXCLUDED.content_entity_id RETURNING id`,
			entity.Name, hitDie, jsonValue(primaryAbilities(data["primaryAbility"])), jsonValue(data["proficiency"]),
			jsonValue(proficiencyList(data, "armor")), jsonValue(proficiencyList(data, "weapons")), jsonValue(proficiencyList(data, "tools")),
			jsonValue(skillChoices(data)), startingEquipmentText(data["startingEquipment"]), flatText(data["spellcastingAbility"]), flatText(data["entries"]), entity.IsSRD, entity.Source, contentID).Scan(&classID)
		if err != nil {
			return err
		}
		// The spell planner reads srd_class_spell_slots; project the class table into it.
		return projectClassProgression(ctx, tx, classID, data)
	case "race":
		_, err := tx.ExecContext(ctx, `INSERT INTO srd_races(name,speed,size,ability_bonuses,traits,languages,subraces,description,is_srd,source,content_entity_id,skill_proficiencies) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(name,source) DO UPDATE SET speed=EXCLUDED.speed,size=EXCLUDED.size,ability_bonuses=EXCLUDED.ability_bonuses,traits=EXCLUDED.traits,languages=EXCLUDED.languages,description=EXCLUDED.description,is_srd=EXCLUDED.is_srd,content_entity_id=EXCLUDED.content_entity_id,skill_proficiencies=EXCLUDED.skill_proficiencies`, entity.Name, firstNumber(data["speed"], 30), firstString(data["size"], "M"), jsonValue(data["ability"]), jsonValue(data["entries"]), jsonValue(data["languageProficiencies"]), jsonValue(data["subraces"]), flatText(data["entries"]), entity.IsSRD, entity.Source, contentID, jsonValue(fixedSkillProficiencies(data["skillProficiencies"])))
		return err
	case "subclass":
		_, err := tx.ExecContext(ctx, `INSERT INTO srd_subclasses(class_name,name,description,is_srd,source,content_entity_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(class_name,name,source) DO UPDATE SET description=EXCLUDED.description,is_srd=EXCLUDED.is_srd,content_entity_id=EXCLUDED.content_entity_id`, flatText(data["className"]), entity.Name, flatText(data["entries"]), entity.IsSRD, entity.Source, contentID)
		return err
	case "condition", "status", "disease":
		_, err := tx.ExecContext(ctx, `INSERT INTO srd_conditions(name,description,effects,is_srd) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description,effects=EXCLUDED.effects,is_srd=EXCLUDED.is_srd`, entity.Name, flatText(data["entries"]), jsonValue(data["entries"]), entity.IsSRD)
		return err
	case "variantrule", "action", "skill", "sense":
		_, err := tx.ExecContext(ctx, `INSERT INTO srd_rules(name,category,content,is_srd) VALUES($1,$2,$3,$4) ON CONFLICT(name,category) DO UPDATE SET content=EXCLUDED.content,is_srd=EXCLUDED.is_srd`, entity.Name, entity.Type, flatText(data["entries"]), entity.IsSRD)
		return err
	case "item", "baseitem", "magicvariant":
		cost := 0.0
		unit := "gp"
		if value := numberFloat(data["value"]); value > 0 {
			cost = value
			unit = "cp"
		}
		rarity := flatText(data["rarity"])
		if rarity == "" || rarity == "none" {
			rarity = "common"
		}
		eq := projectEquipment(data)
		category := eq.Category
		rangeNormal, rangeLong := weaponRanges(data["range"])
		_, err := tx.ExecContext(ctx, `INSERT INTO srd_equipment(name,category,cost_gp,cost_unit,weight,description,damage_dice,damage_type,weapon_category,weapon_range,range_normal,range_long,properties,ac_base,ac_dex_bonus,ac_max_bonus,str_minimum,stealth_disadvantage,armor_category,is_srd,source,content_entity_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) ON CONFLICT(name,source) DO UPDATE SET category=EXCLUDED.category,cost_gp=EXCLUDED.cost_gp,cost_unit=EXCLUDED.cost_unit,weight=EXCLUDED.weight,description=EXCLUDED.description,damage_dice=EXCLUDED.damage_dice,damage_type=EXCLUDED.damage_type,weapon_category=EXCLUDED.weapon_category,weapon_range=EXCLUDED.weapon_range,range_normal=EXCLUDED.range_normal,range_long=EXCLUDED.range_long,properties=EXCLUDED.properties,ac_base=EXCLUDED.ac_base,ac_dex_bonus=EXCLUDED.ac_dex_bonus,ac_max_bonus=EXCLUDED.ac_max_bonus,str_minimum=EXCLUDED.str_minimum,stealth_disadvantage=EXCLUDED.stealth_disadvantage,armor_category=EXCLUDED.armor_category,is_srd=EXCLUDED.is_srd,content_entity_id=EXCLUDED.content_entity_id`, entity.Name, category, cost, unit, numberFloat(data["weight"]), flatText(data["entries"]), flatText(data["dmg1"]), flatText(data["dmgType"]), flatText(data["weaponCategory"]), eq.WeaponRange, rangeNormal, rangeLong, jsonValue(data["property"]), nullableInt(data["ac"]), eq.DexBonus, eq.MaxDexBonus, eq.StrMinimum, boolValue(data["stealth"]), eq.ArmorCategory, entity.IsSRD, entity.Source, contentID)
		if err != nil {
			return err
		}
		if data["rarity"] != nil {
			_, err = tx.ExecContext(ctx, `INSERT INTO srd_magic_items(name,rarity,requires_attunement,attunement_desc,description,category,is_srd,source,content_entity_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(name,source) DO UPDATE SET rarity=EXCLUDED.rarity,requires_attunement=EXCLUDED.requires_attunement,description=EXCLUDED.description,is_srd=EXCLUDED.is_srd,content_entity_id=EXCLUDED.content_entity_id`, entity.Name, rarity, data["reqAttune"] != nil && data["reqAttune"] != false, flatText(data["reqAttune"]), flatText(data["entries"]), category, entity.IsSRD, entity.Source, contentID)
		}
		return err
	}
	return nil
}

// fixedSkillProficiencies returns the skills a 5etools `skillProficiencies` list always grants
// (e.g. [{"perception": true}] -> ["perception"]). The list holds alternative options; the
// first one is used and choices ({"choose": ...}, {"any": n}) are skipped. Never nil.
func fixedSkillProficiencies(value any) []string {
	skills := []string{}
	options, _ := value.([]any)
	if len(options) == 0 {
		return skills
	}
	first, _ := options[0].(map[string]any)
	for key, granted := range first {
		if granted == true {
			skills = append(skills, strings.ToLower(key))
		}
	}
	sort.Strings(skills)
	return skills
}

func searchText(value any) string {
	text := flatText(value)
	if len(text) > 1000000 {
		return text[:1000000]
	}
	return text
}
func flatText(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case bool:
		return strconv.FormatBool(typed)
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case []any:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := flatText(item); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, " ")
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		parts := []string{}
		for _, key := range keys {
			if text := flatText(typed[key]); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, " ")
	default:
		return fmt.Sprint(typed)
	}
}
func intValue(value any) int {
	if number := numberValue(value); number != nil {
		return *number
	}
	return 0
}
func numberFloat(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case string:
		parsed, _ := strconv.ParseFloat(typed, 64)
		return parsed
	default:
		return 0
	}
}
func firstString(value any, fallback string) string {
	if list, ok := value.([]any); ok && len(list) > 0 {
		return flatText(list[0])
	}
	if text := flatText(value); text != "" {
		return text
	}
	return fallback
}
func firstNumber(value any, fallback int) int {
	if list, ok := value.([]any); ok && len(list) > 0 {
		if object, ok := list[0].(map[string]any); ok {
			// Monster AC entries are {"ac": 19, "from": [...]}; speeds and others use "number".
			if ac, present := object["ac"]; present {
				return intValue(ac)
			}
			return intValue(object["number"])
		}
		return intValue(list[0])
	}
	if number := numberValue(value); number != nil {
		return *number
	}
	return fallback
}
func nestedString(data map[string]any, key, child string) string {
	if object, ok := data[key].(map[string]any); ok {
		return flatText(object[child])
	}
	return ""
}
func nestedBool(data map[string]any, key, child string) bool {
	if list, ok := data[key].([]any); ok {
		for _, item := range list {
			if object, ok := item.(map[string]any); ok && boolValue(object[child]) {
				return true
			}
		}
	}
	if object, ok := data[key].(map[string]any); ok {
		return boolValue(object[child])
	}
	return false
}
func nullableInt(value any) any {
	if number := numberValue(value); number != nil {
		return *number
	}
	return nil
}
func classNames(value any) []string {
	names := []string{}
	seen := map[string]bool{}
	var visit func(any)
	visit = func(current any) {
		switch typed := current.(type) {
		case []any:
			for _, child := range typed {
				visit(child)
			}
		case map[string]any:
			if name := stringValue(typed["name"]); name != "" {
				if !seen[name] { // the same class appears once per edition (PHB, XPHB...)
					seen[name] = true
					names = append(names, name)
				}
			} else {
				for _, child := range typed {
					visit(child)
				}
			}
		}
	}
	visit(value)
	return names
}
func proficiency(cr string) int {
	value := crValue(cr)
	if value >= 29 {
		return 9
	}
	if value >= 25 {
		return 8
	}
	if value >= 21 {
		return 7
	}
	if value >= 17 {
		return 6
	}
	if value >= 13 {
		return 5
	}
	if value >= 9 {
		return 4
	}
	if value >= 5 {
		return 3
	}
	return 2
}
func crXP(cr string) int {
	// XP by integer CR 0..30 (DMG). The fractional CRs are handled below. The previous table
	// also listed the fractional values here, which shifted every CR >= 1 (CR 1 gave 10 XP,
	// CR 5 gave 200) and broke encounter budgets for the whole catalog.
	values := []int{10, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000}
	value := crValue(cr)
	if value == 0.125 {
		return 25
	}
	if value == 0.25 {
		return 50
	}
	if value == 0.5 {
		return 100
	}
	index := int(value)
	if index >= 0 && index < len(values) {
		return values[index]
	}
	return 0
}
func crValue(cr string) float64 {
	if strings.Contains(cr, "/") {
		parts := strings.SplitN(cr, "/", 2)
		a, _ := strconv.ParseFloat(parts[0], 64)
		b, _ := strconv.ParseFloat(parts[1], 64)
		if b != 0 {
			return a / b
		}
	}
	value, _ := strconv.ParseFloat(cr, 64)
	return value
}

// monsterTypeParts splits a 5etools creature type into the main type and its tags:
// "dragon" | {"type":"humanoid","tags":["goblinoid"]} | {"type":{"choose":["beast","monstrosity"]}}.
// The main type alone is what the bestiary and encounter builder filter on.
func monsterTypeParts(value any) (string, string) {
	object, ok := value.(map[string]any)
	if !ok {
		return strings.ToLower(flatText(value)), ""
	}
	main := ""
	switch typed := object["type"].(type) {
	case string:
		main = typed
	case map[string]any:
		if choices, ok := typed["choose"].([]any); ok {
			parts := make([]string, 0, len(choices))
			for _, choice := range choices {
				parts = append(parts, flatText(choice))
			}
			main = strings.Join(parts, " or ")
		}
	}
	var tags []string
	if list, ok := object["tags"].([]any); ok {
		for _, tag := range list {
			if tagObject, ok := tag.(map[string]any); ok {
				tags = append(tags, flatText(tagObject["tag"]))
			} else if text := flatText(tag); text != "" {
				tags = append(tags, text)
			}
		}
	}
	return strings.ToLower(strings.TrimSpace(main)), strings.Join(tags, ", ")
}

// sizeName maps 5etools size codes to the words the UI and filters use.
func sizeName(code string) string {
	switch strings.ToUpper(strings.TrimSpace(code)) {
	case "T":
		return "Tiny"
	case "S":
		return "Small"
	case "M":
		return "Medium"
	case "L":
		return "Large"
	case "H":
		return "Huge"
	case "G":
		return "Gargantuan"
	}
	return code
}

// schoolName expands 5etools school codes ("V") to the names the UI and filters use.
func schoolName(code string) string {
	names := map[string]string{"A": "Abjuration", "C": "Conjuration", "D": "Divination", "E": "Enchantment",
		"V": "Evocation", "I": "Illusion", "N": "Necromancy", "T": "Transmutation", "P": "Psionic"}
	if name, ok := names[strings.ToUpper(strings.TrimSpace(code))]; ok {
		return name
	}
	return code
}

// primaryAbilities turns 5etools' [{"int":true},{"str":true,"dex":true}] into ["int","str","dex"].
func primaryAbilities(value any) []string {
	out := []string{}
	seen := map[string]bool{}
	list, _ := value.([]any)
	for _, option := range list {
		object, _ := option.(map[string]any)
		for _, key := range []string{"str", "dex", "con", "int", "wis", "cha"} {
			if object[key] == true && !seen[key] {
				seen[key] = true
				out = append(out, key)
			}
		}
	}
	return out
}

// proficiencyList reads one list of a class's startingProficiencies (armor, weapons, tools).
// Before, the whole startingProficiencies object was stored in every column, so the UI showed
// no armor, weapons or tools for any catalog class.
func proficiencyList(data map[string]any, key string) []any {
	starting, _ := data["startingProficiencies"].(map[string]any)
	list, _ := starting[key].([]any)
	if list == nil {
		return []any{}
	}
	return list
}

// skillChoices maps startingProficiencies.skills ([{"choose":{"from":[...],"count":2}}]) to the
// {count, options} shape the character creator reads.
func skillChoices(data map[string]any) map[string]any {
	starting, _ := data["startingProficiencies"].(map[string]any)
	skills, _ := starting["skills"].([]any)
	for _, entry := range skills {
		object, _ := entry.(map[string]any)
		if choose, ok := object["choose"].(map[string]any); ok {
			count := intValue(choose["count"])
			if count == 0 {
				count = 1
			}
			options, _ := choose["from"].([]any)
			return map[string]any{"count": count, "options": options}
		}
		if anyCount := intValue(object["any"]); anyCount > 0 {
			return map[string]any{"count": anyCount, "options": []any{"any"}}
		}
	}
	return map[string]any{}
}

// startingEquipmentText prefers the readable "entries" (2024 classes) or the "default" list
// (2014 classes) over flattening the whole object, which mixed in machine data such as
// "true dagger|xphb 500 5500".
func startingEquipmentText(value any) string {
	object, _ := value.(map[string]any)
	if object == nil {
		return flatText(value)
	}
	for _, key := range []string{"entries", "default"} {
		if list, ok := object[key].([]any); ok && len(list) > 0 {
			lines := make([]string, 0, len(list))
			for _, line := range list {
				if text := strings.TrimSpace(flatText(line)); text != "" {
					lines = append(lines, text)
				}
			}
			return strings.Join(lines, "\n")
		}
	}
	return ""
}

// monsterHP reads a 5etools hp block: {"average": 7, "formula": "2d6"} or {"special": "7"}
// ("special" is also used for text such as "equal to the summoner's level"). A leading number
// in "special" is used; anything unreadable falls back to 1.
func monsterHP(value any) int {
	object, _ := value.(map[string]any)
	if average := intValue(object["average"]); average > 0 {
		return average
	}
	if special, ok := object["special"].(string); ok {
		digits := ""
		for _, r := range strings.TrimSpace(special) {
			if r < '0' || r > '9' {
				break
			}
			digits += string(r)
		}
		if n, err := strconv.Atoi(digits); err == nil && n > 0 {
			return n
		}
	}
	return 1
}
