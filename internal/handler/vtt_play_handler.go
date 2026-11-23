package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// Routes of openspec/specs/vtt-modes.md §7.
func (h *VTTHandler) registerPlayRoutes(g *gin.RouterGroup) {
	g.GET("/campaigns/:id/milestones", h.ListMilestones)
	g.POST("/campaigns/:id/milestones", h.CreateMilestone)
	g.PUT("/campaigns/:id/milestones/:milestone_id", h.UpdateMilestone)
	g.GET("/campaigns/:id/vtt/scenes/:scene_id/objects", h.ListObjects)
	g.POST("/campaigns/:id/vtt/scenes/:scene_id/objects", h.SaveObject)
	g.PUT("/campaigns/:id/vtt/objects/:object_id", h.SaveObject)
	g.DELETE("/campaigns/:id/vtt/objects/:object_id", h.DeleteObject)
	g.POST("/campaigns/:id/vtt/objects/:object_id/interact", h.Interact)
	g.POST("/campaigns/:id/vtt/objects/:object_id/reset", h.ResetObject)
	g.GET("/campaigns/:id/vtt/scenes/:scene_id/combats", h.ListCombats)
	g.POST("/campaigns/:id/vtt/scenes/:scene_id/combats", h.StartCombat)
	g.POST("/campaigns/:id/vtt/combats/:combat_id/:action", h.CombatAction)
	g.PUT("/campaigns/:id/vtt/combats/:combat_id/move", h.CombatMove)
	g.PUT("/campaigns/:id/vtt/tokens/:token_id/sneak", h.Sneak)
}

func (h *VTTHandler) sceneTokenIDs(c *gin.Context, sceneID int64) (monsters, players []int64) {
	tokens, err := h.repo.ListTokens(c.Request.Context(), sceneID, false)
	if err != nil {
		return nil, nil
	}
	players = []int64{}
	for _, t := range tokens {
		if t.Kind == "pc" || (t.OwnerUserID != nil && t.Kind != "monster") {
			players = append(players, t.ID)
		} else {
			monsters = append(monsters, t.ID)
		}
	}
	return monsters, players
}

// ---------- Milestones ----------

func (h *VTTHandler) ListMilestones(c *gin.Context) {
	ms, err := h.repo.Milestones(c.Request.Context(), parseID(c.Param("id")))
	if err != nil {
		h.fail(c, err, "could not list milestones")
		return
	}
	c.JSON(http.StatusOK, ms)
}

func (h *VTTHandler) CreateMilestone(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	var in struct {
		Name     string `json:"name"`
		Achieved bool   `json:"achieved"`
	}
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Name) == "" || len(in.Name) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required (max 200 characters)"})
		return
	}
	m := domain.Milestone{CampaignID: parseID(c.Param("id")), Name: strings.TrimSpace(in.Name), Achieved: in.Achieved}
	if err := h.repo.CreateMilestone(c.Request.Context(), &m); err != nil {
		h.fail(c, err, "could not create milestone")
		return
	}
	c.JSON(http.StatusCreated, m)
}

