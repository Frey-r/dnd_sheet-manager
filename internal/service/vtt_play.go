package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"math/rand/v2"
	"sync"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// Realtime publishes campaign events: Publish is stored in the event log, Broadcast is ephemeral.
type Realtime interface {
	Publish(ctx context.Context, campaignID, userID int64, eventType string, payload any) error
	Broadcast(ctx context.Context, campaignID int64, eventType string, payload any) error
}

// Errors surfaced to players as HTTP 4xx.
var (
	ErrNotYourTurn     = errors.New("not your turn")
	ErrNoMovementLeft  = errors.New("not enough movement left this turn")
	ErrTooFar          = errors.New("you must be next to the object")
	ErrRequirementsMet = errors.New("requirements not met")
	ErrInCombat        = errors.New("token is in combat")
)

const joinRadiusFt = 60

// VTTPlay runs exploration and local combats (openspec/specs/vtt-modes.md).
type VTTPlay struct {
	repo *repository.VTTRepository
	rt   Realtime
	rnd  *rand.Rand
	mu   sync.Mutex
	last map[int64]trackedPos // token id → last accepted exploration position
}

type trackedPos struct {
	x, y    float64
	at      time.Time
	savedAt time.Time
	sceneID int64
	seenBy  map[int64]bool // monster token ids that already noticed / rolled against this token
}

func NewVTTPlay(repo *repository.VTTRepository, rt Realtime) *VTTPlay {
	return &VTTPlay{repo: repo, rt: rt, rnd: rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 0x5eed)), last: map[int64]trackedPos{}}
}

func (p *VTTPlay) d20() int { p.mu.Lock(); defer p.mu.Unlock(); return 1 + p.rnd.IntN(20) }

func (p *VTTPlay) emit(ctx context.Context, campaignID int64, event string, payload any) {
	if err := p.rt.Publish(ctx, campaignID, 0, event, payload); err != nil {
		log.Printf("vtt play: publish %s: %v", event, err)
	}
}

// ---------- Exploration movement ----------

// HandleMove processes a "vtt.move" WebSocket message from a player.
func (p *VTTPlay) HandleMove(ctx context.Context, userID, campaignID int64, raw json.RawMessage) {
	var in struct {
		TokenID int64   `json:"token_id"`
		X       float64 `json:"x"`
		Y       float64 `json:"y"`
	}
	if json.Unmarshal(raw, &in) != nil || in.TokenID == 0 {
		return
	}
	token, err := p.repo.TokenByID(ctx, in.TokenID)
	if err != nil || token.CampaignID != campaignID || token.OwnerUserID == nil || *token.OwnerUserID != userID {
		return
	}
	scene, err := p.repo.SceneByID(ctx, token.SceneID)
	if err != nil || !scene.IsActive || scene.Mode != "exploration" {
		return
	}
	if combatID, _ := p.repo.TokenInCombat(ctx, token.ID); combatID != 0 {
		return
	}
	now := time.Now()
	p.mu.Lock()
	prev, ok := p.last[token.ID]
	// Reset tracking when the token was moved by other means (GM drag, combat move, scene switch).
	if !ok || prev.sceneID != scene.ID || token.UpdatedAt.After(prev.savedAt.Add(50*time.Millisecond)) && math.Hypot(token.X-prev.x, token.Y-prev.y) > 1 {
		prev = trackedPos{x: token.X, y: token.Y, at: now.Add(-200 * time.Millisecond), savedAt: token.UpdatedAt, sceneID: scene.ID, seenBy: map[int64]bool{}}
	}
	p.mu.Unlock()

	dt := math.Min(now.Sub(prev.at).Seconds(), 1.0)
	allowed := ExplorationRatePxPerSec(scene, token.SpeedFt, token.Sneaking)*dt*1.25 + float64(scene.GridSizePx)*0.1
	x, y := ClampStep(prev.x, prev.y, in.X, in.Y, allowed)
	x = math.Max(0, math.Min(float64(scene.WidthPx), x))
	y = math.Max(0, math.Min(float64(scene.HeightPx), y))
	x, y = SlideMove(scene.Walls, prev.x, prev.y, x, y)
	// Tell the mover's client to resync when the server position differs from what it asked for.
	corrected := math.Hypot(in.X-x, in.Y-y) > float64(scene.GridSizePx)*0.25
	prev.x, prev.y, prev.at = x, y, now
	if now.Sub(prev.savedAt) > time.Second {
		if err := p.repo.TouchToken(ctx, token.ID, x, y, now); err == nil {
			prev.savedAt = now
		}
	}
	p.mu.Lock()
	p.last[token.ID] = prev
	p.mu.Unlock()
	_ = p.rt.Broadcast(ctx, campaignID, "vtt.token.moved", map[string]any{"scene_id": scene.ID, "token_id": token.ID, "x": x, "y": y, "corrected": corrected})

	token.X, token.Y = x, y
	p.checkTriggers(ctx, scene, token, &prev)
}

