package content

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type Entity struct {
	Type       string
	Name       string
	Source     string
	Page       *int
	IsSRD      bool
	Origin     string
	Data       map[string]any
	SourceFile string
	Hash       string
	References []Reference
}

type Reference struct {
	Text string
	Type string
	Name string
}

type LoadResult struct {
	Entities []Entity
	Counts   map[string]int
	Sources  map[string]int
	Files    int
	Warnings []string
}

func Load(root string) (*LoadResult, error) {
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return nil, fmt.Errorf("content directory %q is not accessible", root)
	}
	var paths []string
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() && strings.EqualFold(filepath.Ext(entry.Name()), ".json") {
			paths = append(paths, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk content: %w", err)
	}
	sort.Strings(paths)
	result := &LoadResult{Counts: map[string]int{}, Sources: map[string]int{}}
	index := map[string]Entity{}
	copyIndex := map[string]Entity{}
	for _, path := range paths {
		relative, _ := filepath.Rel(root, path)
		if strings.HasPrefix(filepath.Base(path), "foundry") || strings.HasPrefix(filepath.ToSlash(relative), "generated/") {
			continue
		}
		entities, err := loadFile(root, path)
		if err != nil {
			return nil, err
		}
		for _, entity := range entities {
			key := identity(entity.Type, entity.Name, entity.Source)
			if previous, exists := index[key]; exists {
				if previous.Hash == entity.Hash {
					result.Warnings = append(result.Warnings, fmt.Sprintf("identical duplicate skipped: %s in %s", key, entity.SourceFile))
					continue
				}
				return nil, fmt.Errorf("duplicate %s in %s and %s", key, previous.SourceFile, entity.SourceFile)
			}
			index[key] = entity
			rawKey := identity(entity.Type, stringValue(entity.Data["name"]), entity.Source)
			if previous, exists := copyIndex[rawKey]; !exists || previous.Data["_copy"] != nil {
				copyIndex[rawKey] = entity
			}
			if abbreviation := stringValue(entity.Data["abbreviation"]); abbreviation != "" {
				copyIndex[identity(entity.Type, abbreviation, entity.Source)] = entity
			}
			result.Entities = append(result.Entities, entity)
			result.Counts[entity.Type]++
			result.Sources[entity.Source]++
			result.Files++
		}
	}
	for i := range result.Entities {
		entity := &result.Entities[i]
		if copySpec, ok := entity.Data["_copy"].(map[string]any); ok {
			resolved, err := resolveCopy(*entity, copySpec, copyIndex, nil)
			if err != nil {
				result.Warnings = append(result.Warnings, err.Error())
				resolved = clone(entity.Data)
				delete(resolved, "_copy")
			}
			entity.Data = resolved
		}
		entity.References = references(entity.Data)
	}
	if err := mergeSpellClassLists(root, result); err != nil {
		return nil, err
	}
	return result, nil
}

// mergeSpellClassLists attaches class lists to spells. Since 5etools v2.x a spell no longer
// carries its classes inline: they live in spells/sources.json as
// {BOOK: {SpellName: {"class": [{name, source}], "classVariant": [...]}}}. Without this the
// spell planner and the per-class spell filters find nothing. Inline "classes" win.
func mergeSpellClassLists(root string, result *LoadResult) error {
	raw, err := os.ReadFile(filepath.Join(root, "spells", "sources.json"))
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read spells/sources.json: %w", err)
	}
	var books map[string]map[string]map[string]any
	if err := json.Unmarshal(raw, &books); err != nil {
		return fmt.Errorf("parse spells/sources.json: %w", err)
	}
	lookup := map[string]map[string]any{}
	for book, spells := range books {
		for name, lists := range spells {
			lookup[normalize(book)+"|"+normalize(name)] = lists
		}
	}
	merged := 0
	for i := range result.Entities {
		entity := &result.Entities[i]
		if entity.Type != "spell" || entity.Data["classes"] != nil {
			continue
		}
		name := stringValue(entity.Data["name"])
		if name == "" {
			name = entity.Name
		}
		if lists, ok := lookup[normalize(entity.Source)+"|"+normalize(name)]; ok {
			entity.Data["classes"] = lists
			merged++
		}
	}
	if merged == 0 && result.Counts["spell"] > 0 {
		result.Warnings = append(result.Warnings, "spells/sources.json matched no spell: per-class spell lists will be empty")
	}
	return nil
}

