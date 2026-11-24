package service

import (
	"bytes"
	"context"
	"encoding/json"
	"log"

	"dnd-campaign-manager/internal/domain"
)

// SkippedNPC is an NPC the agenda could not move, with the reason shown to the GM.
type SkippedNPC struct {
	Nombre string `json:"nombre"`
	Motivo string `json:"motivo"`
}

// ApplySummary tells the GM what applying the agenda did (npc-agenda.md §3).
type ApplySummary struct {
	Created   []string     `json:"creados"`
	Moved     []string     `json:"movidos"`
	Removed   []string     `json:"retirados"`
	Unchanged int          `json:"sin_cambios"`
	Skipped   []SkippedNPC `json:"saltados"`
}

// Whereabout is one row of the "Dónde están ahora" view (npc-agenda.md §5).
type Whereabout struct {
	NPCID     int64               `json:"npc_id"`
	Nombre    string              `json:"nombre"`
	Relacion  string              `json:"relacion"`
	EscenaID  *int64              `json:"escena_id"`
	Escena    string              `json:"escena"`
	Estado    string              `json:"estado"`
	Siguiente *domain.AgendaEntry `json:"siguiente"`
}

// ChangeClock stores the new clock and moves the NPCs to their entries.
func (s *NPCAgenda) ChangeClock(ctx context.Context, campaignID int64, in ClockChange) (domain.GameClock, *ApplySummary, error) {
	clock, err := s.SetClock(ctx, campaignID, in)
	if err != nil {
		return clock, nil, err
	}
	sum, err := s.ApplyAgendas(ctx, campaignID)
	return clock, sum, err
}

func sameRoute(a, b *domain.Route) bool {
	if a == nil || b == nil {
		return a == b
	}
	ja, _ := json.Marshal(a)
	jb, _ := json.Marshal(b)
	return bytes.Equal(ja, jb)
}