// checkTriggers starts encounters from zones or senses and queues explorers near active combats.
func (p *VTTPlay) checkTriggers(ctx context.Context, scene *domain.VTTScene, mover *domain.VTTToken, pos *trackedPos) {
	tokens, err := p.repo.ListTokens(ctx, scene.ID, true)
	if err != nil {
		return
	}
	// 1. Join an active combat nearby (end of round).
	combats, _ := p.repo.ActiveCombats(ctx, scene.ID)
	k := ftToPx(scene)
	for _, c := range combats {
		if math.Hypot(mover.X-c.CenterX, mover.Y-c.CenterY) <= joinRadiusFt*k && !sightBlocked(scene, mover.X, mover.Y, c.CenterX, c.CenterY) {
			if p.repo.AddPending(ctx, c.ID, mover.ID, p.d20()+mover.DexMod) == nil {
				p.emit(ctx, scene.CampaignID, "vtt.combat.updated", map[string]any{"scene_id": scene.ID, "combat_id": c.ID, "joining": mover.ID})
			}
			return
		}
	}
	// 2. Encounter zones.
	for i, z := range scene.Zones {
		if z.Armed && PointInPolygon(mover.X, mover.Y, z.Points) {
			scene.Zones[i].Armed = false
			_ = p.repo.DisarmZone(ctx, scene.ID, scene.Zones)
			_, _ = p.StartEncounter(ctx, scene, mover.X, mover.Y, z.MonsterIDs, nil)
			return
		}
	}
	// 3. Detection by senses (monsters with detects=true that are not already fighting).
	for _, m := range tokens {
		if !m.Detects || m.Kind == "pc" || m.HP <= 0 && m.MaxHP > 0 {
			continue
		}
		if inCombat, _ := p.repo.TokenInCombat(ctx, m.ID); inCombat != 0 {
			continue
		}
		if !CanSee(scene, tokens, m, mover.X, mover.Y) {
			continue
		}
		detected := true
		if mover.Sneaking {
			if pos.seenBy[m.ID] {
				continue // already beat this monster's perception while in view
			}
			pos.seenBy[m.ID] = true
			p.mu.Lock()
			p.last[mover.ID] = *pos
			p.mu.Unlock()
			passive := m.PassivePerc
			if passive == 0 {
				passive = 10
			}
			detected = p.d20()+mover.DexMod+mover.StealthBonus < passive
		}
		if detected {
			_, _ = p.StartEncounter(ctx, scene, mover.X, mover.Y, []int64{m.ID}, nil)
			return
		}
	}
}

// StartEncounter creates a local combat: given monsters plus player tokens within 60 ft with line of
// sight to the trigger point (or exactly playerIDs when provided by the GM).
func (p *VTTPlay) StartEncounter(ctx context.Context, scene *domain.VTTScene, cx, cy float64, monsterIDs, playerIDs []int64) (*domain.VTTCombat, error) {
	tokens, err := p.repo.ListTokens(ctx, scene.ID, true)
	if err != nil {
		return nil, err
	}
	k := ftToPx(scene)
	wantMonster := map[int64]bool{}
	for _, id := range monsterIDs {
		wantMonster[id] = true
	}
	wantPlayer := map[int64]bool{}
	for _, id := range playerIDs {
		wantPlayer[id] = true
	}
	var list []domain.VTTCombatant
	for _, t := range tokens {
		if busy, _ := p.repo.TokenInCombat(ctx, t.ID); busy != 0 {
			continue
		}
		isPC := t.Kind == "pc" || (t.OwnerUserID != nil && t.Kind != "monster")
		include := wantMonster[t.ID]
		if !include && isPC {
			if playerIDs != nil {
				include = wantPlayer[t.ID]
			} else {
				include = math.Hypot(t.X-cx, t.Y-cy) <= joinRadiusFt*k && !sightBlocked(scene, t.X, t.Y, cx, cy)
			}
		}
		if include {
			list = append(list, domain.VTTCombatant{TokenID: t.ID, Initiative: p.d20() + t.DexMod, IsPlayer: isPC})
		}
	}
	if len(list) == 0 {
		return nil, errors.New("no combatants for this encounter")
	}
	c := &domain.VTTCombat{SceneID: scene.ID, CampaignID: scene.CampaignID, CenterX: cx, CenterY: cy, TurnSeconds: 30}
	if err := p.repo.CreateCombat(ctx, c, list); err != nil {
		return nil, err
	}
	c.TurnStartedAt = time.Now()
	c.RemainingMs = c.TurnSeconds * 1000
	_ = p.repo.SaveCombatState(ctx, c)
	p.emit(ctx, scene.CampaignID, "vtt.combat.updated", map[string]any{"scene_id": scene.ID, "combat_id": c.ID, "started": true})
	return c, nil
}