var referencePattern = regexp.MustCompile(`\{@([A-Za-z]+)\s+([^}|]+)(?:\|([^}]*))?}`)

func loadFile(root, path string) ([]Entity, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	document, ok := decoded.(map[string]any)
	if !ok {
		if list, isList := decoded.([]any); isList {
			document = map[string]any{"data": list}
		} else {
			return nil, fmt.Errorf("parse %s: expected an object or array", path)
		}
	}
	relative, _ := filepath.Rel(root, path)
	var entities []Entity
	for entityType, value := range document {
		if entityType == "_meta" {
			continue
		}
		list, ok := value.([]any)
		if !ok {
			continue
		}
		for _, item := range list {
			data, ok := item.(map[string]any)
			if !ok {
				continue
			}
			name, _ := data["name"].(string)
			if copySpec, ok := data["_copy"].(map[string]any); ok && name == "" {
				name, _ = copySpec["name"].(string)
			}
			if name == "" {
				continue
			}
			if entityType == "data" && stringValue(data["id"]) != "" {
				name += " [" + stringValue(data["id"]) + "]"
			}
			if entityType == "classFeature" || entityType == "subclassFeature" {
				qualifier := flatIdentityText(data["className"]) + ":" + flatIdentityText(data["subclassShortName"]) + ":" + flatIdentityText(data["level"])
				name += " [" + qualifier + "]"
			}
			if entityType == "raceFeature" || entityType == "subrace" {
				name += " [" + flatIdentityText(data["raceName"]) + "]"
			}
			if entityType == "card" {
				name += " [" + flatIdentityText(data["set"]) + "]"
			}
			if entityType == "deity" {
				name += " [" + flatIdentityText(data["pantheon"]) + "]"
			}
			if entityType == "magicvariant" {
				// Qualify by the inherited source only: "inherits" is a whole item template
				// (entries, tables...), and printing it made names of several KB that broke
				// the unique index (e.g. Moonblade in 5etools v2.30).
				if inherits, ok := data["inherits"].(map[string]any); ok && stringValue(inherits["source"]) != "" {
					name += " [" + stringValue(inherits["source"]) + "]"
				}
			}
			source := stringValue(data["source"])
			if source == "" {
				source = sourceFromFile(relative)
			}
			if copySpec, ok := data["_copy"].(map[string]any); ok && stringValue(copySpec["name"]) == data["name"] && stringValue(copySpec["source"]) == source {
				name += " [reprint]"
			}
			isSRD := boolValue(data["srd"]) || boolValue(data["isSrd"])
			origin := "official"
			if boolValue(data["homebrew"]) || strings.Contains(filepath.ToSlash(relative), "homebrew") {
				origin = "homebrew"
			}
			encoded, _ := json.Marshal(data)
			hash := sha256.Sum256(encoded)
			entity := Entity{Type: entityType, Name: name, Source: source, IsSRD: isSRD, Origin: origin, Data: data, SourceFile: filepath.ToSlash(relative), Hash: hex.EncodeToString(hash[:])}
			if page := numberValue(data["page"]); page != nil {
				entity.Page = page
			}
			entities = append(entities, entity)
		}
	}
	return entities, nil
}

func resolveCopy(entity Entity, copySpec map[string]any, index map[string]Entity, seen map[string]bool) (map[string]any, error) {
	if seen == nil {
		seen = map[string]bool{}
	}
	name := stringValue(copySpec["name"])
	if name == "" {
		name = stringValue(copySpec["abbreviation"])
	}
	source := stringValue(copySpec["source"])
	if source == "" {
		source = entity.Source
	}
	key := identity(entity.Type, name, source)
	if seen[key] {
		return nil, fmt.Errorf("copy cycle at %s", key)
	}
	base, ok := index[key]
	if !ok && source != entity.Source {
		key = identity(entity.Type, name, entity.Source)
		base, ok = index[key]
	}
	if !ok {
		return nil, fmt.Errorf("unresolved copy %s referenced by %s", key, identity(entity.Type, entity.Name, entity.Source))
	}
	seen[key] = true
	baseData := base.Data
	if parentCopy, ok := baseData["_copy"].(map[string]any); ok {
		var err error
		baseData, err = resolveCopy(base, parentCopy, index, seen)
		if err != nil {
			return nil, err
		}
	}
	resolved := clone(baseData)
	delete(resolved, "_copy")
	for key, value := range entity.Data {
		if key != "_copy" && key != "_mod" {
			resolved[key] = value
		}
	}
	if mods, ok := entity.Data["_mod"].([]any); ok {
		applyMods(resolved, mods)
	}
	return resolved, nil
}

