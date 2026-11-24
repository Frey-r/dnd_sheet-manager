package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// T-25 · contratos/T-25-agenda-api.md

// I5
func TestValidateNPCInventory(t *testing.T) {
	v := int64(10)
	ok := domain.NPCDocInventory{MonedasCP: 5, Objetos: []domain.NPCDocItem{{Nombre: "Daga", Cantidad: 2, ValorCP: &v, Donde: "encima", Equipado: true}, {Nombre: "Carta", Cantidad: 1, Donde: "casa"}}}
	if err := ValidateNPCInventory(ok); err != nil {
		t.Fatalf("valid inventory rejected: %v", err)
	}
	neg := int64(-1)
	bad := domain.NPCDocInventory{MonedasCP: -3, Objetos: []domain.NPCDocItem{
		{Nombre: " ", Cantidad: 1, Donde: "encima"},
		{Nombre: "Daga", Cantidad: 0, Donde: "encima"},
		{Nombre: "Daga", Cantidad: 1, Donde: "mochila"},
		{Nombre: "Daga", Cantidad: 1, Donde: "encima", ValorCP: &neg},
		{Nombre: "Carta", Cantidad: 1, Donde: "casa", Equipado: true},
	}}
	err := ValidateNPCInventory(bad)
	var ae AgendaError
	if !errors.As(err, &ae) {
		t.Fatalf("want AgendaError, got %v", err)
	}
	for i, w := range []string{"monedas", "objeto 1: nombre", "objeto 2: cantidad", "objeto 3: donde", "objeto 4: valor", "objeto 5: equipado"} {
		if i >= len(ae.Problems) || !strings.Contains(ae.Problems[i], w) {
			t.Errorf("problem %d = %v, want %q", i, ae.Problems, w)
		}
	}
	many := domain.NPCDocInventory{Objetos: make([]domain.NPCDocItem, 501)}
	if err := ValidateNPCInventory(many); err == nil || !strings.Contains(err.Error(), "500") {
		t.Fatalf("more than 500 items must fail, got %v", err)
	}
}

func agendaFixture(t *testing.T) (*routeFixture, *NPCAgenda, *repository.NPCRepository) {
	f := newRouteFixture(t)
	repo := repository.NewNPCRepository(f.db)
	return f, NewNPCAgenda(repo, f.repo, f.play, nil), repo
}

// I1
func TestGameClockRealDB(t *testing.T) {
	f, svc, _ := agendaFixture(t)
	ctx := context.Background()
	c, err := svc.Clock(ctx, f.campaignID)
	if err != nil || c.GameDay != 1 || c.TimeOfDay != "dia" || c.FirstWeekday != "lunes" || c.Weekday != "lunes" {
		t.Fatalf("default clock = %+v, %v", c, err)
	}
	first := "sabado"
	c, err = svc.SetClock(ctx, f.campaignID, ClockChange{GameDay: 3, TimeOfDay: "tarde", FirstWeekday: &first})
	if err != nil || c.GameDay != 3 || c.TimeOfDay != "tarde" || c.Weekday != "lunes" {
		t.Fatalf("set clock = %+v, %v (day 3 starting saturday is lunes)", c, err)
	}
	c, err = svc.SetClock(ctx, f.campaignID, ClockChange{Step: 2})
	if err != nil || c.GameDay != 4 || c.TimeOfDay != "dia" {
		t.Fatalf("step 2 = %+v, %v", c, err)
	}
	for _, bad := range []ClockChange{{GameDay: 0, TimeOfDay: "dia"}, {GameDay: 2, TimeOfDay: "madrugada"}, {Step: 1, GameDay: 2, TimeOfDay: "dia"}} {
		if _, err := svc.SetClock(ctx, f.campaignID, bad); !errors.Is(err, ErrInvalidClock) {
			t.Errorf("%+v: want ErrInvalidClock, got %v", bad, err)
		}
	}
	bad := "festivo"
	if _, err := svc.SetClock(ctx, f.campaignID, ClockChange{Step: 1, FirstWeekday: &bad}); !errors.Is(err, ErrInvalidClock) {
		t.Fatalf("unknown first weekday: %v", err)
	}
}

