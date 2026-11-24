package service

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

// T-23 · contratos/T-23-agenda-reglas.md

// A1: "dia" is a number or a selector, read leniently and written back as read.
func TestDaySpecJSON(t *testing.T) {
	cases := []struct {
		in, out string
		ok      bool
	}{
		{`3`, `3`, true},
		{`"todos"`, `"todos"`, true},
		{`"Laborables"`, `"laborables"`, true},
		{`"fin_de_semana"`, `"fin_de_semana"`, true},
		{`"miércoles"`, `"miercoles"`, true},
		{`"Sábado"`, `"sabado"`, true},
		{`"domingo"`, `"domingo"`, true},
		{`0`, ``, false},
		{`-2`, ``, false},
		{`2.5`, ``, false},
		{`"festivo"`, ``, false},
		{`true`, ``, false},
	}
	for _, c := range cases {
		var d domain.DaySpec
		err := json.Unmarshal([]byte(c.in), &d)
		if !c.ok {
			if err == nil {
				t.Errorf("%s: want error, got %+v", c.in, d)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: %v", c.in, err)
			continue
		}
		b, _ := json.Marshal(d)
		if string(b) != c.out {
			t.Errorf("%s: marshals to %s, want %s", c.in, b, c.out)
		}
	}
}

func TestAgendaEntryJSONRoundTrip(t *testing.T) {
	raw := `[{"dia":"todos","momento":"noche","ubicacion":{"escena_id":7,"escena":"Cuartel"},"posicion":{"x":70,"y":70},"path":null,"oculto":true},
	{"dia":3,"momento":"tarde","ubicacion":null}]`
	var a domain.Agenda
	if err := json.Unmarshal([]byte(raw), &a); err != nil {
		t.Fatal(err)
	}
	if len(a) != 2 || a[0].Ubicacion == nil || a[0].Ubicacion.EscenaID != 7 || !a[0].Oculto || a[0].Posicion == nil || a[0].Path != nil {
		t.Fatalf("first entry = %+v", a[0])
	}
	if a[1].Ubicacion != nil || a[1].Dia.Day != 3 {
		t.Fatalf("second entry = %+v", a[1])
	}
	v, err := a.Value()
	if err != nil || !strings.Contains(v.(string), `"ubicacion":null`) {
		t.Fatalf("Value = %v, %v (away must stay explicit null)", v, err)
	}
	var back domain.Agenda
	if err := back.Scan([]byte(v.(string))); err != nil || len(back) != 2 {
		t.Fatalf("Scan = %v, %v", back, err)
	}
	var empty domain.Agenda
	if v, _ := empty.Value(); v != "[]" {
		t.Fatalf("empty agenda stores %v, want []", v)
	}
}

// A2: day 1 falls on first_weekday.
func TestWeekday(t *testing.T) {
	if got := Weekday(1, 0); got != 0 {
		t.Fatalf("day 1 starting monday = %d", got)
	}
	if got := Weekday(3, 0); got != 2 {
		t.Fatalf("day 3 starting monday = %d, want 2 (miércoles)", got)
	}
	if got := Weekday(8, 0); got != 0 {
		t.Fatalf("day 8 = %d, want lunes again", got)
	}
	if got := Weekday(1, 5); got != 5 {
		t.Fatalf("day 1 starting saturday = %d", got)
	}
	if got := Weekday(3, 5); got != 0 {
		t.Fatalf("day 3 starting saturday = %d, want lunes", got)
	}
	if WeekdayName(2) != "miercoles" || WeekdayName(6) != "domingo" {
		t.Fatal("weekday names are lunes..domingo without accents")
	}
	if FirstWeekday("sabado") != 5 || FirstWeekday("") != 0 || FirstWeekday("nada") != 0 {
		t.Fatal("first weekday parses names and defaults to lunes")
	}
}

// A3
func TestStepClock(t *testing.T) {
	cases := []struct {
		day       int
		tod       string
		step      int
		wantDay   int
		wantTimes string
	}{
		{1, "dia", 1, 1, "tarde"},
		{1, "tarde", 1, 1, "noche"},
		{1, "noche", 1, 2, "dia"},
		{2, "dia", -1, 1, "noche"},
		{2, "tarde", -1, 2, "dia"},
		{1, "dia", -1, 1, "dia"},
		{4, "noche", 3, 5, "noche"},
		{5, "noche", -3, 4, "noche"},
	}
	for _, c := range cases {
		d, tod := StepClock(c.day, c.tod, c.step)
		if d != c.wantDay || tod != c.wantTimes {
			t.Errorf("StepClock(%d,%s,%d) = %d,%s want %d,%s", c.day, c.tod, c.step, d, tod, c.wantDay, c.wantTimes)
		}
	}
	if !ValidTimeOfDay("tarde") || ValidTimeOfDay("mañana") {
		t.Fatal("time of day is dia, tarde or noche")
	}
}

func entry(dia string, momento string, scene int64) domain.AgendaEntry {
	var d domain.DaySpec
	if err := json.Unmarshal([]byte(dia), &d); err != nil {
		panic(err)
	}
	e := domain.AgendaEntry{Dia: d, Momento: momento}
	if scene > 0 {
		e.Ubicacion = &domain.AgendaPlace{EscenaID: scene}
		e.Posicion = &domain.Point{X: 10, Y: 10}
	}
	return e
}

// A4: the spec example (day 1 = lunes).
func TestResolveAgenda(t *testing.T) {
	agenda := domain.Agenda{
		entry(`"todos"`, "tarde", 1),         // 0
		entry(`"laborables"`, "tarde", 2),    // 1
		entry(`3`, "tarde", 3),               // 2
		entry(`"fin_de_semana"`, "dia", 4),   // 3
		entry(`"domingo"`, "dia", 5),         // 4
		entry(`"todos"`, "dia", 6),           // 5
		entry(`"domingo"`, "noche", 0),       // 6 away
	}
	cases := []struct {
		day  int
		tod  string
		want int // index, -1 none
	}{
		{3, "tarde", 2},  // exact day
		{2, "tarde", 1},  // martes: laborable
		{6, "tarde", 0},  // sábado: not laborable → todos
		{6, "dia", 3},    // sábado: fin de semana
		{7, "dia", 4},    // domingo: weekday name beats fin de semana
		{1, "dia", 5},    // lunes: todos
		{7, "noche", 6},  // away entry
		{2, "noche", -1}, // nothing for the night
	}
	for _, c := range cases {
		e, ok := ResolveAgenda(agenda, c.day, c.tod, 0)
		switch {
		case c.want < 0 && ok:
			t.Errorf("day %d %s: want none, got %+v", c.day, c.tod, e)
		case c.want >= 0 && (!ok || e != &agenda[c.want]):
			t.Errorf("day %d %s: want entry %d, got %+v (ok=%v)", c.day, c.tod, c.want, e, ok)
		}
	}
}

// A5: every problem is reported with its index.
func TestValidateAgenda(t *testing.T) {
	scenes := map[int64]*domain.VTTScene{1: {ID: 1, Name: "Muralla", WidthPx: 800, HeightPx: 600, Walls: domain.Walls{{X1: 400, Y1: 0, X2: 400, Y2: 600}}}}
	ok := domain.Agenda{
		entry(`"todos"`, "dia", 1),
		entry(`3`, "dia", 1),
		entry(`"todos"`, "noche", 0),
		{Dia: domain.DaySpec{Name: "laborables"}, Momento: "tarde", Ubicacion: &domain.AgendaPlace{EscenaID: 1},
			Path: &domain.Route{Mode: "loop", Points: []domain.RoutePoint{{X: 10, Y: 10}, {X: 300, Y: 10}, {X: 300, Y: 300}}}},
	}
	if err := ValidateAgenda(ok, scenes); err != nil {
		t.Fatalf("valid agenda rejected: %v", err)
	}

	noPos := entry(`"todos"`, "tarde", 1)
	noPos.Posicion = nil
	outside := entry(`"lunes"`, "tarde", 1)
	outside.Posicion = &domain.Point{X: 900, Y: 10}
	badPath := entry(`2`, "noche", 1)
	badPath.Path = &domain.Route{Mode: "once", Points: []domain.RoutePoint{{X: 10, Y: 10}, {X: 700, Y: 10}}}
	longNote := entry(`5`, "dia", 1)
	longNote.Nota = strings.Repeat("x", 501)
	bad := domain.Agenda{
		entry(`"todos"`, "dia", 1),  // 1
		entry(`"todos"`, "dia", 1),  // 2 duplicate of 1
		entry(`4`, "mañana", 1),     // 3 bad momento
		entry(`4`, "noche", 99),     // 4 foreign scene
		noPos,                       // 5
		outside,                     // 6
		badPath,                     // 7
		longNote,                    // 8
		{Momento: "dia"},            // 9 missing dia
	}
	err := ValidateAgenda(bad, scenes)
	var ae AgendaError
	if err == nil || !errors.As(err, &ae) {
		t.Fatalf("want AgendaError, got %v", err)
	}
	want := []string{
		"entrada 2: repite el día y momento de la entrada 1",
		"entrada 3: momento",
		"entrada 4: la escena 99",
		"entrada 5: falta la posición",
		"entrada 6: la posición está fuera de la escena",
		"entrada 7: segment 1 crosses a wall",
		"entrada 8: la nota",
		"entrada 9: día",
	}
	if len(ae.Problems) != len(want) {
		t.Fatalf("problems = %q", ae.Problems)
	}
	for i, w := range want {
		if !strings.Contains(ae.Problems[i], w) {
			t.Errorf("problem %d = %q, want it to contain %q", i, ae.Problems[i], w)
		}
	}
	if !strings.Contains(err.Error(), "entrada 2") {
		t.Fatalf("Error() should list the problems: %s", err)
	}

	many := make(domain.Agenda, 201)
	for i := range many {
		many[i] = entry(`"todos"`, "dia", 0)
		many[i].Dia = domain.DaySpec{Day: i + 1}
	}
	if err := ValidateAgenda(many, scenes); err == nil || !strings.Contains(err.Error(), "200") {
		t.Fatalf("more than 200 entries must fail, got %v", err)
	}
}
