package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// ErrInvalidClock: a clock change with an unknown day, time of day or weekday (npc-agenda.md §1).
var ErrInvalidClock = errors.New("reloj no válido: día ≥ 1, momento dia/tarde/noche y semana de lunes a domingo")

const npcInventoryMaxItems = 500

// NPCAgenda runs the game clock and the NPC sheets: agenda, import and export (openspec/specs/npc-agenda.md).
type NPCAgenda struct {
	repo *repository.NPCRepository
	vtt  *repository.VTTRepository
	play *VTTPlay
	rt   Realtime
}

func NewNPCAgenda(repo *repository.NPCRepository, vtt *repository.VTTRepository, play *VTTPlay, rt Realtime) *NPCAgenda {
	s := &NPCAgenda{repo: repo, vtt: vtt, play: play, rt: rt}
	if play != nil {
		play.SetAfterCombat(func(ctx context.Context, campaignID int64) {
			if _, err := s.ApplyAgendas(ctx, campaignID); err != nil {
				log.Printf("npc agenda: after combat: %v", err)
			}
		})
	}
	return s
}

// ---------- Clock ----------

func clockOf(day int, tod, first string) domain.GameClock {
	if first == "" {
		first = "lunes"
	}
	return domain.GameClock{GameDay: day, TimeOfDay: tod, FirstWeekday: first, Weekday: WeekdayName(Weekday(day, FirstWeekday(first)))}
}

// Clock returns the campaign's game clock.
func (s *NPCAgenda) Clock(ctx context.Context, campaignID int64) (domain.GameClock, error) {
	day, tod, first, err := s.repo.Clock(ctx, campaignID)
	if err != nil {
		return domain.GameClock{}, err
	}
	return clockOf(day, tod, first), nil
}

// ClockChange is either a Step (± times of day) or an absolute GameDay + TimeOfDay; FirstWeekday is optional.
type ClockChange struct {
	GameDay      int     `json:"game_day"`
	TimeOfDay    string  `json:"time_of_day"`
	Step         int     `json:"step"`
	FirstWeekday *string `json:"first_weekday"`
}

// SetClock validates and stores a clock change and announces it.
func (s *NPCAgenda) SetClock(ctx context.Context, campaignID int64, in ClockChange) (domain.GameClock, error) {
	day, tod, first, err := s.repo.Clock(ctx, campaignID)
	if err != nil {
		return domain.GameClock{}, err
	}
	absolute := in.GameDay != 0 || in.TimeOfDay != ""
	switch {
	case in.Step != 0 && absolute:
		return domain.GameClock{}, ErrInvalidClock
	case in.Step != 0:
		day, tod = StepClock(day, tod, in.Step)
	case absolute:
		if in.GameDay < 1 || !ValidTimeOfDay(in.TimeOfDay) {
			return domain.GameClock{}, ErrInvalidClock
		}
		day, tod = in.GameDay, in.TimeOfDay
	}
	if in.FirstWeekday != nil {
		name := accentsFold(*in.FirstWeekday)
		if FirstWeekday(name) == 0 && name != "lunes" {
			return domain.GameClock{}, ErrInvalidClock
		}
		in.FirstWeekday, first = &name, name
	}
	if err := s.repo.SetClock(ctx, campaignID, day, tod, in.FirstWeekday); err != nil {
		return domain.GameClock{}, err
	}
	clock := clockOf(day, tod, first)
	if s.rt != nil {
		if err := s.rt.Publish(ctx, campaignID, 0, "campaign.clock.updated", clock); err != nil {
			return clock, nil // the clock is stored; a missed broadcast is refreshed on reload
		}
	}
	return clock, nil
}

func accentsFold(s string) string {
	return strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u").Replace(strings.ToLower(strings.TrimSpace(s)))
}

// ---------- Agenda ----------

func (s *NPCAgenda) sceneMap(ctx context.Context, campaignID int64) (map[int64]*domain.VTTScene, error) {
	scenes, err := s.vtt.ListScenes(ctx, campaignID, false)
	if err != nil {
		return nil, err
	}
	m := make(map[int64]*domain.VTTScene, len(scenes))
	for i := range scenes {
		m[scenes[i].ID] = &scenes[i]
	}
	return m, nil
}

// nameScenes fills ubicacion.escena with the current scene names (informative field).
func nameScenes(a domain.Agenda, scenes map[int64]*domain.VTTScene) {
	for i := range a {
		if u := a[i].Ubicacion; u != nil {
			if sc, ok := scenes[u.EscenaID]; ok {
				u.Escena = sc.Name
			}
		}
	}
}

