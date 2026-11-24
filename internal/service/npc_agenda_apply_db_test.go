package service

import (
	"context"
	"testing"
	"time"

	"dnd-campaign-manager/internal/domain"
)

// T-26 · contratos/T-26-agenda-aplicar.md — against a real, migrated Postgres.

type applyFixture struct {
	*routeFixture
	svc        *NPCAgenda
	barracks   int64 // second scene
	patrol     *domain.Route
	sheetedNPC int64
}

func newApplyFixture(t *testing.T) *applyFixture {
	f, svc, _ := agendaFixture(t)
	a := &applyFixture{routeFixture: f, svc: svc}
	if err := f.db.QueryRowx(`INSERT INTO vtt_scenes(campaign_id,name,width_px,height_px) VALUES($1,'Cuartel',700,700) RETURNING id`, f.campaignID).Scan(&a.barracks); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(`UPDATE campaign_npcs SET stats='{"combat":{"hp":22,"max_hp":22,"ac":16,"speed_ft":30}}' WHERE id=$1`, f.guardNPC); err != nil {
		t.Fatal(err)
	}
	a.patrol = &domain.Route{Mode: "loop", Points: []domain.RoutePoint{{X: 105, Y: 105}, {X: 455, Y: 105}, {X: 455, Y: 455}}}
	agenda := domain.Agenda{
		{Dia: domain.DaySpec{Name: "todos"}, Momento: "dia", Ubicacion: &domain.AgendaPlace{EscenaID: f.sceneID}, Path: a.patrol},
		{Dia: domain.DaySpec{Name: "todos"}, Momento: "noche", Ubicacion: &domain.AgendaPlace{EscenaID: a.barracks}, Posicion: &domain.Point{X: 70, Y: 70}, Oculto: true},
		{Dia: domain.DaySpec{Name: "domingo"}, Momento: "tarde", Ubicacion: nil},
	}
	if err := svc.SaveAgenda(context.Background(), f.campaignID, f.guardNPC, agenda); err != nil {
		t.Fatal(err)
	}
	return a
}

func (a *applyFixture) npcTokens(t *testing.T) []domain.VTTToken {
	t.Helper()
	toks, err := a.repo.NPCTokens(context.Background(), a.campaignID)
	if err != nil {
		t.Fatal(err)
	}
	return toks
}

