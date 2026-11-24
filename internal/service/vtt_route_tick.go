package service

import (
	"context"
	"log"
	"math"
	"time"

	"dnd-campaign-manager/internal/domain"
)

// tickRoutes runs once per second (RunTimers): it stores where the running routes are, so encounters,
// vision and combat read fresh positions, and lets moving hostile detectors notice players
// (vtt-npc-routines.md §4). Without running routes it costs one indexed query.
func (p *VTTPlay) tickRoutes(ctx context.Context, now time.Time) {
	sceneIDs, err := p.repo.RunningRouteScenes(ctx)
	if err != nil {
		log.Printf("vtt route: running scenes: %v", err)
		return
	}
	for _, id := range sceneIDs {
		scene, err := p.repo.SceneByID(ctx, id)
		if err != nil {
			continue
		}
		if !scene.IsActive || scene.Mode != "exploration" {
			p.SyncSceneRoutes(ctx, scene) // a route left running where it must not: freeze it
			continue
		}
		p.tickScene(ctx, scene, now)
	}
}

func (p *VTTPlay) tickScene(ctx context.Context, scene *domain.VTTScene, now time.Time) {
	tokens, err := p.repo.ListTokens(ctx, scene.ID, true)
	if err != nil {
		log.Printf("vtt route: tokens of scene %d: %v", scene.ID, err)
		return
	}
	var ids []int64
	var xs, ys []float64
	walking := make([]int, 0, 4)
	for i := range tokens {
		t := &tokens[i]
		if t.Route == nil || t.RouteStartedAt == nil {
			continue
		}
		x, y := RoutePosition(*t.Route, routeRate(scene, t), ClockElapsed(*t, now))
		if math.Abs(x-t.X) > 0.01 || math.Abs(y-t.Y) > 0.01 {
			ids, xs, ys = append(ids, t.ID), append(xs, x), append(ys, y)
			t.X, t.Y = x, y
		}
		walking = append(walking, i)
	}
	if err := p.repo.SaveRoutePositions(ctx, ids, xs, ys); err != nil {
		log.Printf("vtt route: save positions of scene %d: %v", scene.ID, err)
	}
	for _, i := range walking {
		m := tokens[i]
		if !canDetect(m) {
			continue
		}
		for j := range tokens {
			pc := tokens[j]
			if pc.Kind != "pc" || !CanSee(scene, tokens, m, pc.X, pc.Y) {
				continue
			}
			if busy, _ := p.repo.TokenInCombat(ctx, pc.ID); busy != 0 {
				continue
			}
			if p.notices(m, pc, p.seenBy(pc, scene.ID)) {
				if _, err := p.StartEncounter(ctx, scene, pc.X, pc.Y, []int64{m.ID}, nil); err != nil {
					log.Printf("vtt route: patrol encounter: %v", err)
				}
				return // positions and combats changed: the next tick looks again
			}
		}
	}
}

// canDetect: only standing, hostile tokens with detects start encounters (vtt-npc-routines.md §2).
func canDetect(m domain.VTTToken) bool {
	return m.Detects && m.Kind != "pc" && !(m.HP <= 0 && m.MaxHP > 0) && EffectiveDisposition(m) == "hostile"
}

// notices applies the senses rule once the detector sees the token: a sneaking token rolls Stealth
// (d20 + DEX + bonus) the first time it enters this detector's view (vtt-modes.md §4).
func (p *VTTPlay) notices(m, target domain.VTTToken, seenBy map[int64]bool) bool {
	if !target.Sneaking {
		return true
	}
	p.mu.Lock()
	already := seenBy[m.ID]
	seenBy[m.ID] = true
	p.mu.Unlock()
	if already {
		return false // already beat this detector's perception while in view
	}
	passive := m.PassivePerc
	if passive == 0 {
		passive = 10
	}
	return p.d20()+target.DexMod+target.StealthBonus < passive
}

// seenBy returns the tracked "already rolled against" set of a player token, creating the
// tracking entry (without a pending save) when the player has not moved since the server started.
func (p *VTTPlay) seenBy(t domain.VTTToken, sceneID int64) map[int64]bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	pos, ok := p.last[t.ID]
	if !ok || pos.sceneID != sceneID {
		pos = trackedPos{x: t.X, y: t.Y, at: t.UpdatedAt, savedAt: t.UpdatedAt, sceneID: sceneID, seenBy: map[int64]bool{}}
		p.last[t.ID] = pos
	}
	return pos.seenBy
}