// ApplyAgendas puts every NPC with an agenda where its entry for the current clock says. It is
// idempotent: an NPC already in place keeps its token and its route clock.
func (s *NPCAgenda) ApplyAgendas(ctx context.Context, campaignID int64) (*ApplySummary, error) {
	day, tod, first, err := s.repo.Clock(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	sheets, err := s.repo.Sheets(ctx, campaignID, nil, false)
	if err != nil {
		return nil, err
	}
	scenes, err := s.sceneMap(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	tokens, err := s.vtt.NPCTokens(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	byNPC := map[int64][]domain.VTTToken{}
	for _, t := range tokens {
		byNPC[*t.NpcID] = append(byNPC[*t.NpcID], t)
	}
	sum := &ApplySummary{Created: []string{}, Moved: []string{}, Removed: []string{}, Skipped: []SkippedNPC{}}
	touched := map[int64]bool{}
	for _, sh := range sheets {
		if len(sh.Agenda) == 0 {
			continue
		}
		e, ok := ResolveAgenda(sh.Agenda, day, tod, FirstWeekday(first))
		if !ok {
			continue // no entry: the NPC stays where it is
		}
		mine := byNPC[sh.ID]
		if where := s.inCombat(ctx, mine, scenes); where != "" {
			sum.Skipped = append(sum.Skipped, SkippedNPC{sh.Name, "sigue en combate en " + where + "; se moverá al terminar"})
			continue
		}
		if e.Ubicacion == nil { // away: off every map
			for _, t := range mine {
				if _, err := s.vtt.DeleteToken(ctx, campaignID, t.ID); err != nil {
					return sum, err
				}
				touched[t.SceneID] = true
			}
			if len(mine) > 0 {
				sum.Removed = append(sum.Removed, sh.Name)
			}
			continue
		}
		scene, ok := scenes[e.Ubicacion.EscenaID]
		if !ok {
			sum.Skipped = append(sum.Skipped, SkippedNPC{sh.Name, "escena borrada"})
			continue
		}
		changed, created, err := s.placeNPC(ctx, scene, sh.ID, sh.Name, mine, e, touched)
		if err != nil {
			return sum, err
		}
		switch {
		case created:
			sum.Created = append(sum.Created, sh.Name)
		case changed:
			sum.Moved = append(sum.Moved, sh.Name)
		default:
			sum.Unchanged++
		}
	}
	s.announce(ctx, campaignID, touched)
	return sum, nil
}

// inCombat returns the scene name where one of the tokens fights, or "".
func (s *NPCAgenda) inCombat(ctx context.Context, tokens []domain.VTTToken, scenes map[int64]*domain.VTTScene) string {
	for _, t := range tokens {
		if id, _ := s.vtt.TokenInCombat(ctx, t.ID); id != 0 {
			if sc, ok := scenes[t.SceneID]; ok {
				return sc.Name
			}
			return "otra escena"
		}
	}
	return ""
}

// placeNPC leaves exactly one token of the NPC in the entry's scene (reused, moved or created).
func (s *NPCAgenda) placeNPC(ctx context.Context, scene *domain.VTTScene, npcID int64, name string, mine []domain.VTTToken,
	e *domain.AgendaEntry, touched map[int64]bool) (changed, created bool, err error) {
	var x, y float64
	if e.Path != nil {
		x, y = e.Path.Points[0].X, e.Path.Points[0].Y
	} else {
		x, y = e.Posicion.X, e.Posicion.Y
	}
	keep := -1
	for i, t := range mine {
		if t.SceneID == scene.ID {
			keep = i
			break
		}
	}
	if keep >= 0 && len(mine) == 1 {
		t := mine[keep]
		if t.Hidden == e.Oculto && sameRoute(t.Route, e.Path) && (e.Path != nil || (t.X == x && t.Y == y)) {
			return false, false, nil
		}
	}
	if keep < 0 && len(mine) > 0 {
		keep = 0
	}
	for i, t := range mine {
		if i == keep {
			continue
		}
		if _, err := s.vtt.DeleteToken(ctx, scene.CampaignID, t.ID); err != nil {
			return false, false, err
		}
		touched[t.SceneID] = true
	}
	var tok *domain.VTTToken
	if keep >= 0 {
		t := mine[keep]
		touched[t.SceneID] = true
		if err := s.vtt.PlaceToken(ctx, t.ID, scene.ID, x, y, e.Oculto); err != nil {
			return false, false, err
		}
		t.SceneID, t.X, t.Y, t.Hidden = scene.ID, x, y, e.Oculto
		tok = &t
	} else {
		npc, err := s.vtt.CampaignNPC(ctx, scene.CampaignID, npcID)
		if err != nil {
			return false, false, err
		}
		t := domain.VTTToken{SceneID: scene.ID, CampaignID: scene.CampaignID, Name: name, Kind: "npc", NpcID: &npcID, ImageURL: npc.ImageURL,
			Color: "#c9a227", X: x, Y: y, Hidden: e.Oculto, Disposition: "neutral"}
		sheet, err := NormalizeNPCCombat(npc.Combat)
		if err != nil {
			sheet = DefaultNPCCombat
		}
		ApplyNPCCombat(&t, sheet)
		if err := s.vtt.CreateToken(ctx, &t); err != nil {
			return false, false, err
		}
		tok, created = &t, true
	}
	touched[scene.ID] = true
	if s.play != nil && (tok.Route != nil || e.Path != nil) {
		route := e.Path
		if route != nil {
			copyRoute := *route
			route = &copyRoute
		}
		if err := s.play.SetRoute(ctx, scene, tok, route); err != nil {
			return false, created, err
		}
	}
	return true, created, nil
}

// announce tells the clients of every touched scene to reload it.
func (s *NPCAgenda) announce(ctx context.Context, campaignID int64, scenes map[int64]bool) {
	if s.rt == nil {
		return
	}
	for id := range scenes {
		if err := s.rt.Publish(ctx, campaignID, 0, "vtt.scene.updated", map[string]any{"scene_id": id}); err != nil {
			log.Printf("npc agenda: announce scene %d: %v", id, err)
		}
	}
}

// Whereabouts lists every campaign NPC: where it is now, its state and the entry of the next time of day.
func (s *NPCAgenda) Whereabouts(ctx context.Context, campaignID int64) ([]Whereabout, error) {
	day, tod, first, err := s.repo.Clock(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	sheets, err := s.repo.Sheets(ctx, campaignID, nil, false)
	if err != nil {
		return nil, err
	}
	scenes, err := s.sceneMap(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	tokens, err := s.vtt.NPCTokens(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	byNPC := map[int64]domain.VTTToken{}
	for _, t := range tokens {
		if _, seen := byNPC[*t.NpcID]; !seen {
			byNPC[*t.NpcID] = t
		}
	}
	nextDay, nextTod := StepClock(day, tod, 1)
	out := make([]Whereabout, 0, len(sheets))
	for _, sh := range sheets {
		w := Whereabout{NPCID: sh.ID, Nombre: sh.Name, Relacion: sh.Status}
		t, onMap := byNPC[sh.ID]
		switch {
		case onMap:
			id := t.SceneID
			w.EscenaID = &id
			if sc, ok := scenes[id]; ok {
				w.Escena = sc.Name
			}
			w.Estado = tokenState(ctx, s, t)
		case len(sh.Agenda) > 0:
			w.Estado = "ausente"
		}
		if len(sh.Agenda) == 0 {
			w.Estado = "sin_agenda"
		} else if e, ok := ResolveAgenda(sh.Agenda, nextDay, nextTod, FirstWeekday(first)); ok {
			next := *e
			if next.Ubicacion != nil {
				place := *next.Ubicacion
				if sc, ok := scenes[place.EscenaID]; ok {
					place.Escena = sc.Name
				}
				next.Ubicacion = &place
			}
			w.Siguiente = &next
		}
		out = append(out, w)
	}
	return out, nil
}

func tokenState(ctx context.Context, s *NPCAgenda, t domain.VTTToken) string {
	if id, _ := s.vtt.TokenInCombat(ctx, t.ID); id != 0 {
		return "en_combate"
	}
	switch {
	case t.Route == nil:
		return "quieto"
	case t.RoutePaused:
		return "pausado"
	case t.RouteStartedAt != nil:
		return "en_ruta"
	}
	return "detenido"
}
