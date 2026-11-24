package service

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"dnd-campaign-manager/internal/domain"
)

// Agenda limits (openspec/specs/npc-agenda.md §2).
const (
	agendaMaxEntries = 200
	agendaMaxNote    = 500
)

var timesOfDay = []string{"dia", "tarde", "noche"}
var weekdayNames = []string{"lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"}

// AgendaError lists every problem of an agenda with its 1-based entry index; safe to show to the GM.
type AgendaError struct{ Problems []string }

func (e AgendaError) Error() string { return strings.Join(e.Problems, "; ") }

// ValidTimeOfDay: dia, tarde or noche.
func ValidTimeOfDay(v string) bool {
	for _, t := range timesOfDay {
		if t == v {
			return true
		}
	}
	return false
}

// Weekday is the weekday index (0 = lunes) of game day `day` when day 1 falls on `first`.
func Weekday(day, first int) int { return ((first+day-1)%7 + 7) % 7 }

// WeekdayName: lunes … domingo, without accents.
func WeekdayName(i int) string { return weekdayNames[((i%7)+7)%7] }

// FirstWeekday parses the campaign setting; unknown or empty means lunes.
func FirstWeekday(name string) int {
	for i, n := range weekdayNames {
		if n == name {
			return i
		}
	}
	return 0
}

// StepClock moves the clock `step` times of day forward (or back); it never goes before day 1 morning.
func StepClock(day int, tod string, step int) (int, string) {
	idx := 0
	for i, t := range timesOfDay {
		if t == tod {
			idx = i
		}
	}
	slot := max(0, (day-1)*3+idx+step)
	return slot/3 + 1, timesOfDay[slot%3]
}

// dayRank is how specific a day selector is for (day, weekday): lower wins, -1 = does not match.
func dayRank(d domain.DaySpec, day, weekday int) int {
	switch {
	case d.Day > 0:
		if d.Day == day {
			return 0
		}
	case d.Name == "todos":
		return 3
	case d.Name == "laborables":
		if weekday <= 4 {
			return 2
		}
	case d.Name == "fin_de_semana":
		if weekday >= 5 {
			return 2
		}
	case d.Name == WeekdayName(weekday):
		return 1
	}
	return -1
}

// ResolveAgenda returns the entry that applies on (day, time of day): exact day > weekday >
// laborables/fin de semana > todos. No match means the NPC stays where it is.
func ResolveAgenda(a domain.Agenda, day int, tod string, first int) (*domain.AgendaEntry, bool) {
	weekday := Weekday(day, first)
	best, bestRank := -1, 99
	for i := range a {
		if a[i].Momento != tod {
			continue
		}
		if r := dayRank(a[i].Dia, day, weekday); r >= 0 && r < bestRank {
			best, bestRank = i, r
		}
	}
	if best < 0 {
		return nil, false
	}
	return &a[best], true
}

// ValidateAgenda checks an agenda against the campaign scenes and reports every problem.
func ValidateAgenda(a domain.Agenda, scenes map[int64]*domain.VTTScene) error {
	if len(a) > agendaMaxEntries {
		return AgendaError{[]string{fmt.Sprintf("la agenda admite como mucho %d entradas (tiene %d)", agendaMaxEntries, len(a))}}
	}
	var problems []string
	seen := map[string]int{}
	for i, e := range a {
		n := i + 1
		bad := func(format string, args ...any) {
			problems = append(problems, fmt.Sprintf("entrada %d: ", n)+fmt.Sprintf(format, args...))
		}
		if e.Dia.IsZero() {
			bad("día obligatorio (número, todos, laborables, fin_de_semana o un día de la semana)")
		}
		if !ValidTimeOfDay(e.Momento) {
			bad("momento %q no válido (dia, tarde o noche)", e.Momento)
		}
		if !e.Dia.IsZero() && ValidTimeOfDay(e.Momento) {
			key := e.Dia.Key() + "|" + e.Momento
			if first, dup := seen[key]; dup {
				bad("repite el día y momento de la entrada %d", first)
			} else {
				seen[key] = n
			}
		}
		if utf8.RuneCountInString(e.Nota) > agendaMaxNote {
			bad("la nota supera %d caracteres", agendaMaxNote)
		}
		if e.Ubicacion == nil {
			continue // away: no scene, position or path
		}
		scene, ok := scenes[e.Ubicacion.EscenaID]
		if !ok {
			bad("la escena %d no es de esta campaña", e.Ubicacion.EscenaID)
			continue
		}
		if e.Path != nil {
			if err := ValidateRoute(scene, *e.Path); err != nil {
				bad("%v", err)
			}
			continue
		}
		switch p := e.Posicion; {
		case p == nil:
			bad("falta la posición (o una ruta) en %s", scene.Name)
		case p.X < 0 || p.Y < 0 || p.X > float64(scene.WidthPx) || p.Y > float64(scene.HeightPx):
			bad("la posición está fuera de la escena %s", scene.Name)
		}
	}
	if len(problems) > 0 {
		return AgendaError{problems}
	}
	return nil
}
