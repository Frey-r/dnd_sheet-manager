package handler

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// EventPublisher fans out campaign events (implemented by realtime.Hub).
type EventPublisher interface {
	Publish(ctx context.Context, campaignID, userID int64, eventType string, payload any) error
}

// VTTHandler serves the native virtual tabletop. See openspec/specs/vtt.md.
type VTTHandler struct {
	repo   *repository.VTTRepository
	events EventPublisher
	play   *service.VTTPlay
}

func NewVTTHandler(repo *repository.VTTRepository, events EventPublisher, play *service.VTTPlay) *VTTHandler {
	return &VTTHandler{repo: repo, events: events, play: play}
}

func (h *VTTHandler) RegisterRoutes(g *gin.RouterGroup) {
	g.GET("/campaigns/:id/vtt/scenes", h.ListScenes)
	g.POST("/campaigns/:id/vtt/scenes", h.CreateScene)
	g.GET("/campaigns/:id/vtt/active", h.Active)
	g.GET("/campaigns/:id/vtt/scenes/:scene_id", h.GetScene)
	g.PUT("/campaigns/:id/vtt/scenes/:scene_id", h.UpdateScene)
	g.DELETE("/campaigns/:id/vtt/scenes/:scene_id", h.DeleteScene)
	g.POST("/campaigns/:id/vtt/scenes/:scene_id/activate", h.Activate)
	g.POST("/campaigns/:id/vtt/scenes/:scene_id/tokens", h.CreateToken)
	g.PUT("/campaigns/:id/vtt/tokens/:token_id", h.UpdateToken)
	g.PUT("/campaigns/:id/vtt/tokens/:token_id/move", h.MoveToken)
	g.DELETE("/campaigns/:id/vtt/tokens/:token_id", h.DeleteToken)
	h.registerPlayRoutes(g)
}