// ---------- Combat turns ----------

func (p *VTTPlay) current(c *domain.VTTCombat) *domain.VTTCombatant {
	if c.TurnIndex < 0 || c.TurnIndex >= len(c.Combatants) {
		return nil
	}
	return &c.Combatants[c.TurnIndex]
}

// NextTurn advances the turn (timeout, player end-turn or GM), activates pending joiners on a new round,
// and ends the combat when every monster is down.
func (p *VTTPlay) NextTurn(ctx context.Context, c *domain.VTTCombat, reason string) error {
	if c.Status != "active" {
		return nil
	}
	if AdvanceTurn(c) {
		if n, _ := p.repo.ActivatePending(ctx, c.ID); n > 0 {
			reload, err := p.repo.Combat(ctx, c.CampaignID, c.ID)
			if err == nil {
				reload.Round, reload.TurnIndex = c.Round, 0
				*c = *reload
			}
		}
	}
	if p.monstersDown(ctx, c) {
		c.Status = "ended"
	}
	if cur := p.current(c); cur != nil {
		_ = p.repo.ResetMovement(ctx, cur.ID)
	}
	c.TurnStartedAt = time.Now()
	c.RemainingMs = c.TurnSeconds * 1000
	c.Paused = false
	if err := p.repo.SaveCombatState(ctx, c); err != nil {
		return err
	}
	p.emit(ctx, c.CampaignID, "vtt.combat.updated", map[string]any{"scene_id": c.SceneID, "combat_id": c.ID, "reason": reason})
	return nil
}

func (p *VTTPlay) monstersDown(ctx context.Context, c *domain.VTTCombat) bool {
	any := false
	for _, cb := range c.Combatants {
		if cb.IsPlayer {
			continue
		}
		t, err := p.repo.TokenByID(ctx, cb.TokenID)
		if err != nil {
			continue
		}
		any = true
		if t.MaxHP == 0 || t.HP > 0 {
			return false
		}
	}
	return any
}

// EndCombat closes a combat; participants return to exploration.
func (p *VTTPlay) EndCombat(ctx context.Context, c *domain.VTTCombat) error {
	c.Status = "ended"
	if err := p.repo.SaveCombatState(ctx, c); err != nil {
		return err
	}
	p.emit(ctx, c.CampaignID, "vtt.combat.updated", map[string]any{"scene_id": c.SceneID, "combat_id": c.ID, "ended": true})
	return nil
}

// RemainingMs returns the time left in the current player turn (0 for monster turns).
func RemainingMs(c *domain.VTTCombat, now time.Time) int {
	if c.Paused {
		return c.RemainingMs
	}
	return c.RemainingMs - int(now.Sub(c.TurnStartedAt).Milliseconds())
}

// PauseToggle pauses or resumes the turn timer.
func (p *VTTPlay) PauseToggle(ctx context.Context, c *domain.VTTCombat) error {
	now := time.Now()
	if c.Paused {
		c.Paused = false
		c.TurnStartedAt = now
	} else {
		c.RemainingMs = max(0, RemainingMs(c, now))
		c.Paused = true
	}
	if err := p.repo.SaveCombatState(ctx, c); err != nil {
		return err
	}
	p.emit(ctx, c.CampaignID, "vtt.combat.updated", map[string]any{"scene_id": c.SceneID, "combat_id": c.ID})
	return nil
}

// Extend adds 15 s to the current turn.
func (p *VTTPlay) Extend(ctx context.Context, c *domain.VTTCombat) error {
	c.RemainingMs += 15000
	if err := p.repo.SaveCombatState(ctx, c); err != nil {
		return err
	}
	p.emit(ctx, c.CampaignID, "vtt.combat.updated", map[string]any{"scene_id": c.SceneID, "combat_id": c.ID})
	return nil
}

