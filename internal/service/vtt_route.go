package service

import (
	"context"
	"errors"
	"log"
	"time"

	"dnd-campaign-manager/internal/domain"
)

// ErrRouteNotAllowed: player tokens never walk a route (vtt-npc-routines.md §3).
var ErrRouteNotAllowed = errors.New("player tokens cannot have a route")

// RouteError is a route rejected by ValidateRoute; its message is safe to show to the GM.
type RouteError struct{ Err error }

func (e RouteError) Error() string { return e.Err.Error() }

// routeRate is the walking rate of a route token in its scene.
func routeRate(scene *domain.VTTScene, t *domain.VTTToken) float64 {
	return RouteRate(scene, t.SpeedFt)
}

// placeOnRoute puts the token where its clock says.
func placeOnRoute(scene *domain.VTTScene, t *domain.VTTToken, now time.Time) {
	if t.Route != nil {
		t.X, t.Y = RoutePosition(*t.Route, routeRate(scene, t), ClockElapsed(*t, now))
	}
}

// saveRoute persists the route state and tells the clients (GM only for hidden tokens).
func (p *VTTPlay) saveRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken, now time.Time) error {
	if err := p.repo.SaveRouteState(ctx, t); err != nil {
		return err
	}
	p.announceRoute(ctx, scene, t, now)
	return nil
}

func (p *VTTPlay) announceRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken, now time.Time) {
	if p.rt == nil {
		return
	}
	payload := map[string]any{"scene_id": scene.ID, "token_id": t.ID, "route": t.Route, "route_paused": t.RoutePaused,
		"route_clock": RouteClockView(*t, now), "x": t.X, "y": t.Y}
	var err error
	if t.Hidden {
		gms, gerr := p.repo.CampaignGMs(ctx, scene.CampaignID)
		if gerr != nil || len(gms) == 0 {
			return
		}
		err = p.rt.BroadcastTo(ctx, scene.CampaignID, gms, "vtt.route.updated", payload)
	} else {
		err = p.rt.Broadcast(ctx, scene.CampaignID, "vtt.route.updated", payload)
	}
	if err != nil {
		log.Printf("vtt route: broadcast: %v", err)
	}
}

// syncRoute starts or freezes a token's clock to match the scene state (§3 Reloj de la ruta).
func (p *VTTPlay) syncRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken, now time.Time) error {
	if t.Route == nil {
		return nil
	}
	combatID, err := p.repo.TokenInCombat(ctx, t.ID)
	if err != nil {
		return err
	}
	should := RouteShouldRun(scene, *t, combatID != 0)
	if should == (t.RouteStartedAt != nil) {
		return nil
	}
	if should {
		ResumeClock(t, now)
	} else {
		FreezeClock(t, now)
	}
	placeOnRoute(scene, t, now)
	return p.saveRoute(ctx, scene, t, now)
}

// SyncSceneRoutes freezes or resumes every route of a scene after its mode, activation or combats changed.
func (p *VTTPlay) SyncSceneRoutes(ctx context.Context, scene *domain.VTTScene) {
	tokens, err := p.repo.ListTokens(ctx, scene.ID, true)
	if err != nil {
		log.Printf("vtt route: sync scene %d: %v", scene.ID, err)
		return
	}
	now := time.Now()
	for i := range tokens {
		if err := p.syncRoute(ctx, scene, &tokens[i], now); err != nil {
			log.Printf("vtt route: sync token %d: %v", tokens[i].ID, err)
		}
	}
}

// SyncCampaignRoutes syncs every scene of a campaign (the active scene changed).
func (p *VTTPlay) SyncCampaignRoutes(ctx context.Context, campaignID int64) {
	scenes, err := p.repo.ListScenes(ctx, campaignID, false)
	if err != nil {
		log.Printf("vtt route: sync campaign %d: %v", campaignID, err)
		return
	}
	for i := range scenes {
		p.SyncSceneRoutes(ctx, &scenes[i])
	}
}