func requireGM(c *gin.Context) bool {
	if middleware.IsGM(c) {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
	return false
}

func (h *VTTHandler) fail(c *gin.Context, err error, msg string) {
	if errors.Is(err, repository.ErrVTTNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	log.Printf("vtt: %s: %v", msg, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
}

func (h *VTTHandler) publish(c *gin.Context, campaignID int64, event string, payload any) {
	if h.events == nil {
		return
	}
	if err := h.events.Publish(c.Request.Context(), campaignID, middleware.GetUserID(c), event, payload); err != nil {
		log.Printf("vtt: publish %s: %v", event, err)
	}
}

// withTokens loads the scene's tokens, hiding GM-only ones from players and
// mirroring linked characters' HP.
func (h *VTTHandler) withTokens(c *gin.Context, scene *domain.VTTScene) error {
	if scene.Mode == "narrative" && !middleware.IsGM(c) {
		scene.Tokens, scene.Walls, scene.Zones = []domain.VTTToken{}, domain.Walls{}, domain.Zones{}
		return nil
	}
	if !middleware.IsGM(c) {
		scene.Zones = domain.Zones{} // encounter zones are GM-only
	}
	tokens, err := h.repo.ListTokens(c.Request.Context(), scene.ID, middleware.IsGM(c))
	if err != nil {
		return err
	}
	hp, err := h.repo.CharacterHP(c.Request.Context(), scene.CampaignID)
	if err != nil {
		return err
	}
	for i := range tokens {
		if tokens[i].CharacterID != nil {
			if v, ok := hp[*tokens[i].CharacterID]; ok {
				tokens[i].HP, tokens[i].MaxHP = v[0], v[1]
			}
		}
	}
	scene.Tokens = tokens
	return nil
}

func (h *VTTHandler) ListScenes(c *gin.Context) {
	scenes, err := h.repo.ListScenes(c.Request.Context(), parseID(c.Param("id")), !middleware.IsGM(c))
	if err != nil {
		h.fail(c, err, "could not list scenes")
		return
	}
	c.JSON(http.StatusOK, scenes)
}

func (h *VTTHandler) Active(c *gin.Context) {
	scene, err := h.repo.ActiveScene(c.Request.Context(), parseID(c.Param("id")))
	if errors.Is(err, repository.ErrVTTNotFound) {
		c.JSON(http.StatusOK, gin.H{"scene": nil})
		return
	}
	if err != nil {
		h.fail(c, err, "could not load active scene")
		return
	}
	if err := h.withTokens(c, scene); err != nil {
		h.fail(c, err, "could not load tokens")
		return
	}
	c.JSON(http.StatusOK, gin.H{"scene": scene})
}

func (h *VTTHandler) GetScene(c *gin.Context) {
	scene, err := h.repo.GetScene(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("scene_id")))
	if err != nil {
		h.fail(c, err, "could not load scene")
		return
	}
	if !scene.IsActive && !middleware.IsGM(c) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if err := h.withTokens(c, scene); err != nil {
		h.fail(c, err, "could not load tokens")
		return
	}
	c.JSON(http.StatusOK, scene)
}

type sceneInput struct {
	Name         *string             `json:"name"`
	MapURL       *string             `json:"map_url"`
	WidthPx      *int                `json:"width_px"`
	HeightPx     *int                `json:"height_px"`
	GridSizePx   *int                `json:"grid_size_px"`
	GridOffsetX  *int                `json:"grid_offset_x"`
	GridOffsetY  *int                `json:"grid_offset_y"`
	FeetPerCell  *int                `json:"feet_per_cell"`
	AmbientLight *string             `json:"ambient_light"`
	FogEnabled   *bool               `json:"fog_enabled"`
	Walls        *domain.Walls       `json:"walls"`
	Lights       *domain.SceneLights `json:"lights"`
	Mode         *string             `json:"mode"`
	Pace         *float64            `json:"exploration_pace"`
	Zones        *domain.Zones       `json:"zones"`
}

func (in sceneInput) apply(s *domain.VTTScene) error {
	if in.Name != nil {
		s.Name = strings.TrimSpace(*in.Name)
	}
	if in.MapURL != nil {
		s.MapURL = strings.TrimSpace(*in.MapURL)
	}
	set := func(dst *int, v *int) {
		if v != nil {
			*dst = *v
		}
	}
	set(&s.WidthPx, in.WidthPx)
	set(&s.HeightPx, in.HeightPx)
	set(&s.GridSizePx, in.GridSizePx)
	set(&s.GridOffsetX, in.GridOffsetX)
	set(&s.GridOffsetY, in.GridOffsetY)
	set(&s.FeetPerCell, in.FeetPerCell)
	if in.AmbientLight != nil {
		s.AmbientLight = *in.AmbientLight
	}
	if in.FogEnabled != nil {
		s.FogEnabled = *in.FogEnabled
	}
	if in.Walls != nil {
		s.Walls = *in.Walls
	}
	if in.Lights != nil {
		s.Lights = *in.Lights
	}
	if in.Mode != nil {
		s.Mode = *in.Mode
	}
	if in.Pace != nil {
		s.Pace = *in.Pace
	}
	if in.Zones != nil {
		s.Zones = *in.Zones
	}
	switch {
	case s.Mode != "narrative" && s.Mode != "exploration" && s.Mode != "combat":
		return errors.New("mode must be narrative, exploration or combat")
	case s.Pace < 1 || s.Pace > 4:
		return errors.New("exploration_pace must be between 1 and 4")
	case len(s.Zones) > 200:
		return errors.New("too many zones")
	case s.Name == "" || len(s.Name) > 200:
		return errors.New("name is required (max 200 characters)")
	case s.GridSizePx < 10 || s.GridSizePx > 400:
		return errors.New("grid_size_px must be between 10 and 400")
	case s.WidthPx < 100 || s.HeightPx < 100 || s.WidthPx > 20000 || s.HeightPx > 20000:
		return errors.New("scene size must be between 100 and 20000 px")
	case s.FeetPerCell < 1:
		return errors.New("feet_per_cell must be positive")
	case s.AmbientLight != "bright" && s.AmbientLight != "dim" && s.AmbientLight != "dark":
		return errors.New("ambient_light must be bright, dim or dark")
	case len(s.Walls) > 5000 || len(s.Lights) > 500:
		return errors.New("too many walls or lights")
	}
	return nil
}

func (h *VTTHandler) CreateScene(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	var in sceneInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	scene := domain.VTTScene{CampaignID: parseID(c.Param("id")), WidthPx: 1400, HeightPx: 1000, GridSizePx: 70, FeetPerCell: 5, AmbientLight: "bright", FogEnabled: true, Walls: domain.Walls{}, Lights: domain.SceneLights{}, Mode: "exploration", Pace: 2, Zones: domain.Zones{}}
	if err := in.apply(&scene); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.CreateScene(c.Request.Context(), &scene); err != nil {
		h.fail(c, err, "could not create scene")
		return
	}
	c.JSON(http.StatusCreated, scene)
}

func (h *VTTHandler) UpdateScene(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	campaignID := parseID(c.Param("id"))
	scene, err := h.repo.GetScene(c.Request.Context(), campaignID, parseID(c.Param("scene_id")))
	if err != nil {
		h.fail(c, err, "could not load scene")
		return
	}
	var in sceneInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if err := in.apply(scene); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.UpdateScene(c.Request.Context(), scene); err != nil {
		h.fail(c, err, "could not update scene")
		return
	}
	if in.Mode != nil && scene.Mode == "combat" && scene.IsActive {
		if combats, err := h.repo.ActiveCombats(c.Request.Context(), scene.ID); err == nil && len(combats) == 0 {
			monsters, players := h.sceneTokenIDs(c, scene.ID)
			if _, err := h.play.StartEncounter(c.Request.Context(), scene, float64(scene.WidthPx)/2, float64(scene.HeightPx)/2, monsters, players); err != nil {
				log.Printf("vtt: whole-scene combat: %v", err)
			}
		}
	}
	h.publish(c, campaignID, "vtt.scene.updated", gin.H{"scene_id": scene.ID})
	c.JSON(http.StatusOK, scene)
}

func (h *VTTHandler) DeleteScene(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	campaignID, sceneID := parseID(c.Param("id")), parseID(c.Param("scene_id"))
	if err := h.repo.DeleteScene(c.Request.Context(), campaignID, sceneID); err != nil {
		h.fail(c, err, "could not delete scene")
		return
	}
	h.publish(c, campaignID, "vtt.scene.updated", gin.H{"scene_id": sceneID})
	c.Status(http.StatusNoContent)
}

func (h *VTTHandler) Activate(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	campaignID, sceneID := parseID(c.Param("id")), parseID(c.Param("scene_id"))
	if err := h.repo.ActivateScene(c.Request.Context(), campaignID, sceneID); err != nil {
		h.fail(c, err, "could not activate scene")
		return
	}
	h.publish(c, campaignID, "vtt.scene.activated", gin.H{"scene_id": sceneID})
	c.JSON(http.StatusOK, gin.H{"scene_id": sceneID, "is_active": true})
}

type tokenInput struct {
	Name          *string  `json:"name"`
	Kind          *string  `json:"kind"`
	CharacterID   *int64   `json:"character_id"`
	MonsterID     *int64   `json:"monster_id"`
	OwnerUserID   *int64   `json:"owner_user_id"`
	ClearOwner    bool     `json:"clear_owner"`
	ImageURL      *string  `json:"image_url"`
	Color         *string  `json:"color"`
	X             *float64 `json:"x"`
	Y             *float64 `json:"y"`
	SizeCells     *float64 `json:"size_cells"`
	HP            *int     `json:"hp"`
	MaxHP         *int     `json:"max_hp"`
	AC            *int     `json:"ac"`
	Hidden        *bool    `json:"hidden"`
	VisionFt      *int     `json:"vision_ft"`
	DarkvisionFt  *int     `json:"darkvision_ft"`
	BlindsightFt  *int     `json:"blindsight_ft"`
	LightBrightFt *int     `json:"light_bright_ft"`
	LightDimFt    *int     `json:"light_dim_ft"`
	SpeedFt       *int     `json:"speed_ft"`
	PassivePerc   *int     `json:"passive_perception"`
	StealthBonus  *int     `json:"stealth_bonus"`
	DexMod        *int     `json:"dex_mod"`
	Detects       *bool    `json:"detects"`
}

var monsterSizeCells = map[string]float64{"tiny": 0.5, "small": 1, "medium": 1, "large": 2, "huge": 3, "gargantuan": 4}

func (in tokenInput) apply(t *domain.VTTToken) error {
	if in.Name != nil {
		t.Name = strings.TrimSpace(*in.Name)
	}
	if in.Kind != nil {
		t.Kind = *in.Kind
	}
	if in.OwnerUserID != nil {
		t.OwnerUserID = in.OwnerUserID
	}
	if in.ClearOwner {
		t.OwnerUserID = nil
	}
	if in.ImageURL != nil {
		t.ImageURL = strings.TrimSpace(*in.ImageURL)
	}
	if in.Color != nil {
		t.Color = *in.Color
	}
	setF := func(dst *float64, v *float64) {
		if v != nil {
			*dst = *v
		}
	}
	setI := func(dst *int, v *int) {
		if v != nil {
			*dst = *v
		}
	}
	setF(&t.X, in.X)
	setF(&t.Y, in.Y)
	setF(&t.SizeCells, in.SizeCells)
	setI(&t.HP, in.HP)
	setI(&t.MaxHP, in.MaxHP)
	setI(&t.AC, in.AC)
	setI(&t.VisionFt, in.VisionFt)
	setI(&t.DarkvisionFt, in.DarkvisionFt)
	setI(&t.BlindsightFt, in.BlindsightFt)
	setI(&t.LightBrightFt, in.LightBrightFt)
	setI(&t.LightDimFt, in.LightDimFt)
	setI(&t.SpeedFt, in.SpeedFt)
	setI(&t.PassivePerc, in.PassivePerc)
	setI(&t.StealthBonus, in.StealthBonus)
	setI(&t.DexMod, in.DexMod)
	if in.Detects != nil {
		t.Detects = *in.Detects
	}
	if in.Hidden != nil {
		t.Hidden = *in.Hidden
	}
	switch {
	case t.Name == "" || len(t.Name) > 200:
		return errors.New("name is required (max 200 characters)")
	case t.Kind != "pc" && t.Kind != "npc" && t.Kind != "monster":
		return errors.New("kind must be pc, npc or monster")
	case t.SizeCells <= 0 || t.SizeCells > 10:
		return errors.New("size_cells must be between 0 and 10")
	case t.VisionFt < 0 || t.DarkvisionFt < 0 || t.BlindsightFt < 0 || t.LightBrightFt < 0 || t.LightDimFt < 0:
		return errors.New("vision and light ranges cannot be negative")
	}
	return nil
}

func (h *VTTHandler) CreateToken(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	scene, err := h.repo.GetScene(ctx, campaignID, parseID(c.Param("scene_id")))
	if err != nil {
		h.fail(c, err, "could not load scene")
		return
	}
	var in tokenInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	token := domain.VTTToken{SceneID: scene.ID, CampaignID: campaignID, Kind: "monster", Color: "#c0392b", SizeCells: 1, AC: 10, SpeedFt: 30, PassivePerc: 10,
		X: float64(scene.GridSizePx) * 1.5, Y: float64(scene.GridSizePx) * 1.5}
	if in.CharacterID != nil {
		owner, race, err := h.repo.CharacterOwner(ctx, campaignID, *in.CharacterID)
		if err != nil {
			h.fail(c, err, "could not load character")
			return
		}
		token.CharacterID, token.OwnerUserID, token.Kind, token.Color = in.CharacterID, &owner, "pc", "#2fa597"
		token.DarkvisionFt = service.DarkvisionForRace(race)
		if prof, err := h.repo.CharacterProfile(ctx, *in.CharacterID); err == nil {
			token.SpeedFt, token.PassivePerc, token.DexMod = prof.Speed, prof.Passive, service.AbilityMod(prof.Dex)
		}
	}
	if in.MonsterID != nil {
		m, err := h.repo.Monster(ctx, *in.MonsterID)
		if err != nil {
			h.fail(c, err, "could not load monster")
			return
		}
		token.Name, token.HP, token.MaxHP, token.AC = m.Name, m.HP, m.HP, m.AC
		token.DarkvisionFt, token.BlindsightFt = service.ParseSenses(m.Senses)
		token.PassivePerc, token.SpeedFt, token.DexMod = service.ParsePassivePerception(m.Senses), service.ParseWalkSpeed(m.Speed), service.AbilityMod(m.Dex)
		token.Detects = true
		if size, ok := monsterSizeCells[strings.ToLower(m.Size)]; ok {
			token.SizeCells = size
		}
	}
	if err := in.apply(&token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	token.X, token.Y = service.SnapToGrid(token.X, token.Y, scene.GridSizePx, scene.GridOffsetX, scene.GridOffsetY, token.SizeCells)
	if err := h.repo.CreateToken(ctx, &token); err != nil {
		h.fail(c, err, "could not create token")
		return
	}
	h.publish(c, campaignID, "vtt.scene.updated", gin.H{"scene_id": scene.ID})
	c.JSON(http.StatusCreated, token)
}

func (h *VTTHandler) UpdateToken(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	campaignID := parseID(c.Param("id"))
	token, err := h.repo.GetToken(c.Request.Context(), campaignID, parseID(c.Param("token_id")))
	if err != nil {
		h.fail(c, err, "could not load token")
		return
	}
	var in tokenInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if err := in.apply(token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.repo.UpdateToken(c.Request.Context(), token); err != nil {
		h.fail(c, err, "could not update token")
		return
	}
	h.publish(c, campaignID, "vtt.scene.updated", gin.H{"scene_id": token.SceneID})
	c.JSON(http.StatusOK, token)
}

func (h *VTTHandler) MoveToken(c *gin.Context) {
	ctx := c.Request.Context()
	campaignID := parseID(c.Param("id"))
	token, err := h.repo.GetToken(ctx, campaignID, parseID(c.Param("token_id")))
	if err != nil {
		h.fail(c, err, "could not load token")
		return
	}
	gm := middleware.IsGM(c)
	if !gm && (token.Hidden || token.OwnerUserID == nil || *token.OwnerUserID != middleware.GetUserID(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only move your own tokens"})
		return
	}
	var in struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	scene, err := h.repo.GetScene(ctx, campaignID, token.SceneID)
	if err != nil {
		h.fail(c, err, "could not load scene")
		return
	}
	if !gm {
		// Players: real-time exploration goes over the WebSocket; this REST drag is capped at one
		// move of sheet speed and unavailable in narrative scenes or during combat (vtt-modes.md §2).
		if scene.Mode != "exploration" {
			c.JSON(http.StatusConflict, gin.H{"error": "Movement is not available in this scene mode"})
			return
		}
		if inCombat, _ := h.repo.TokenInCombat(ctx, token.ID); inCombat != 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Token is in combat: use the turn-based movement"})
			return
		}
		limit := float64(max(5, token.SpeedFt)) * float64(scene.GridSizePx) / float64(max(1, scene.FeetPerCell))
		in.X, in.Y = service.ClampStep(token.X, token.Y, in.X, in.Y, limit)
	}
	x, y := service.SnapToGrid(in.X, in.Y, scene.GridSizePx, scene.GridOffsetX, scene.GridOffsetY, token.SizeCells)
	if x < 0 || y < 0 || x > float64(scene.WidthPx) || y > float64(scene.HeightPx) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Movement outside the scene"})
		return
	}
	if !gm && service.MovementBlocked(scene.Walls, token.X, token.Y, x, y) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Movement blocked by a wall"})
		return
	}
	if err := h.repo.MoveToken(ctx, campaignID, token.ID, x, y); err != nil {
		h.fail(c, err, "could not move token")
		return
	}
	if token.Hidden {
		h.publish(c, campaignID, "vtt.scene.updated", gin.H{"scene_id": token.SceneID})
	} else {
		h.publish(c, campaignID, "vtt.token.moved", gin.H{"scene_id": token.SceneID, "token_id": token.ID, "x": x, "y": y})
	}
	c.JSON(http.StatusOK, gin.H{"id": token.ID, "x": x, "y": y})
}

func (h *VTTHandler) DeleteToken(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	campaignID := parseID(c.Param("id"))
	sceneID, err := h.repo.DeleteToken(c.Request.Context(), campaignID, parseID(c.Param("token_id")))
	if err != nil {
		h.fail(c, err, "could not delete token")
		return
	}
	h.publish(c, campaignID, "vtt.scene.updated", gin.H{"scene_id": sceneID})
	c.Status(http.StatusNoContent)
}