// I2
func TestNPCAgendaSaveResolveRealDB(t *testing.T) {
	f, svc, _ := agendaFixture(t)
	ctx := context.Background()
	var raw = `[{"dia":"todos","momento":"noche","ubicacion":{"escena_id":` + itoa(f.sceneID) + `},"posicion":{"x":70,"y":70},"path":null},
		{"dia":"todos","momento":"noche","ubicacion":null}]`
	var dup domain.Agenda
	if err := json.Unmarshal([]byte(raw), &dup); err != nil {
		t.Fatal(err)
	}
	var ae AgendaError
	if err := svc.SaveAgenda(ctx, f.campaignID, f.guardNPC, dup); !errors.As(err, &ae) || !strings.Contains(err.Error(), "entrada 2") {
		t.Fatalf("duplicate agenda = %v", err)
	}
	good := dup[:1]
	if err := svc.SaveAgenda(ctx, f.campaignID, f.guardNPC, good); err != nil {
		t.Fatal(err)
	}
	got, err := svc.Agenda(ctx, f.campaignID, f.guardNPC)
	if err != nil || len(got) != 1 || got[0].Ubicacion.EscenaID != f.sceneID || got[0].Ubicacion.Escena != "Muralla" {
		t.Fatalf("agenda read back = %+v, %v (scene name filled)", got, err)
	}
	if e, ok, err := svc.Resolve(ctx, f.campaignID, f.guardNPC, 5, "noche"); err != nil || !ok || e.Posicion.X != 70 {
		t.Fatalf("resolve night = %+v %v %v", e, ok, err)
	}
	if _, ok, _ := svc.Resolve(ctx, f.campaignID, f.guardNPC, 5, "dia"); ok {
		t.Fatal("no entry by day")
	}
	if err := svc.SaveAgenda(ctx, f.otherCampaign, f.guardNPC, good); !errors.Is(err, repository.ErrNPCNotFound) {
		t.Fatalf("another campaign's NPC = %v", err)
	}
}

func itoa(n int64) string { b, _ := json.Marshal(n); return string(b) }