// G1, G3, G6
func TestApplyAgendaCreatesMovesAndIsIdempotentRealDB(t *testing.T) {
	a := newApplyFixture(t)
	ctx := context.Background()
	// A loose monster and an NPC without agenda are never touched.
	var loose, other, otherTok int64
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(a.db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,x,y) VALUES($1,$2,'Lobo','monster',10,10) RETURNING id`, a.sceneID, a.campaignID).Scan(&loose))
	must(a.db.QueryRowx(`INSERT INTO campaign_npcs(campaign_id,name) VALUES($1,'Mira') RETURNING id`, a.campaignID).Scan(&other))
	must(a.db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,npc_id,x,y) VALUES($1,$2,'Mira','npc',$3,20,20) RETURNING id`, a.barracks, a.campaignID, other).Scan(&otherTok))

	sum, err := a.svc.ApplyAgendas(ctx, a.campaignID) // day 1 · dia
	must(err)
	if len(sum.Created) != 1 || sum.Created[0] != "Guardia Brom" {
		t.Fatalf("summary = %+v, want Brom created", sum)
	}
	var brom domain.VTTToken
	for _, tk := range a.npcTokens(t) {
		if tk.NpcID != nil && *tk.NpcID == a.guardNPC {
			brom = tk
		}
	}
	if brom.SceneID != a.sceneID || brom.Route == nil || brom.RouteStartedAt == nil || brom.X != 105 || brom.HP != 22 || brom.AC != 16 || brom.Kind != "npc" {
		t.Fatalf("created token = %+v", brom)
	}

	// G3: applying again changes nothing and keeps the route clock.
	time.Sleep(20 * time.Millisecond)
	sum, err = a.svc.ApplyAgendas(ctx, a.campaignID)
	must(err)
	again := a.token(t, brom.ID)
	if sum.Unchanged != 1 || len(sum.Created)+len(sum.Moved)+len(sum.Removed) != 0 || !again.RouteStartedAt.Equal(*brom.RouteStartedAt) {
		t.Fatalf("re-apply = %+v; started %v → %v", sum, brom.RouteStartedAt, again.RouteStartedAt)
	}

	// An extra token of Brom in the barracks; at night he goes there: one token left, the moved one.
	var extra int64
	must(a.db.QueryRowx(`INSERT INTO vtt_tokens(scene_id,campaign_id,name,kind,npc_id,x,y) VALUES($1,$2,'Brom bis','npc',$3,300,300) RETURNING id`, a.barracks, a.campaignID, a.guardNPC).Scan(&extra))
	clock, sum, err := a.svc.ChangeClock(ctx, a.campaignID, ClockChange{GameDay: 1, TimeOfDay: "noche"})
	must(err)
	if clock.TimeOfDay != "noche" || len(sum.Moved) != 1 {
		t.Fatalf("night: clock %+v summary %+v", clock, sum)
	}
	var mine []domain.VTTToken
	for _, tk := range a.npcTokens(t) {
		if tk.NpcID != nil && *tk.NpcID == a.guardNPC {
			mine = append(mine, tk)
		}
	}
	if len(mine) != 1 {
		t.Fatalf("Brom must have exactly one token, has %d", len(mine))
	}
	n := mine[0]
	if n.SceneID != a.barracks || !n.Hidden || n.Route != nil || n.X != 70 || n.Y != 70 {
		t.Fatalf("night token = %+v", n)
	}
	if _, err := a.repo.TokenByID(ctx, loose); err != nil {
		t.Fatal("a loose token must never be touched")
	}
	if tk, err := a.repo.TokenByID(ctx, otherTok); err != nil || tk.SceneID != a.barracks {
		t.Fatal("an NPC without agenda must never be touched")
	}
}

// G2: away removes; no entry leaves it.
func TestApplyAgendaAwayAndNoEntryRealDB(t *testing.T) {
	a := newApplyFixture(t)
	ctx := context.Background()
	if _, err := a.svc.ApplyAgendas(ctx, a.campaignID); err != nil {
		t.Fatal(err)
	}
	// Day 2 · tarde (martes): no entry → stays.
	if _, sum, err := a.svc.ChangeClock(ctx, a.campaignID, ClockChange{GameDay: 2, TimeOfDay: "tarde"}); err != nil || len(sum.Moved)+len(sum.Removed)+len(sum.Created) != 0 {
		t.Fatalf("no entry: %+v %v", sum, err)
	}
	if len(a.npcTokens(t)) != 1 {
		t.Fatal("without an entry the NPC stays where it is")
	}
	// Day 7 · tarde (domingo): away.
	_, sum, err := a.svc.ChangeClock(ctx, a.campaignID, ClockChange{GameDay: 7, TimeOfDay: "tarde"})
	if err != nil || len(sum.Removed) != 1 {
		t.Fatalf("away: %+v %v", sum, err)
	}
	if len(a.npcTokens(t)) != 0 {
		t.Fatal("an away NPC leaves every map")
	}
}