func applyMods(data map[string]any, mods []any) {
	for _, raw := range mods {
		mod, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		mode := stringValue(mod["mode"])
		path := strings.Split(stringValue(mod["path"]), ".")
		if len(path) == 1 && path[0] == "" {
			continue
		}
		var current any = data
		for _, part := range path[:len(path)-1] {
			object, ok := current.(map[string]any)
			if !ok {
				current = nil
				break
			}
			current = object[part]
		}
		object, ok := current.(map[string]any)
		if !ok {
			continue
		}
		key := path[len(path)-1]
		switch mode {
		case "replace", "replaceTxt", "replaceOrAppend":
			if value, exists := mod["items"]; exists {
				object[key] = value
			} else if value, exists := mod["values"]; exists {
				object[key] = value
			} else if value, exists := mod["str"]; exists {
				object[key] = value
			}
		case "append", "appendArr", "appendIfNotExists", "prepend", "prependArr":
			list, _ := object[key].([]any)
			values, _ := mod["items"].([]any)
			if len(values) == 0 {
				if value, exists := mod["items"]; exists {
					values = []any{value}
				}
			}
			if mode == "prepend" || mode == "prependArr" {
				object[key] = append(values, list...)
			} else {
				object[key] = append(list, values...)
			}
		case "remove", "removeArr":
			delete(object, key)
		}
	}
}

func references(value any) []Reference {
	seen := map[string]bool{}
	var result []Reference
	var visit func(any)
	visit = func(current any) {
		switch typed := current.(type) {
		case string:
			for _, match := range referencePattern.FindAllStringSubmatch(typed, -1) {
				ref := Reference{Text: match[0], Type: match[1]}
				parts := strings.Split(match[2], "|")
				ref.Name = parts[0]
				if len(parts) > 1 {
					ref.Text = match[0]
				}
				key := ref.Type + "|" + ref.Text
				if !seen[key] {
					seen[key] = true
					result = append(result, ref)
				}
			}
		case []any:
			for _, child := range typed {
				visit(child)
			}
		case map[string]any:
			for _, child := range typed {
				visit(child)
			}
		}
	}
	visit(value)
	return result
}

func identity(entityType, name, source string) string {
	return entityType + "|" + normalize(name) + "|" + normalize(source)
}

func Normalize(value string) string { return normalize(value) }
func normalize(value string) string { return strings.Join(strings.Fields(strings.ToLower(value)), " ") }

// flatIdentityText renders a value used to qualify an entity name. Scalars are used as is;
// anything else (maps, lists) becomes a short stable hash so identity strings stay small
// enough for the (entity_type, normalized_name, source) btree index.
func flatIdentityText(value any) string {
	if text := stringValue(value); text != "" {
		return text
	}
	switch value.(type) {
	case nil:
		return ""
	case map[string]any, []any:
		encoded, _ := json.Marshal(value)
		sum := sha256.Sum256(encoded)
		return hex.EncodeToString(sum[:4])
	}
	return fmt.Sprint(value)
}

func sourceFromFile(path string) string {
	base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	parts := strings.Split(base, "-")
	return strings.ToUpper(parts[len(parts)-1])
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		return ""
	}
}

func boolValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return typed == "true" || typed == "1"
	case float64:
		return typed != 0
	default:
		return false
	}
}

func numberValue(value any) *int {
	var number int
	switch typed := value.(type) {
	case float64:
		number = int(typed)
	case int:
		number = typed
	case string:
		parsed, err := strconv.Atoi(typed)
		if err != nil {
			return nil
		}
		number = parsed
	default:
		return nil
	}
	return &number
}

func clone(value map[string]any) map[string]any {
	encoded, _ := json.Marshal(value)
	var result map[string]any
	_ = json.Unmarshal(encoded, &result)
	return result
}