// I3 + I4
func TestNPCSheetExportImportRealDB(t *testing.T) {
	f, svc, _ := agendaFixture(t)
	ctx := context.Background()
	market := repository.NewMarketRepository(f.db)
	if _, err := f.db.Exec(`UPDATE campaign_npcs SET role='Guardia', stats='{"combat":{"hp":22,"max_hp":22,"ac":16}}', purse_cp=40 WHERE id=$1`, f.guardNPC); err != nil {
		t.Fatal(err)
	}
	if err := market.SaveNPCItem(ctx, &domain.NPCItem{NPCID: f.guardNPC, Name: "Alabarda", Quantity: 1, Location: "inventory", Equipped: true}); err != nil {
		t.Fatal(err)
	}
	if err := market.SaveNPCItem(ctx, &domain.NPCItem{NPCID: f.guardNPC, Name: "Carta", Quantity: 1, Location: "home"}); err != nil {
		t.Fatal(err)
	}
	agenda := domain.Agenda{{Dia: domain.DaySpec{Name: "todos"}, Momento: "dia", Ubicacion: &domain.AgendaPlace{EscenaID: f.sceneID}, Posicion: &domain.Point{X: 35, Y: 35}}}
	if err := svc.SaveAgenda(ctx, f.campaignID, f.guardNPC, agenda); err != nil {
		t.Fatal(err)
	}

	docs, err := svc.Export(ctx, f.campaignID, []int64{f.guardNPC}, nil)
	if err != nil || len(docs) != 1 {
		t.Fatalf("export = %v, %v", docs, err)
	}
	d := docs[0]
	if d.Version != 1 || d.PJ.ID != f.guardNPC || d.PJ.Nombre != "Guardia Brom" || d.PJ.Rol != "Guardia" || d.PJ.Relacion != "neutral" {
		t.Fatalf("pj = %+v", d.PJ)
	}
	var combat domain.NPCCombat
	if err := json.Unmarshal(d.Combate, &combat); err != nil || combat.HP != 22 || combat.AC != 16 || combat.SpeedFt != 30 {
		t.Fatalf("combate = %s (defaults filled)", d.Combate)
	}
	if d.Inventario == nil || d.Inventario.MonedasCP != 40 || len(d.Inventario.Objetos) != 2 {
		t.Fatalf("inventario = %+v", d.Inventario)
	}
	where := map[string]string{}
	for _, it := range d.Inventario.Objetos {
		where[it.Nombre] = it.Donde
	}
	if where["Alabarda"] != "encima" || where["Carta"] != "casa" {
		t.Fatalf("donde = %v", where)
	}
	if d.Agenda == nil || (*d.Agenda)[0].Ubicacion.Escena != "Muralla" {
		t.Fatalf("agenda = %+v", d.Agenda)
	}
	only, err := svc.Export(ctx, f.campaignID, nil, []string{"agenda"})
	if err != nil || len(only) != 1 || only[0].Combate != nil || only[0].Inventario != nil || only[0].Agenda == nil {
		t.Fatalf("agenda-only export = %+v, %v", only, err)
	}

	// Import: replace inventory by name match, leave the agenda (absent), keep pj data without the flag.
	in := `[{"version":1,"pj":{"nombre":"Guardia Brom","rol":"Capitán"},
		"inventario":{"monedas_cp":7,"objetos":[{"nombre":"Espada","cantidad":1,"donde":"encima","equipado":true}]}}]`
	var docsIn []domain.NPCDocument
	if err := json.Unmarshal([]byte(in), &docsIn); err != nil {
		t.Fatal(err)
	}
	rep, err := svc.Import(ctx, f.campaignID, docsIn, ImportOptions{DryRun: true})
	if err != nil || len(rep.Applied) != 1 || rep.Applied[0].NPCID != f.guardNPC || strings.Join(rep.Applied[0].Sections, ",") != "inventario" {
		t.Fatalf("dry run = %+v, %v", rep, err)
	}
	if items, _ := market.NPCItems(ctx, f.guardNPC); len(items) != 2 {
		t.Fatal("dry run must not write")
	}
	if _, err := svc.Import(ctx, f.campaignID, docsIn, ImportOptions{}); err != nil {
		t.Fatal(err)
	}
	items, _ := market.NPCItems(ctx, f.guardNPC)
	if len(items) != 1 || items[0].Name != "Espada" || !items[0].Equipped {
		t.Fatalf("inventory not replaced: %+v", items)
	}
	var purse int64
	var role string
	if err := f.db.QueryRowx(`SELECT purse_cp, role FROM campaign_npcs WHERE id=$1`, f.guardNPC).Scan(&purse, &role); err != nil || purse != 7 || role != "Guardia" {
		t.Fatalf("purse %d role %q (role untouched without the flag)", purse, role)
	}
	if a, _ := svc.Agenda(ctx, f.campaignID, f.guardNPC); len(a) != 1 {
		t.Fatal("an absent agenda section must stay untouched")
	}
	if _, err := svc.Import(ctx, f.campaignID, docsIn, ImportOptions{UpdateData: true}); err != nil {
		t.Fatal(err)
	}
	if err := f.db.QueryRowx(`SELECT role FROM campaign_npcs WHERE id=$1`, f.guardNPC).Scan(&role); err != nil || role != "Capitán" {
		t.Fatalf("role with the flag = %q", role)
	}

	// All or nothing: the second document is broken, so the first is not written either.
	bad := `[{"pj":{"id":` + itoa(f.guardNPC) + `},"agenda":[]},
		{"pj":{"nombre":"Nadie"},"agenda":[]},
		{"pj":{"id":` + itoa(f.guardNPC) + `},"inventario":{"monedas_cp":-1,"objetos":[]}}]`
	var badDocs []domain.NPCDocument
	if err := json.Unmarshal([]byte(bad), &badDocs); err != nil {
		t.Fatal(err)
	}
	_, err = svc.Import(ctx, f.campaignID, badDocs, ImportOptions{})
	var ae AgendaError
	if !errors.As(err, &ae) || len(ae.Problems) != 2 || !strings.Contains(ae.Problems[0], "PNJ 2") || !strings.Contains(ae.Problems[0], "Nadie") ||
		!strings.Contains(ae.Problems[1], "PNJ 3") || !strings.Contains(ae.Problems[1], "monedas") {
		t.Fatalf("broken import = %v", err)
	}
	if a, _ := svc.Agenda(ctx, f.campaignID, f.guardNPC); len(a) != 1 {
		t.Fatal("a failed import must not clear the agenda")
	}
}
