package content

import (
	"context"
	"database/sql"
	"regexp"
	"strconv"
	"strings"
)

// LevelProgression is one class level of the spellcasting table (srd_class_spell_slots).
type LevelProgression struct {
	Level         int
	CantripsKnown int
	SpellsKnown   int // spells known or prepared, whichever the class uses
	Slots         [9]int
}

var leadingNumber = regexp.MustCompile(`(\d+)`)

// ClassProgression extracts the 20-level spellcasting progression of a 5etools class:
// cantripProgression, spellsKnownProgression / preparedSpellsProgression (array form) and
// the slot table — rowsSpellProgression for regular casters, or the "Spell Slots" /
// "Slot Level" columns for pact magic (warlock). It returns nil for non-casters.
func ClassProgression(data map[string]any) []LevelProgression {
	levels := make([]LevelProgression, 20)
	for i := range levels {
		levels[i].Level = i + 1
	}
	found := false
	if values := intList(data["cantripProgression"]); len(values) > 0 {
		found = true
		for i := 0; i < 20 && i < len(values); i++ {
			levels[i].CantripsKnown = values[i]
		}
	}
	known := intList(data["spellsKnownProgression"])
	if len(known) == 0 {
		known = intList(data["preparedSpellsProgression"]) // 2024 classes; PHB uses a formula string
	}
	if len(known) > 0 {
		found = true
		for i := 0; i < 20 && i < len(known); i++ {
			levels[i].SpellsKnown = known[i]
		}
	}
	groups, _ := data["classTableGroups"].([]any)
	for _, raw := range groups {
		group, _ := raw.(map[string]any)
		if rows, ok := group["rowsSpellProgression"].([]any); ok {
			found = true
			for i := 0; i < 20 && i < len(rows); i++ {
				for slot, count := range intList(rows[i]) {
					if slot < 9 {
						levels[i].Slots[slot] = count
					}
				}
			}
			continue
		}
		labels, _ := group["colLabels"].([]any)
		countCol, levelCol := -1, -1
		for idx, label := range labels {
			switch strings.TrimSpace(stringValue(label)) {
			case "Spell Slots":
				countCol = idx
			case "Slot Level":
				levelCol = idx
			}
		}
		if countCol < 0 || levelCol < 0 {
			continue
		}
		rows, _ := group["rows"].([]any)
		for i := 0; i < 20 && i < len(rows); i++ {
			row, _ := rows[i].([]any)
			if countCol >= len(row) || levelCol >= len(row) {
				continue
			}
			count := cellInt(row[countCol])
			slotLevel := cellInt(row[levelCol])
			if count > 0 && slotLevel >= 1 && slotLevel <= 9 {
				found = true
				levels[i].Slots[slotLevel-1] = count
			}
		}
	}
	if !found {
		return nil
	}
	return levels
}

// cellInt reads a table cell: a number, "3", "3rd" or a 5etools tag like "{@filter 3rd|...}".
func cellInt(value any) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case map[string]any:
		return cellInt(typed["value"])
	}
	match := leadingNumber.FindString(stringValue(value))
	n, _ := strconv.Atoi(match)
	return n
}

func intList(value any) []int {
	list, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]int, 0, len(list))
	for _, item := range list {
		out = append(out, cellInt(item))
	}
	return out
}

// projectClassProgression replaces the spell-slot rows of a projected class.
func projectClassProgression(ctx context.Context, tx *sql.Tx, classID int64, data map[string]any) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM srd_class_spell_slots WHERE class_id=$1`, classID); err != nil {
		return err
	}
	for _, lvl := range ClassProgression(data) {
		s := lvl.Slots
		if _, err := tx.ExecContext(ctx, `INSERT INTO srd_class_spell_slots
			(class_id, class_level, cantrips_known, spells_known, slot_1, slot_2, slot_3, slot_4, slot_5, slot_6, slot_7, slot_8, slot_9)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
			classID, lvl.Level, lvl.CantripsKnown, lvl.SpellsKnown, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8]); err != nil {
			return err
		}
	}
	return nil
}
