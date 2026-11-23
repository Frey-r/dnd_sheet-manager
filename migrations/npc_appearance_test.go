package migrations

import (
	"regexp"
	"strings"
	"testing"
)

// T-13 · contratos/T-13-npc-datos.md (D-0041): 031_npc_appearance.sql adds race, class and appearance
// to campaign_npcs (race and class TEXT NOT NULL with an empty default, appearance JSONB NULL, so the NPCs created
// before it keep working) and its Down removes them.
func TestNPCAppearanceMigration(t *testing.T) {
	raw, err := files.ReadFile("031_npc_appearance.sql")
	if err != nil {
		t.Fatalf("031_npc_appearance.sql must be embedded with the other migrations: %v", err)
	}
	up, down := gooseSections(t, string(raw))

	if !regexp.MustCompile(`alter table (if exists )?(only )?"?campaign_npcs"?`).MatchString(up) {
		t.Errorf("Up must alter campaign_npcs:\n%s", up)
	}
	for _, column := range []string{"race", "class"} {
		want := regexp.MustCompile(`add column (if not exists )?"?` + column + `"? text (not null default ''|default '' not null)`)
		if !want.MatchString(up) {
			t.Errorf("Up must add %s TEXT NOT NULL DEFAULT '':\n%s", column, up)
		}
	}
	appearance := regexp.MustCompile(`add column (if not exists )?"?appearance"? jsonb( null)?\s*(,|;|$)`)
	if !appearance.MatchString(up) {
		t.Errorf("Up must add appearance JSONB NULL (no default, nullable):\n%s", up)
	}
	if strings.Contains(up, "raise exception") {
		t.Errorf("Up must not abort:\n%s", up)
	}
	for _, column := range []string{"race", "class", "appearance"} {
		if !regexp.MustCompile(`drop column (if exists )?"?` + column + `"?\s*(,|;|$)`).MatchString(down) {
			t.Errorf("Down must drop %s:\n%s", column, down)
		}
	}
	if !strings.Contains(down, "campaign_npcs") {
		t.Errorf("Down must alter campaign_npcs:\n%s", down)
	}
}

// gooseSections returns the Up and Down statements of a goose SQL migration, lowercased, without
// comments and with whitespace collapsed.
func gooseSections(t *testing.T, sql string) (up, down string) {
	t.Helper()
	var current *[]string
	var upLines, downLines []string
	for _, line := range strings.Split(sql, "\n") {
		trimmed := strings.ToLower(strings.TrimSpace(line))
		switch {
		case strings.HasPrefix(trimmed, "-- +goose up"):
			current = &upLines
		case strings.HasPrefix(trimmed, "-- +goose down"):
			current = &downLines
		case strings.HasPrefix(trimmed, "--"), trimmed == "":
		case current != nil:
			*current = append(*current, trimmed)
		}
	}
	if upLines == nil && downLines == nil && current == nil {
		t.Fatal("not a goose migration: missing -- +goose Up / -- +goose Down")
	}
	collapse := regexp.MustCompile(`\s+`)
	return collapse.ReplaceAllString(strings.Join(upLines, " "), " "), collapse.ReplaceAllString(strings.Join(downLines, " "), " ")
}
