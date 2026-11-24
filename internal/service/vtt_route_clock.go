package service

import (
	"math"
	"time"

	"dnd-campaign-manager/internal/domain"
)

// ---------- Disposition (vtt-npc-routines.md §2) ----------

// npcRelation maps a campaign NPC relation (campaign_npcs.status) to a token disposition.
var npcRelation = map[string]string{"enemy": "hostile", "neutral": "neutral", "ally": "friendly"}

// ValidDisposition reports whether v is a token disposition.
func ValidDisposition(v string) bool { return v == "hostile" || v == "neutral" || v == "friendly" }

// DefaultDisposition is the disposition of a loose token of the given kind.
func DefaultDisposition(kind string) string {
	switch kind {
	case "monster":
		return "hostile"
	case "pc":
		return "friendly"
	}
	return "neutral"
}

// EffectiveDisposition follows the linked NPC's relation live; loose tokens use their own column.
func EffectiveDisposition(t domain.VTTToken) string {
	if t.Kind == "pc" {
		return "friendly"
	}
	if t.NpcID != nil && t.NpcStatus != nil {
		if d, ok := npcRelation[*t.NpcStatus]; ok {
			return d
		}
		return "neutral"
	}
	if ValidDisposition(t.Disposition) {
		return t.Disposition
	}
	return DefaultDisposition(t.Kind)
}

// ---------- Route clock (vtt-npc-routines.md §3) ----------

// ClockElapsed is the walking time accumulated by a token's route at `now`.
func ClockElapsed(t domain.VTTToken, now time.Time) time.Duration {
	elapsed := time.Duration(t.RouteElapsedMs) * time.Millisecond
	if t.RouteStartedAt != nil && now.After(*t.RouteStartedAt) {
		elapsed += now.Sub(*t.RouteStartedAt)
	}
	return elapsed
}

// FreezeClock stops a running clock, keeping the time walked so far.
func FreezeClock(t *domain.VTTToken, now time.Time) {
	if t.RouteStartedAt == nil {
		return
	}
	t.RouteElapsedMs = ClockElapsed(*t, now).Milliseconds()
	t.RouteStartedAt = nil
}

// ResumeClock starts a stopped clock from the time it had walked.
func ResumeClock(t *domain.VTTToken, now time.Time) {
	if t.RouteStartedAt != nil {
		return
	}
	at := now
	t.RouteStartedAt = &at
}

// RouteClockView is the clock sent to clients, or nil for a token without route.
func RouteClockView(t domain.VTTToken, now time.Time) *domain.RouteClock {
	if t.Route == nil {
		return nil
	}
	return &domain.RouteClock{ElapsedMs: ClockElapsed(t, now).Milliseconds(), Running: t.RouteStartedAt != nil}
}

// RouteShouldRun: only in the active scene, in exploration, outside combat and not paused by the GM.
func RouteShouldRun(scene *domain.VTTScene, t domain.VTTToken, inCombat bool) bool {
	return t.Route != nil && !t.RoutePaused && !inCombat && scene.IsActive && scene.Mode == "exploration"
}

// RouteRate is the walking exploration rate of a route token; speed 0 stands still.
func RouteRate(scene *domain.VTTScene, speedFt int) float64 {
	if speedFt <= 0 {
		return 0
	}
	return ExplorationRatePxPerSec(scene, speedFt, false)
}

// RescaleElapsed converts the walked time at oldRate into the time that puts the token at the
// same place at newRate, so a change of speed or scene pace does not make the token jump.
func RescaleElapsed(route domain.Route, oldRate, newRate float64, elapsed time.Duration) time.Duration {
	if oldRate <= 0 || elapsed <= 0 || len(route.Points) < 2 {
		return 0
	}
	if newRate <= 0 {
		return elapsed
	}
	oldLegs, newLegs := routeLegs(route, oldRate), routeLegs(route, newRate)
	oldTotal, newTotal := 0.0, 0.0
	for i := range oldLegs {
		oldTotal += oldLegs[i].move + oldLegs[i].wait
		newTotal += newLegs[i].move + newLegs[i].wait
	}
	if oldTotal <= 0 {
		return 0
	}
	t := elapsed.Seconds()
	cycles := 0.0
	if route.Mode == "once" {
		if t >= oldTotal {
			return seconds(newTotal)
		}
	} else {
		cycles = math.Floor(t / oldTotal)
		t -= cycles * oldTotal
	}
	out := cycles * newTotal
	for i, l := range oldLegs {
		n := newLegs[i]
		if t < l.move {
			return seconds(out + t/l.move*n.move)
		}
		t -= l.move
		out += n.move
		if t < l.wait {
			return seconds(out + t)
		}
		t -= l.wait
		out += n.wait
	}
	return seconds(out)
}

func seconds(s float64) time.Duration { return time.Duration(math.Round(s * float64(time.Second))) }