// Agenda returns an NPC's agenda with scene names.
func (s *NPCAgenda) Agenda(ctx context.Context, campaignID, npcID int64) (domain.Agenda, error) {
	a, err := s.repo.Agenda(ctx, campaignID, npcID)
	if err != nil {
		return nil, err
	}
	scenes, err := s.sceneMap(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	nameScenes(a, scenes)
	return a, nil
}

// SaveAgenda validates an agenda against the campaign scenes and stores it.
func (s *NPCAgenda) SaveAgenda(ctx context.Context, campaignID, npcID int64, a domain.Agenda) error {
	if _, err := s.repo.Agenda(ctx, campaignID, npcID); err != nil {
		return err
	}
	scenes, err := s.sceneMap(ctx, campaignID)
	if err != nil {
		return err
	}
	if err := ValidateAgenda(a, scenes); err != nil {
		return err
	}
	nameScenes(a, scenes)
	return s.repo.SaveAgenda(ctx, campaignID, npcID, a)
}

// Resolve returns the entry of an NPC for a day and time of day (the campaign's first weekday applies).
func (s *NPCAgenda) Resolve(ctx context.Context, campaignID, npcID int64, day int, tod string) (*domain.AgendaEntry, bool, error) {
	a, err := s.Agenda(ctx, campaignID, npcID)
	if err != nil {
		return nil, false, err
	}
	_, _, first, err := s.repo.Clock(ctx, campaignID)
	if err != nil {
		return nil, false, err
	}
	e, ok := ResolveAgenda(a, day, tod, FirstWeekday(first))
	return e, ok, nil
}

// ---------- Inventory document ----------

// ValidateNPCInventory checks the inventory section of a sheet document and reports every problem.
func ValidateNPCInventory(inv domain.NPCDocInventory) error {
	if len(inv.Objetos) > npcInventoryMaxItems {
		return AgendaError{[]string{fmt.Sprintf("el inventario admite como mucho %d objetos", npcInventoryMaxItems)}}
	}
	var problems []string
	if inv.MonedasCP < 0 {
		problems = append(problems, "monedas_cp no puede ser negativo")
	}
	for i, it := range inv.Objetos {
		bad := func(msg string) { problems = append(problems, fmt.Sprintf("objeto %d: %s", i+1, msg)) }
		switch {
		case strings.TrimSpace(it.Nombre) == "" || len(it.Nombre) > 200:
			bad("nombre obligatorio (máx. 200)")
		case it.Cantidad < 1:
			bad("cantidad debe ser ≥ 1")
		case it.Donde != "encima" && it.Donde != "casa":
			bad("donde debe ser encima o casa")
		case it.ValorCP != nil && *it.ValorCP < 0:
			bad("valor_cp no puede ser negativo")
		case it.Equipado && it.Donde != "encima":
			bad("equipado solo para lo que lleva encima")
		}
	}
	if len(problems) > 0 {
		return AgendaError{problems}
	}
	return nil
}

func itemLocation(donde string) string {
	if donde == "casa" {
		return "home"
	}
	return "inventory"
}

// ---------- Export / import (npc-agenda.md §5) ----------

var sheetSections = []string{"combate", "inventario", "agenda"}

// Export builds the sheet documents of the given NPCs (all when ids is empty) with the given sections (all when nil).
func (s *NPCAgenda) Export(ctx context.Context, campaignID int64, ids []int64, sections []string) ([]domain.NPCDocument, error) {
	want := map[string]bool{}
	for _, sec := range sections {
		want[sec] = true
	}
	if len(sections) == 0 {
		for _, sec := range sheetSections {
			want[sec] = true
		}
	}
	sheets, err := s.repo.Sheets(ctx, campaignID, ids, want["inventario"])
	if err != nil {
		return nil, err
	}
	scenes, err := s.sceneMap(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	docs := make([]domain.NPCDocument, 0, len(sheets))
	for _, sh := range sheets {
		d := domain.NPCDocument{Version: 1, PJ: domain.NPCDocPJ{ID: sh.ID, Nombre: sh.Name, Rol: sh.Role, Relacion: sh.Status, Raza: sh.Race, Clase: sh.Class}}
		if want["combate"] {
			combat, err := NormalizeNPCCombat(sh.Combat)
			if err != nil {
				combat = DefaultNPCCombat
			}
			d.Combate, _ = json.Marshal(combat)
		}
		if want["inventario"] {
			inv := &domain.NPCDocInventory{MonedasCP: sh.PurseCP, Objetos: []domain.NPCDocItem{}}
			for _, it := range sh.Items {
				donde := "encima"
				if it.Location == "home" {
					donde = "casa"
				}
				inv.Objetos = append(inv.Objetos, domain.NPCDocItem{Nombre: it.Name, Cantidad: it.Quantity, ValorCP: it.ValueCP, Donde: donde,
					Equipado: it.Equipped, Descripcion: it.Description, Origen: it.Source})
			}
			d.Inventario = inv
		}
		if want["agenda"] {
			a := sh.Agenda
			if a == nil {
				a = domain.Agenda{}
			}
			nameScenes(a, scenes)
			d.Agenda = &a
		}
		docs = append(docs, d)
	}
	return docs, nil
}

// ImportOptions: DryRun only validates; UpdateData also writes the pj data (role, relation, race, class).
type ImportOptions struct {
	DryRun     bool
	UpdateData bool
}

// ImportApplied tells which sections an import writes for one NPC.
type ImportApplied struct {
	NPCID    int64    `json:"npc_id"`
	Nombre   string   `json:"nombre"`
	Sections []string `json:"secciones"`
}

// ImportReport is the summary of an import (or of its dry run).
type ImportReport struct {
	DryRun  bool            `json:"dry_run"`
	Applied []ImportApplied `json:"aplicado"`
}

// Import validates every document first and writes them all in one transaction, or nothing.
func (s *NPCAgenda) Import(ctx context.Context, campaignID int64, docs []domain.NPCDocument, opt ImportOptions) (*ImportReport, error) {
	sheets, err := s.repo.Sheets(ctx, campaignID, nil, false)
	if err != nil {
		return nil, err
	}
	byID, byName := map[int64]string{}, map[string]int64{}
	for _, sh := range sheets {
		byID[sh.ID] = sh.Name
		byName[sh.Name] = sh.ID
	}
	scenes, err := s.sceneMap(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	var problems []string
	report := &ImportReport{DryRun: opt.DryRun, Applied: []ImportApplied{}}
	plans := make([]repository.SheetImport, 0, len(docs))
	for i, d := range docs {
		label := fmt.Sprintf("PNJ %d (%s)", i+1, d.PJ.Nombre)
		fail := func(msg string) { problems = append(problems, label+": "+msg) }
		id := d.PJ.ID
		if id != 0 {
			name, ok := byID[id]
			if !ok {
				fail(fmt.Sprintf("no existe el PNJ con id %d en esta campaña", id))
				continue
			}
			if d.PJ.Nombre == "" {
				label = fmt.Sprintf("PNJ %d (%s)", i+1, name)
			}
		} else if id = byName[d.PJ.Nombre]; id == 0 {
			fail("no existe en esta campaña (no se crean PNJ al importar)")
			continue
		}
		plan := repository.SheetImport{NPCID: id}
		applied := ImportApplied{NPCID: id, Nombre: byID[id], Sections: []string{}}
		if opt.UpdateData {
			pj := d.PJ
			if pj.Relacion != "" && pj.Relacion != "ally" && pj.Relacion != "neutral" && pj.Relacion != "enemy" {
				fail("relacion debe ser ally, neutral o enemy")
				continue
			}
			plan.PJ = &pj
			applied.Sections = append(applied.Sections, "datos")
		}
		if len(d.Combate) > 0 {
			combat, err := NormalizeNPCCombat(d.Combate)
			if err != nil {
				fail(err.Error())
				continue
			}
			plan.Combat = &combat
			applied.Sections = append(applied.Sections, "combate")
		}
		if d.Inventario != nil {
			if err := ValidateNPCInventory(*d.Inventario); err != nil {
				fail(err.Error())
				continue
			}
			purse := d.Inventario.MonedasCP
			plan.PurseCP = &purse
			for _, it := range d.Inventario.Objetos {
				plan.Items = append(plan.Items, domain.NPCItem{NPCID: id, Name: strings.TrimSpace(it.Nombre), Quantity: it.Cantidad, ValueCP: it.ValorCP,
					Description: it.Descripcion, Location: itemLocation(it.Donde), Source: it.Origen, Equipped: it.Equipado})
			}
			applied.Sections = append(applied.Sections, "inventario")
		}
		if d.Agenda != nil {
			if err := ValidateAgenda(*d.Agenda, scenes); err != nil {
				fail("agenda: " + err.Error())
				continue
			}
			a := *d.Agenda
			nameScenes(a, scenes)
			plan.Agenda = &a
			applied.Sections = append(applied.Sections, "agenda")
		}
		plans = append(plans, plan)
		report.Applied = append(report.Applied, applied)
	}
	if len(problems) > 0 {
		return nil, AgendaError{problems}
	}
	if opt.DryRun {
		return report, nil
	}
	if err := s.repo.ImportSheets(ctx, campaignID, plans); err != nil {
		return nil, err
	}
	return report, nil
}

// ParseNPCDocuments reads an import file: an array of sheet documents or a single one.
func ParseNPCDocuments(raw []byte) ([]domain.NPCDocument, error) {
	trimmed := strings.TrimSpace(string(raw))
	if strings.HasPrefix(trimmed, "{") {
		var d domain.NPCDocument
		if err := json.Unmarshal(raw, &d); err != nil {
			return nil, err
		}
		return []domain.NPCDocument{d}, nil
	}
	var docs []domain.NPCDocument
	if err := json.Unmarshal(raw, &docs); err != nil {
		return nil, err
	}
	return docs, nil
}