// CombatMove moves the active combatant within its movement budget (vtt-modes.md §5).
func (p *VTTPlay) CombatMove(ctx context.Context, c *domain.VTTCombat, userID int64, isGM bool, tokenID int64, x, y float64, dash bool) (float64, float64, error) {
	cur := p.current(c)
	if cur == nil || cur.TokenID != tokenID {
		if !isGM {
			return 0, 0, ErrNotYourTurn
		}
	}
	token, err := p.repo.TokenByID(ctx, tokenID)
	if err != nil {
		return 0, 0, err
	}
	if !isGM && (token.OwnerUserID == nil || *token.OwnerUserID != userID) {
		return 0, 0, ErrNotYourTurn
	}
	scene, err := p.repo.SceneByID(ctx, token.SceneID)
	if err != nil {
		return 0, 0, err
	}
	nx, ny := SnapToGrid(x, y, scene.GridSizePx, scene.GridOffsetX, scene.GridOffsetY, token.SizeCells)
	cells := math.Max(math.Round(math.Abs(nx-token.X)/float64(scene.GridSizePx)), math.Round(math.Abs(ny-token.Y)/float64(scene.GridSizePx)))
	cost := int(cells) * scene.FeetPerCell
	if !isGM {
		if MovementBlocked(scene.Walls, token.X, token.Y, nx, ny) {
			return 0, 0, errors.New("movement blocked by a wall")
		}
		budget := token.SpeedFt
		if cur.Dashed || dash {
			budget *= 2
		}
		if cur.MovementUsedFt+cost > budget {
			return 0, 0, fmt.Errorf("%w (%d ft left)", ErrNoMovementLeft, max(0, budget-cur.MovementUsedFt))
		}
		if err := p.repo.UseMovement(ctx, cur.ID, cost, dash); err != nil {
			return 0, 0, err
		}
	}
	if err := p.repo.MoveToken(ctx, token.CampaignID, token.ID, nx, ny); err != nil {
		return 0, 0, err
	}
	p.emit(ctx, token.CampaignID, "vtt.token.moved", map[string]any{"scene_id": scene.ID, "token_id": token.ID, "x": nx, "y": ny})
	p.emit(ctx, token.CampaignID, "vtt.combat.updated", map[string]any{"scene_id": scene.ID, "combat_id": c.ID})
	return nx, ny, nil
}

// RunTimers advances player turns whose 30 s ran out. It blocks until ctx is done.
func (p *VTTPlay) RunTimers(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			p.flushPositions(ctx, now)
			combats, err := p.repo.AllActiveCombats(ctx)
			if err != nil {
				continue
			}
			for i := range combats {
				c := &combats[i]
				cur := p.current(c)
				if cur == nil || !cur.IsPlayer || c.Paused || RemainingMs(c, now) > 0 {
					continue
				}
				if err := p.NextTurn(ctx, c, "timeout"); err != nil {
					log.Printf("vtt play: timeout combat %d: %v", c.ID, err)
				}
			}
		}
	}
}

// flushPositions persists the last exploration position of tokens that stopped moving.
func (p *VTTPlay) flushPositions(ctx context.Context, now time.Time) {
	p.mu.Lock()
	pending := map[int64]trackedPos{}
	for id, t := range p.last {
		if t.at.After(t.savedAt) && now.Sub(t.at) > 500*time.Millisecond {
			pending[id] = t
		}
	}
	p.mu.Unlock()
	for id, t := range pending {
		if err := p.repo.TouchToken(ctx, id, t.x, t.y, now); err != nil {
			continue
		}
		p.mu.Lock()
		if cur, ok := p.last[id]; ok && cur.at.Equal(t.at) {
			cur.savedAt = now
			p.last[id] = cur
		}
		p.mu.Unlock()
	}
}

// ---------- Objects ----------

// InteractResult is shown to the player.
type InteractResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Roll    string `json:"roll,omitempty"`
	Loot    string `json:"loot,omitempty"`
	ShopID  int64  `json:"shop_id,omitempty"`
}

