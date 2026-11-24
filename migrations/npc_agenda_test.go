package migrations

import (
	"strings"
	"testing"
)

// T-24 · contratos/T-24-pnj-hoja-inventario.md (H8): 033_npc_agenda.sql adds the game clock, the NPC agenda,
// HP and purse, and the equipped flag; Down removes all of it.
func TestNPCAgendaMigration(t *testing.T) {
	raw, err := files.ReadFile("033_npc_agenda.sql")
	if err != nil {
		t.Fatalf("033_npc_agenda.sql must be embedded: %v", err)
	}
	up, down := gooseSections(t, string(raw))
	for _, want := range []string{
		"game_day int not null default 1 check (game_day >= 1)",
		"time_of_day varchar(5) not null default 'dia' check (time_of_day in ('dia', 'tarde', 'noche'))",
		"agenda jsonb not null default '[]'",
		"hp_current int null",
		"purse_cp bigint not null default 0 check (purse_cp >= 0)",
		"equipped boolean not null default false",
	} {
		if !strings.Contains(up, want) {
			t.Errorf("Up must contain %q", want)
		}
	}
	for _, col := range []string{"equipped", "purse_cp", "hp_current", "agenda", "time_of_day", "game_day"} {
		if !strings.Contains(down, "drop column if exists "+col) {
			t.Errorf("Down must drop %s", col)
		}
	}
}
