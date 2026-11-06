package service

import (
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func TestMovementBlocked(t *testing.T) {
	wall := domain.Wall{X1: 100, Y1: 0, X2: 100, Y2: 200}
	cases := []struct {
		name  string
		walls []domain.Wall
		x2    float64
		want  bool
	}{
		{"crosses closed wall", []domain.Wall{wall}, 150, true},
		{"stops before wall", []domain.Wall{wall}, 90, false},
		{"closed door blocks", []domain.Wall{{X1: 100, Y1: 0, X2: 100, Y2: 200, Door: true}}, 150, true},
		{"open door lets through", []domain.Wall{{X1: 100, Y1: 0, X2: 100, Y2: 200, Door: true, Open: true}}, 150, false},
		{"no walls", nil, 150, false},
	}
	for _, c := range cases {
		if got := MovementBlocked(c.walls, 50, 100, c.x2, 100); got != c.want {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
	}
	// Path parallel to the wall must not be blocked.
	if MovementBlocked([]domain.Wall{wall}, 50, 10, 50, 190) {
		t.Error("parallel path reported as blocked")
	}
}

func TestDarkvisionForRace(t *testing.T) {
	cases := map[string]int{
		"Alto elfo": 60, "Enana de las montañas": 60, "Semiorco": 60, "Tiefling": 60, "Gnomo de las rocas": 60,
		"Drow": 120, "Humano": 0, "Mediano piesligeros": 0, "Dracónido": 0, "Half-Elf": 60, "": 0,
	}
	for race, want := range cases {
		if got := DarkvisionForRace(race); got != want {
			t.Errorf("%q: got %d want %d", race, got, want)
		}
	}
}

func TestParseSenses(t *testing.T) {
	dv, bs := ParseSenses("blindsight 60 ft., darkvision 120 ft., passive Perception 23")
	if dv != 120 || bs != 60 {
		t.Fatalf("got dv=%d bs=%d", dv, bs)
	}
	dv, bs = ParseSenses("passive Perception 10")
	if dv != 0 || bs != 0 {
		t.Fatalf("expected zero senses, got dv=%d bs=%d", dv, bs)
	}
}

func TestSnapToGrid(t *testing.T) {
	x, y := SnapToGrid(80, 130, 70, 0, 0, 1)
	if x != 105 || y != 105 {
		t.Errorf("1-cell token: got (%v,%v) want (105,105)", x, y)
	}
	x, y = SnapToGrid(150, 150, 70, 0, 0, 2)
	if x != 140 || y != 140 {
		t.Errorf("2-cell token: got (%v,%v) want (140,140)", x, y)
	}
	x, y = SnapToGrid(-20, 10, 70, 0, 0, 1)
	if x != -35 || y != 35 {
		t.Errorf("negative coords: got (%v,%v) want (-35,35)", x, y)
	}
}

func TestSlideMove(t *testing.T) {
	walls := []domain.Wall{{X1: 100, Y1: 0, X2: 100, Y2: 200}}
	if x, y := SlideMove(walls, 50, 50, 80, 60); x != 80 || y != 60 {
		t.Fatalf("free move altered: %v,%v", x, y)
	}
	if x, y := SlideMove(walls, 90, 50, 120, 20); x != 90 || y != 20 {
		t.Fatalf("expected slide along the wall, got %v,%v", x, y)
	}
	if x, y := SlideMove(walls, 90, 50, 120, 50); x != 90 || y != 50 {
		t.Fatalf("expected to stay put, got %v,%v", x, y)
	}
}