// Interact resolves a player interaction with an object (vtt-modes.md §3).
func (p *VTTPlay) Interact(ctx context.Context, userID, campaignID, objectID int64) (*InteractResult, error) {
	obj, err := p.repo.Object(ctx, campaignID, objectID)
	if err != nil {
		return nil, err
	}
	if obj.Depleted {
		return &InteractResult{Message: "Ya no queda nada aquí."}, nil
	}
	scene, err := p.repo.SceneByID(ctx, obj.SceneID)
	if err != nil {
		return nil, err
	}
	tokens, err := p.repo.ListTokens(ctx, scene.ID, true)
	if err != nil {
		return nil, err
	}
	var token *domain.VTTToken
	reach := float64(scene.GridSizePx) * 1.5
	for i := range tokens {
		t := &tokens[i]
		if t.OwnerUserID != nil && *t.OwnerUserID == userID && t.CharacterID != nil && math.Hypot(t.X-obj.X, t.Y-obj.Y) <= reach {
			token = t
			break
		}
	}
	if token == nil {
		return nil, ErrTooFar
	}
	// A shop counter opens its shop (market-bastions.md §3).
	if shopID, err := p.repo.ShopForObject(ctx, obj.ID); err == nil && shopID != 0 {
		return &InteractResult{Success: true, Message: "Abres la tienda.", ShopID: shopID}, nil
	}
	prof, err := p.repo.CharacterProfile(ctx, *token.CharacterID)
	if err != nil {
		return nil, err
	}
	if obj.DiscoverDC > 0 && prof.Passive < obj.DiscoverDC {
		return nil, ErrTooFar // undiscovered objects do not exist for this character
	}
	var req Requirements
	if b, err := json.Marshal(obj.Requirements); err == nil {
		_ = json.Unmarshal(b, &req)
	}
	fail := func(msg, roll string) (*InteractResult, error) {
		res := &InteractResult{Message: msg, Roll: roll}
		if err := p.repo.RecordAttempt(ctx, obj.ID, prof.ID, false, msg+" "+roll, nil, false); err != nil {
			return nil, err
		}
		p.emit(ctx, campaignID, "vtt.object.updated", map[string]any{"scene_id": scene.ID, "object_id": obj.ID, "character_id": prof.ID, "success": false})
		return res, nil
	}
	if len(req.Milestones) > 0 {
		ms, err := p.repo.Milestones(ctx, campaignID)
		if err != nil {
			return nil, err
		}
		done := map[int64]bool{}
		for _, m := range ms {
			done[m.ID] = m.Achieved
		}
		for _, id := range req.Milestones {
			if !done[id] {
				return &InteractResult{Message: "Todavía no sabes cómo aprovechar esto."}, nil // not an attempt: retry once the milestone is met
			}
		}
	}
	items, _ := p.repo.CharacterItemNames(ctx, prof.ID)
	if ok, _ := ConditionsMet(req.Conditions, prof.Class, prof.Race, prof.Passive, items); !ok {
		return fail("No consigues nada.", "")
	}
	rollText := ""
	if req.Check != nil && req.Check.DC > 0 {
		d := p.d20()
		mod := SkillModifier(req.Check.Skill, prof.Str, prof.Dex, prof.Con, prof.Int, prof.Wis, prof.Cha) + req.Check.Bonus
		total := d + mod
		rollText = fmt.Sprintf("%s: d20 (%d) %+d = %d contra CD %d", req.Check.Skill, d, mod, total, req.Check.DC)
		if total < req.Check.DC {
			return fail("Fallas la prueba.", rollText)
		}
	}
	grant := &repository.LootGrant{}
	var given []LootEntry
	var loot struct {
		Gold    int         `json:"gold"`
		Items   []LootEntry `json:"items"`
		Entries []LootEntry `json:"entries"`
	}
	if b, err := json.Marshal(obj.Loot); err == nil {
		_ = json.Unmarshal(b, &loot)
	}
	if obj.LootKind == "table" {
		p.mu.Lock()
		e, ok := RollLootTable(loot.Entries, p.rnd)
		p.mu.Unlock()
		if ok {
			given = []LootEntry{e}
			grant.Gold = e.Gold
		}
	} else {
		given = loot.Items
		grant.Gold = loot.Gold
	}
	for _, g := range given {
		if g.Name != "" {
			grant.Items = append(grant.Items, repository.LootItem{Name: g.Name, Qty: max(1, g.Qty)})
		}
	}
	desc := DescribeLoot(grant.Gold, given)
	if err := p.repo.RecordAttempt(ctx, obj.ID, prof.ID, true, desc, grant, !obj.PerCharacter); err != nil {
		return nil, err
	}
	p.emit(ctx, campaignID, "vtt.object.updated", map[string]any{"scene_id": scene.ID, "object_id": obj.ID, "character_id": prof.ID, "success": true, "loot": desc})
	return &InteractResult{Success: true, Message: "Lo consigues.", Roll: rollText, Loot: desc}, nil
}