func (h *VTTHandler) UpdateMilestone(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	var in struct {
		Name     string `json:"name"`
		Achieved bool   `json:"achieved"`
	}
	if c.ShouldBindJSON(&in) != nil || strings.TrimSpace(in.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	m := domain.Milestone{ID: parseID(c.Param("milestone_id")), CampaignID: parseID(c.Param("id")), Name: strings.TrimSpace(in.Name), Achieved: in.Achieved}
	if err := h.repo.UpdateMilestone(c.Request.Context(), &m); err != nil {
		h.fail(c, err, "could not update milestone")
		return
	}
	h.publish(c, m.CampaignID, "vtt.object.updated", gin.H{"milestone_id": m.ID})
	c.JSON(http.StatusOK, m)
}

// ---------- Objects ----------

// playerObjectView hides requirements and loot; only the explicit check is shown (vtt-modes.md §3).
func playerObjectView(o domain.VTTObject) gin.H {
	view := gin.H{"id": o.ID, "scene_id": o.SceneID, "name": o.Name, "icon": o.Icon, "x": o.X, "y": o.Y, "depleted": o.Depleted, "attempted": o.Attempted}
	if chk, ok := o.Requirements["check"].(map[string]any); ok {
		view["check"] = gin.H{"skill": chk["skill"], "dc": chk["dc"]}
	}
	return view
}

func (h *VTTHandler) ListObjects(c *gin.Context) {
	ctx := c.Request.Context()
	campaignID, sceneID := parseID(c.Param("id")), parseID(c.Param("scene_id"))
	scene, err := h.repo.GetScene(ctx, campaignID, sceneID)
	if err != nil {
		h.fail(c, err, "could not load scene")
		return
	}
	objs, err := h.repo.Objects(ctx, sceneID)
	if err != nil {
		h.fail(c, err, "could not list objects")
		return
	}
	if middleware.IsGM(c) {
		c.JSON(http.StatusOK, objs)
		return
	}
	if !scene.IsActive || scene.Mode == "narrative" {
		c.JSON(http.StatusOK, []gin.H{})
		return
	}
	// Discovery by passive Perception of the player's own characters on the scene.
	tokens, _ := h.repo.ListTokens(ctx, sceneID, false)
	userID, best := middleware.GetUserID(c), 0
	charIDs := []int64{}
	for _, t := range tokens {
		if t.OwnerUserID != nil && *t.OwnerUserID == userID && t.CharacterID != nil {
			charIDs = append(charIDs, *t.CharacterID)
			if prof, err := h.repo.CharacterProfile(ctx, *t.CharacterID); err == nil && prof.Passive > best {
				best = prof.Passive
			}
		}
	}
	tried, _ := h.repo.AttemptedObjects(ctx, sceneID, charIDs)
	out := []gin.H{}
	for _, o := range objs {
		if o.DiscoverDC > 0 && best < o.DiscoverDC {
			continue
		}
		o.Attempted = tried[o.ID]
		out = append(out, playerObjectView(o))
	}
	c.JSON(http.StatusOK, out)
}

func (h *VTTHandler) SaveObject(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	obj := &domain.VTTObject{CampaignID: campaignID, Icon: "inventory_2", LootKind: "fixed", Requirements: domain.JSONMap{}, Loot: domain.JSONMap{}}
	if id := parseID(c.Param("object_id")); id > 0 {
		existing, err := h.repo.Object(ctx, campaignID, id)
		if err != nil {
			h.fail(c, err, "could not load object")
			return
		}
		obj = existing
	} else {
		scene, err := h.repo.GetScene(ctx, campaignID, parseID(c.Param("scene_id")))
		if err != nil {
			h.fail(c, err, "could not load scene")
			return
		}
		obj.SceneID = scene.ID
	}
	var in struct {
		Name         *string         `json:"name"`
		Icon         *string         `json:"icon"`
		X            *float64        `json:"x"`
		Y            *float64        `json:"y"`
		DiscoverDC   *int            `json:"discover_dc"`
		Requirements *domain.JSONMap `json:"requirements"`
		LootKind     *string         `json:"loot_kind"`
		Loot         *domain.JSONMap `json:"loot"`
		PerCharacter *bool           `json:"per_character"`
		Depleted     *bool           `json:"depleted"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if in.Name != nil {
		obj.Name = strings.TrimSpace(*in.Name)
	}
	if in.Icon != nil {
		obj.Icon = *in.Icon
	}
	if in.X != nil {
		obj.X = *in.X
	}
	if in.Y != nil {
		obj.Y = *in.Y
	}
	if in.DiscoverDC != nil {
		obj.DiscoverDC = *in.DiscoverDC
	}
	if in.Requirements != nil {
		obj.Requirements = *in.Requirements
	}
	if in.LootKind != nil {
		obj.LootKind = *in.LootKind
	}
	if in.Loot != nil {
		obj.Loot = *in.Loot
	}
	if in.PerCharacter != nil {
		obj.PerCharacter = *in.PerCharacter
	}
	if in.Depleted != nil {
		obj.Depleted = *in.Depleted
	}
	if obj.Name == "" || len(obj.Name) > 200 || (obj.LootKind != "fixed" && obj.LootKind != "table") || obj.DiscoverDC < 0 || obj.DiscoverDC > 40 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid object: name, loot_kind (fixed|table) and discover_dc 0–40 are required"})
		return
	}
	created := obj.ID == 0
	if err := h.repo.SaveObject(ctx, obj); err != nil {
		h.fail(c, err, "could not save object")
		return
	}
	h.publish(c, campaignID, "vtt.object.updated", gin.H{"scene_id": obj.SceneID})
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	c.JSON(status, obj)
}

func (h *VTTHandler) DeleteObject(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	campaignID := parseID(c.Param("id"))
	sceneID, err := h.repo.DeleteObject(c.Request.Context(), campaignID, parseID(c.Param("object_id")))
	if err != nil {
		h.fail(c, err, "could not delete object")
		return
	}
	h.publish(c, campaignID, "vtt.object.updated", gin.H{"scene_id": sceneID})
	c.Status(http.StatusNoContent)
}

func (h *VTTHandler) ResetObject(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	campaignID := parseID(c.Param("id"))
	objectID := parseID(c.Param("object_id"))
	sceneID, err := h.repo.ResetObject(c.Request.Context(), campaignID, objectID)
	if err != nil {
		h.fail(c, err, "could not reset object")
		return
	}
	h.publish(c, campaignID, "vtt.object.updated", gin.H{"scene_id": sceneID, "object_id": objectID})
	c.Status(http.StatusNoContent)
}

func (h *VTTHandler) Interact(c *gin.Context) {
	res, err := h.play.Interact(c.Request.Context(), middleware.GetUserID(c), parseID(c.Param("id")), parseID(c.Param("object_id")))
	switch {
	case errors.Is(err, service.ErrTooFar):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Acércate al objeto (a 5 pies) con tu personaje."})
	case errors.Is(err, repository.ErrAlreadyAttempted):
		c.JSON(http.StatusConflict, gin.H{"error": "Tu personaje ya lo intentó."})
	case err != nil:
		h.fail(c, err, "could not interact")
	default:
		c.JSON(http.StatusOK, res)
	}
}

// ---------- Combats ----------

type combatView struct {
	domain.VTTCombat
	RemainingMs int `json:"remaining_ms"`
}

func (h *VTTHandler) ListCombats(c *gin.Context) {
	ctx := c.Request.Context()
	scene, err := h.repo.GetScene(ctx, parseID(c.Param("id")), parseID(c.Param("scene_id")))
	if err != nil {
		h.fail(c, err, "could not load scene")
		return
	}
	combats, err := h.repo.ActiveCombats(ctx, scene.ID)
	if err != nil {
		h.fail(c, err, "could not list combats")
		return
	}
	now := time.Now()
	gm := middleware.IsGM(c)
	out := make([]combatView, 0, len(combats))
	for _, cb := range combats {
		if !gm {
			maskHiddenCombatants(&cb)
		}
		out = append(out, combatView{VTTCombat: cb, RemainingMs: max(0, service.RemainingMs(&cb, now))})
	}
	c.JSON(http.StatusOK, out)
}

// hiddenCombatantName is what players see for a combatant whose token the GM keeps hidden.
const hiddenCombatantName = "Criatura oculta"

// maskHiddenCombatants hides the name and token of hidden combatants from players. The rows stay
// so turn_index still points at the right combatant.
func maskHiddenCombatants(combat *domain.VTTCombat) {
	masked := make([]domain.VTTCombatant, len(combat.Combatants))
	for i, cb := range combat.Combatants {
		if cb.Hidden {
			cb.Name = hiddenCombatantName
			cb.TokenID = 0
		}
		masked[i] = cb
	}
	combat.Combatants = masked
}

func (h *VTTHandler) StartCombat(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	ctx := c.Request.Context()
	scene, err := h.repo.GetScene(ctx, parseID(c.Param("id")), parseID(c.Param("scene_id")))
	if err != nil {
		h.fail(c, err, "could not load scene")
		return
	}
	var in struct {
		TokenIDs []int64 `json:"token_ids"`
	}
	if c.ShouldBindJSON(&in) != nil || len(in.TokenIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token_ids is required"})
		return
	}
	var monsters, players []int64
	var cx, cy float64
	for _, id := range in.TokenIDs {
		t, err := h.repo.GetToken(ctx, scene.CampaignID, id)
		if err != nil || t.SceneID != scene.ID {
			continue
		}
		cx, cy = cx+t.X, cy+t.Y
		if t.Kind == "pc" || (t.OwnerUserID != nil && t.Kind != "monster") {
			players = append(players, t.ID)
		} else {
			monsters = append(monsters, t.ID)
		}
	}
	n := float64(len(monsters) + len(players))
	if n == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no valid tokens"})
		return
	}
	if players == nil {
		players = []int64{}
	}
	combat, err := h.play.StartEncounter(ctx, scene, cx/n, cy/n, monsters, players)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, combat)
}

func (h *VTTHandler) loadCombat(c *gin.Context) (*domain.VTTCombat, bool) {
	combat, err := h.repo.Combat(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("combat_id")))
	if err != nil {
		h.fail(c, err, "could not load combat")
		return nil, false
	}
	if combat.Status != "active" {
		c.JSON(http.StatusConflict, gin.H{"error": "combat already ended"})
		return nil, false
	}
	return combat, true
}

// isActivePlayer reports whether the caller owns the token whose turn it is.
func (h *VTTHandler) isActivePlayer(c *gin.Context, combat *domain.VTTCombat) bool {
	if combat.TurnIndex >= len(combat.Combatants) {
		return false
	}
	t, err := h.repo.GetToken(c.Request.Context(), combat.CampaignID, combat.Combatants[combat.TurnIndex].TokenID)
	return err == nil && t.OwnerUserID != nil && *t.OwnerUserID == middleware.GetUserID(c)
}

func (h *VTTHandler) CombatAction(c *gin.Context) {
	combat, ok := h.loadCombat(c)
	if !ok {
		return
	}
	ctx, gm, action := c.Request.Context(), middleware.IsGM(c), c.Param("action")
	var err error
	switch action {
	case "next":
		if !gm && !h.isActivePlayer(c, combat) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not your turn"})
			return
		}
		err = h.play.NextTurn(ctx, combat, "manual")
	case "dash":
		if !gm && !h.isActivePlayer(c, combat) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not your turn"})
			return
		}
		err = h.repo.UseMovement(ctx, combat.Combatants[combat.TurnIndex].ID, 0, true)
		h.publish(c, combat.CampaignID, "vtt.combat.updated", gin.H{"scene_id": combat.SceneID, "combat_id": combat.ID})
	case "end", "pause", "extend":
		if !requireGM(c) {
			return
		}
		switch action {
		case "end":
			err = h.play.EndCombat(ctx, combat)
		case "pause":
			err = h.play.PauseToggle(ctx, combat)
		default:
			err = h.play.Extend(ctx, combat)
		}
	default:
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown action"})
		return
	}
	if err != nil {
		h.fail(c, err, "could not update combat")
		return
	}
	c.JSON(http.StatusOK, gin.H{"combat_id": combat.ID, "status": combat.Status, "round": combat.Round, "turn_index": combat.TurnIndex})
}

func (h *VTTHandler) CombatMove(c *gin.Context) {
	combat, ok := h.loadCombat(c)
	if !ok {
		return
	}
	var in struct {
		TokenID int64   `json:"token_id"`
		X       float64 `json:"x"`
		Y       float64 `json:"y"`
		Dash    bool    `json:"dash"`
	}
	if c.ShouldBindJSON(&in) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	x, y, err := h.play.CombatMove(c.Request.Context(), combat, middleware.GetUserID(c), middleware.IsGM(c), in.TokenID, in.X, in.Y, in.Dash)
	switch {
	case errors.Is(err, service.ErrNotYourTurn):
		c.JSON(http.StatusForbidden, gin.H{"error": "No es tu turno."})
	case errors.Is(err, service.ErrNoMovementLeft), err != nil && strings.Contains(err.Error(), "wall"):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
	case err != nil:
		h.fail(c, err, "could not move")
	default:
		c.JSON(http.StatusOK, gin.H{"x": x, "y": y})
	}
}

func (h *VTTHandler) Sneak(c *gin.Context) {
	ctx := c.Request.Context()
	token, err := h.repo.GetToken(ctx, parseID(c.Param("id")), parseID(c.Param("token_id")))
	if err != nil {
		h.fail(c, err, "could not load token")
		return
	}
	if !middleware.IsGM(c) && (token.OwnerUserID == nil || *token.OwnerUserID != middleware.GetUserID(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not your token"})
		return
	}
	var in struct {
		On bool `json:"on"`
	}
	_ = c.ShouldBindJSON(&in)
	if err := h.repo.SetSneaking(ctx, token.ID, in.On); err != nil {
		h.fail(c, err, "could not update token")
		return
	}
	h.publish(c, token.CampaignID, "vtt.scene.updated", gin.H{"scene_id": token.SceneID})
	c.JSON(http.StatusOK, gin.H{"id": token.ID, "sneaking": in.On})
}
