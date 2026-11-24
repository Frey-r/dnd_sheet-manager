package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"strings"
)

// DaySelectors are the non-numeric values of an agenda "dia" (openspec/specs/npc-agenda.md §2).
var DaySelectors = []string{"todos", "laborables", "fin_de_semana", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"}

// DaySpec is an agenda "dia": a game day number (Day ≥ 1) or a selector name (Name).
type DaySpec struct {
	Day  int
	Name string
}

// IsZero reports a missing day.
func (d DaySpec) IsZero() bool { return d.Day == 0 && d.Name == "" }

// Key identifies the day for duplicate detection.
func (d DaySpec) Key() string {
	if d.Name != "" {
		return d.Name
	}
	b, _ := json.Marshal(d.Day)
	return string(b)
}

var accents = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u")

func (d *DaySpec) UnmarshalJSON(b []byte) error {
	var n json.Number
	dec := json.NewDecoder(strings.NewReader(string(b)))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return err
	}
	switch x := v.(type) {
	case json.Number:
		n = x
		i, err := n.Int64()
		if err != nil || i < 1 {
			return errors.New("dia must be a whole number ≥ 1")
		}
		*d = DaySpec{Day: int(i)}
		return nil
	case string:
		name := accents.Replace(strings.ToLower(strings.TrimSpace(x)))
		for _, s := range DaySelectors {
			if s == name {
				*d = DaySpec{Name: name}
				return nil
			}
		}
		return errors.New("dia must be a number, todos, laborables, fin_de_semana or a weekday")
	}
	return errors.New("dia must be a number or a text")
}

func (d DaySpec) MarshalJSON() ([]byte, error) {
	if d.Name != "" {
		return json.Marshal(d.Name)
	}
	return json.Marshal(d.Day)
}

// AgendaPlace is the scene of an agenda entry; Escena (its name) is informative.
type AgendaPlace struct {
	EscenaID int64  `json:"escena_id"`
	Escena   string `json:"escena,omitempty"`
}

// AgendaEntry: where an NPC is, standing or walking, on a day and time of day. Ubicacion nil = away.
type AgendaEntry struct {
	Dia       DaySpec      `json:"dia"`
	Momento   string       `json:"momento"`
	Ubicacion *AgendaPlace `json:"ubicacion"`
	Posicion  *Point       `json:"posicion,omitempty"`
	Path      *Route       `json:"path"`
	Oculto    bool         `json:"oculto,omitempty"`
	Nota      string       `json:"nota,omitempty"`
}

// Agenda is the JSONB list of entries of a campaign NPC.
type Agenda []AgendaEntry

func (a Agenda) Value() (driver.Value, error) {
	if len(a) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(a)
	return string(b), err
}

func (a *Agenda) Scan(src any) error { return jsonScan(src, a) }

// NPCCombat is the combat sheet of a campaign NPC (stats.combat, npc-agenda.md §5).
type NPCCombat struct {
	HP                int     `json:"hp"`
	MaxHP             int     `json:"max_hp"`
	AC                int     `json:"ac"`
	SpeedFt           int     `json:"speed_ft"`
	PassivePerception int     `json:"passive_perception"`
	DarkvisionFt      int     `json:"darkvision_ft"`
	BlindsightFt      int     `json:"blindsight_ft"`
	DexMod            int     `json:"dex_mod"`
	StealthBonus      int     `json:"stealth_bonus"`
	Detects           bool    `json:"detects"`
	SizeCells         float64 `json:"size_cells"`
}

// GameClock is the campaign's in-game time (npc-agenda.md §1).
type GameClock struct {
	GameDay      int    `json:"game_day"`
	TimeOfDay    string `json:"time_of_day"`
	FirstWeekday string `json:"first_weekday"`
	Weekday      string `json:"weekday"`
}

// NPCDocument is the full NPC sheet exchanged as JSON (npc-agenda.md §5): absent sections are untouched on import.
type NPCDocument struct {
	Version    int              `json:"version"`
	PJ         NPCDocPJ         `json:"pj"`
	Combate    json.RawMessage  `json:"combate,omitempty"`
	Inventario *NPCDocInventory `json:"inventario,omitempty"`
	Agenda     *Agenda          `json:"agenda,omitempty"`
}

// NPCDocPJ identifies the NPC (id, else exact name) and carries its basic data.
type NPCDocPJ struct {
	ID       int64  `json:"id,omitempty"`
	Nombre   string `json:"nombre"`
	Rol      string `json:"rol,omitempty"`
	Relacion string `json:"relacion,omitempty"`
	Raza     string `json:"raza,omitempty"`
	Clase    string `json:"clase,omitempty"`
}

// NPCDocInventory is the purse and the items of the sheet document.
type NPCDocInventory struct {
	MonedasCP int64        `json:"monedas_cp"`
	Objetos   []NPCDocItem `json:"objetos"`
}

// NPCDocItem: Donde is "encima" (carried) or "casa" (at home).
type NPCDocItem struct {
	Nombre      string `json:"nombre"`
	Cantidad    int    `json:"cantidad"`
	ValorCP     *int64 `json:"valor_cp,omitempty"`
	Donde       string `json:"donde"`
	Equipado    bool   `json:"equipado,omitempty"`
	Descripcion string `json:"descripcion,omitempty"`
	Origen      string `json:"origen,omitempty"`
}
