package migrations

import (
	"strings"
	"testing"
)

// T-18 · contratos/T-18-ruta-datos-api.md: 032_npc_routines.sql adds the NPC link, disposition and route
// columns to vtt_tokens, backfills the disposition and indexes running routes; Down removes all of it.
func TestNPCRoutinesMigration(t *testing.T) {
	raw, err := files.ReadFile("032_npc_routines.sql")
	if err != nil {
		t.Fatalf("032_npc_routines.sql must be embedded: %v", err)
	}
	up, down := gooseSections(t, string(raw))
	for _, want := range []string{
		"npc_id bigint null references campaign_npcs(id) on delete set null",
		"disposition varchar(10) not null default 'neutral' check (disposition in ('hostile', 'neutral', 'friendly'))",
		"route jsonb null",
		"route_paused boolean not null default false",
		"route_elapsed_ms bigint not null default 0 check (route_elapsed_ms >= 0)",
		"route_started_at timestamptz null",
		"set disposition = 'hostile' where kind = 'monster' or (kind = 'npc' and detects)",
		"on vtt_tokens(scene_id) where route_started_at is not null",
	} {
		if !strings.Contains(up, want) {
			t.Errorf("Up must contain %q", want)
		}
	}
	for _, col := range []string{"npc_id", "disposition", "route", "route_paused", "route_elapsed_ms", "route_started_at"} {
		if !strings.Contains(down, "drop column if exists "+col+",") && !strings.Contains(down, "drop column if exists "+col+";") {
			t.Errorf("Down must drop %s", col)
		}
	}
}