// SetRoute replaces (or with nil removes) a token's route: the token goes to P0 with the clock at 0.
func (p *VTTPlay) SetRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken, route *domain.Route) error {
	if route != nil {
		if t.Kind == "pc" {
			return ErrRouteNotAllowed
		}
		if err := ValidateRoute(scene, *route); err != nil {
			return RouteError{err}
		}
		t.X, t.Y = route.Points[0].X, route.Points[0].Y
	}
	now := time.Now()
	t.Route, t.RoutePaused, t.RouteElapsedMs, t.RouteStartedAt = route, false, 0, nil
	if route != nil {
		if combatID, err := p.repo.TokenInCombat(ctx, t.ID); err != nil {
			return err
		} else if RouteShouldRun(scene, *t, combatID != 0) {
			ResumeClock(t, now)
		}
	}
	return p.saveRoute(ctx, scene, t, now)
}

// PauseRoute: the GM stops a token on its route; it keeps its progress.
func (p *VTTPlay) PauseRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken) error {
	t.RoutePaused = true
	return p.syncRoute(ctx, scene, t, time.Now())
}

// ResumeRoute: the token goes back to where its progress says and walks on (if the scene allows).
func (p *VTTPlay) ResumeRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken) error {
	now := time.Now()
	t.RoutePaused = false
	placeOnRoute(scene, t, now)
	if t.RouteStartedAt == nil {
		if combatID, err := p.repo.TokenInCombat(ctx, t.ID); err != nil {
			return err
		} else if RouteShouldRun(scene, *t, combatID != 0) {
			ResumeClock(t, now)
		}
	}
	return p.saveRoute(ctx, scene, t, now)
}

// RestartRoute sends the token back to P0 with the clock at 0.
func (p *VTTPlay) RestartRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken) error {
	route := t.Route
	if route == nil {
		return nil
	}
	return p.SetRoute(ctx, scene, t, route)
}

// PauseForDrag: a token with a route dragged by hand stays where it was dropped, paused (§3).
func (p *VTTPlay) PauseForDrag(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken, x, y float64) error {
	if t.Route == nil {
		return nil
	}
	now := time.Now()
	FreezeClock(t, now)
	t.RoutePaused, t.X, t.Y = true, x, y
	return p.saveRoute(ctx, scene, t, now)
}

// RetimeRoute keeps a token in place when its walking rate changes (speed, pace, grid).
func (p *VTTPlay) RetimeRoute(ctx context.Context, scene *domain.VTTScene, t *domain.VTTToken, oldRate float64) error {
	newRate := routeRate(scene, t)
	if t.Route == nil || newRate == oldRate {
		return nil
	}
	now := time.Now()
	elapsed := RescaleElapsed(*t.Route, oldRate, newRate, ClockElapsed(*t, now))
	t.RouteElapsedMs = elapsed.Milliseconds()
	if t.RouteStartedAt != nil {
		t.RouteStartedAt = &now
	}
	placeOnRoute(scene, t, now)
	return p.saveRoute(ctx, scene, t, now)
}

// SceneChanged retimes the routes whose rate changed and syncs their clocks with the new scene state.
func (p *VTTPlay) SceneChanged(ctx context.Context, before, after *domain.VTTScene) {
	tokens, err := p.repo.ListTokens(ctx, after.ID, true)
	if err != nil {
		log.Printf("vtt route: scene changed %d: %v", after.ID, err)
		return
	}
	for i := range tokens {
		t := &tokens[i]
		if t.Route == nil {
			continue
		}
		if err := p.RetimeRoute(ctx, after, t, routeRate(before, t)); err != nil {
			log.Printf("vtt route: retime token %d: %v", t.ID, err)
		}
		if err := p.syncRoute(ctx, after, t, time.Now()); err != nil {
			log.Printf("vtt route: sync token %d: %v", t.ID, err)
		}
	}
}

// syncCombatScene syncs the routes of a combat's scene (a combat started or ended).
func (p *VTTPlay) syncCombatScene(ctx context.Context, sceneID int64) {
	if scene, err := p.repo.SceneByID(ctx, sceneID); err == nil {
		p.SyncSceneRoutes(ctx, scene)
	}
}