// G4: in combat it is skipped, and the combat end applies the current entry.
func TestApplyAgendaSkipsCombatRealDB(t *testing.T) {
	a := newApplyFixture(t)
	ctx := context.Background()
	if _, err := a.svc.ApplyAgendas(ctx, a.campaignID); err != nil {
		t.Fatal(err)
	}
	brom := a.npcTokens(t)[0]
	combat, err := a.play.StartEncounter(ctx, a.scene(t), brom.X, brom.Y, []int64{brom.ID}, []int64{a.pc})
	if err != nil {
		t.Fatal(err)
	}
	_, sum, err := a.svc.ChangeClock(ctx, a.campaignID, ClockChange{GameDay: 1, TimeOfDay: "noche"})
	if err != nil || len(sum.Skipped) != 1 || sum.Skipped[0].Nombre != "Guardia Brom" || sum.Skipped[0].Motivo == "" {
		t.Fatalf("combat skip: %+v %v", sum, err)
	}
	if tk := a.token(t, brom.ID); tk.SceneID != a.sceneID {
		t.Fatal("an NPC in combat must not move")
	}
	if err := a.play.EndCombat(ctx, combat); err != nil {
		t.Fatal(err)
	}
	if tk := a.token(t, brom.ID); tk.SceneID != a.barracks || !tk.Hidden {
		t.Fatalf("after the combat Brom must go to his night place: %+v", tk)
	}
}

// G5
func TestApplyAgendaBrokenSceneRealDB(t *testing.T) {
	a := newApplyFixture(t)
	ctx := context.Background()
	if _, err := a.db.Exec(`DELETE FROM vtt_scenes WHERE id=$1`, a.barracks); err != nil {
		t.Fatal(err)
	}
	_, sum, err := a.svc.ChangeClock(ctx, a.campaignID, ClockChange{GameDay: 1, TimeOfDay: "noche"})
	if err != nil || len(sum.Skipped) != 1 || sum.Skipped[0].Motivo != "escena borrada" {
		t.Fatalf("broken scene: %+v %v", sum, err)
	}
}

// G7
func TestWhereaboutsRealDB(t *testing.T) {
	a := newApplyFixture(t)
	ctx := context.Background()
	var other int64
	if err := a.db.QueryRowx(`INSERT INTO campaign_npcs(campaign_id,name) VALUES($1,'Mira') RETURNING id`, a.campaignID).Scan(&other); err != nil {
		t.Fatal(err)
	}
	if _, err := a.svc.ApplyAgendas(ctx, a.campaignID); err != nil {
		t.Fatal(err)
	}
	list, err := a.svc.Whereabouts(ctx, a.campaignID)
	if err != nil || len(list) != 2 {
		t.Fatalf("whereabouts = %+v, %v", list, err)
	}
	byName := map[string]Whereabout{}
	for _, w := range list {
		byName[w.Nombre] = w
	}
	brom := byName["Guardia Brom"]
	if brom.Estado != "en_ruta" || brom.EscenaID == nil || *brom.EscenaID != a.sceneID || brom.Escena != "Muralla" || brom.Relacion != "neutral" {
		t.Fatalf("Brom = %+v", brom)
	}
	if brom.Siguiente == nil || brom.Siguiente.Momento != "tarde" {
		// day 1 · dia → next is day 1 · tarde: no entry for tarde on a lunes
		if brom.Siguiente != nil {
			t.Fatalf("next for Brom = %+v", brom.Siguiente)
		}
	}
	if byName["Mira"].Estado != "sin_agenda" {
		t.Fatalf("Mira = %+v", byName["Mira"])
	}
	if _, _, err := a.svc.ChangeClock(ctx, a.campaignID, ClockChange{GameDay: 7, TimeOfDay: "dia"}); err != nil {
		t.Fatal(err)
	}
	list, _ = a.svc.Whereabouts(ctx, a.campaignID)
	for _, w := range list {
		if w.Nombre == "Guardia Brom" && (w.Siguiente == nil || w.Siguiente.Ubicacion != nil) {
			t.Fatalf("on domingo · dia the next slot (tarde) is away: %+v", w.Siguiente)
		}
	}
	if _, _, err := a.svc.ChangeClock(ctx, a.campaignID, ClockChange{GameDay: 7, TimeOfDay: "tarde"}); err != nil {
		t.Fatal(err)
	}
	list, _ = a.svc.Whereabouts(ctx, a.campaignID)
	for _, w := range list {
		if w.Nombre == "Guardia Brom" && w.Estado != "ausente" {
			t.Fatalf("away Brom = %+v", w)
		}
	}
}
