package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// Wall is a segment that blocks sight and movement unless it is an open door.
// See openspec/specs/vtt.md §4.
type Wall struct {
	X1   float64 `json:"x1"`
	Y1   float64 `json:"y1"`
	X2   float64 `json:"x2"`
	Y2   float64 `json:"y2"`
	Door bool    `json:"door"`
	Open bool    `json:"open"`
}

// Blocks reports whether the wall currently blocks sight and movement.
func (w Wall) Blocks() bool { return !(w.Door && w.Open) }

// SceneLight is a static light source placed by the GM (radii in feet).
type SceneLight struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Bright int     `json:"bright"`
	Dim    int     `json:"dim"`
}

// Point is a scene coordinate in pixels.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Zone is an encounter area drawn by the GM (vtt-modes.md §4).
type Zone struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Points     []Point `json:"points"`
	MonsterIDs []int64 `json:"monster_ids"`
	Armed      bool    `json:"armed"`
}

type Walls []Wall
type SceneLights []SceneLight
type Zones []Zone

func (z Zones) Value() (driver.Value, error) { return jsonValue(z, "[]") }
func (z *Zones) Scan(src any) error          { return jsonScan(src, z) }

// JSONMap is a free-form JSON object column.
type JSONMap map[string]any

func (m JSONMap) Value() (driver.Value, error) { return jsonValue(m, "{}") }
func (m *JSONMap) Scan(src any) error          { return jsonScan(src, m) }

func (w Walls) Value() (driver.Value, error)       { return jsonValue(w, "[]") }
func (w *Walls) Scan(src any) error                { return jsonScan(src, w) }
func (l SceneLights) Value() (driver.Value, error) { return jsonValue(l, "[]") }
func (l *SceneLights) Scan(src any) error          { return jsonScan(src, l) }

func jsonValue(v any, empty string) (driver.Value, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	if string(b) == "null" {
		return empty, nil
	}
	return string(b), nil
}

func jsonScan(src any, dst any) error {
	switch v := src.(type) {
	case nil:
		return nil
	case []byte:
		return json.Unmarshal(v, dst)
	case string:
		return json.Unmarshal([]byte(v), dst)
	default:
		return errors.New("unsupported JSON column type")
	}
}

type VTTScene struct {
	ID           int64       `db:"id" json:"id"`
	CampaignID   int64       `db:"campaign_id" json:"campaign_id"`
	Name         string      `db:"name" json:"name"`
	MapURL       string      `db:"map_url" json:"map_url"`
	WidthPx      int         `db:"width_px" json:"width_px"`
	HeightPx     int         `db:"height_px" json:"height_px"`
	GridSizePx   int         `db:"grid_size_px" json:"grid_size_px"`
	GridOffsetX  int         `db:"grid_offset_x" json:"grid_offset_x"`
	GridOffsetY  int         `db:"grid_offset_y" json:"grid_offset_y"`
	FeetPerCell  int         `db:"feet_per_cell" json:"feet_per_cell"`
	AmbientLight string      `db:"ambient_light" json:"ambient_light"`
	FogEnabled   bool        `db:"fog_enabled" json:"fog_enabled"`
	Walls        Walls       `db:"walls" json:"walls"`
	Lights       SceneLights `db:"lights" json:"lights"`
	Mode         string      `db:"mode" json:"mode"`
	Pace         float64     `db:"exploration_pace" json:"exploration_pace"`
	Zones        Zones       `db:"zones" json:"zones"`
	IsActive     bool        `db:"is_active" json:"is_active"`
	CreatedAt    time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time   `db:"updated_at" json:"updated_at"`
	Tokens       []VTTToken  `db:"-" json:"tokens,omitempty"`
}

type VTTToken struct {
	ID            int64     `db:"id" json:"id"`
	SceneID       int64     `db:"scene_id" json:"scene_id"`
	CampaignID    int64     `db:"campaign_id" json:"campaign_id"`
	Name          string    `db:"name" json:"name"`
	Kind          string    `db:"kind" json:"kind"`
	CharacterID   *int64    `db:"character_id" json:"character_id"`
	OwnerUserID   *int64    `db:"owner_user_id" json:"owner_user_id"`
	ImageURL      string    `db:"image_url" json:"image_url"`
	Color         string    `db:"color" json:"color"`
	X             float64   `db:"x" json:"x"`
	Y             float64   `db:"y" json:"y"`
	SizeCells     float64   `db:"size_cells" json:"size_cells"`
	HP            int       `db:"hp" json:"hp"`
	MaxHP         int       `db:"max_hp" json:"max_hp"`
	AC            int       `db:"ac" json:"ac"`
	Hidden        bool      `db:"hidden" json:"hidden"`
	VisionFt      int       `db:"vision_ft" json:"vision_ft"`
	DarkvisionFt  int       `db:"darkvision_ft" json:"darkvision_ft"`
	BlindsightFt  int       `db:"blindsight_ft" json:"blindsight_ft"`
	LightBrightFt int       `db:"light_bright_ft" json:"light_bright_ft"`
	LightDimFt    int       `db:"light_dim_ft" json:"light_dim_ft"`
	SpeedFt       int       `db:"speed_ft" json:"speed_ft"`
	PassivePerc   int       `db:"passive_perception" json:"passive_perception"`
	StealthBonus  int       `db:"stealth_bonus" json:"stealth_bonus"`
	DexMod        int       `db:"dex_mod" json:"dex_mod"`
	Sneaking      bool      `db:"sneaking" json:"sneaking"`
	Detects       bool      `db:"detects" json:"detects"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

// Milestone is a campaign flag the GM marks as achieved (vtt-modes.md §3).
type Milestone struct {
	ID         int64      `db:"id" json:"id"`
	CampaignID int64      `db:"campaign_id" json:"campaign_id"`
	Name       string     `db:"name" json:"name"`
	Achieved   bool       `db:"achieved" json:"achieved"`
	AchievedAt *time.Time `db:"achieved_at" json:"achieved_at"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
}

// VTTObject is an interactive object placed on an exploration scene.
type VTTObject struct {
	ID           int64     `db:"id" json:"id"`
	SceneID      int64     `db:"scene_id" json:"scene_id"`
	CampaignID   int64     `db:"campaign_id" json:"campaign_id"`
	Name         string    `db:"name" json:"name"`
	Icon         string    `db:"icon" json:"icon"`
	X            float64   `db:"x" json:"x"`
	Y            float64   `db:"y" json:"y"`
	DiscoverDC   int       `db:"discover_dc" json:"discover_dc"`
	Requirements JSONMap   `db:"requirements" json:"requirements"`
	LootKind     string    `db:"loot_kind" json:"loot_kind"`
	Loot         JSONMap   `db:"loot" json:"loot"`
	PerCharacter bool      `db:"per_character" json:"per_character"`
	Depleted     bool      `db:"depleted" json:"depleted"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	Attempted    bool      `db:"-" json:"attempted"`
}

// VTTCombat is a local (or whole-scene) turn-based combat.
type VTTCombat struct {
	ID            int64          `db:"id" json:"id"`
	SceneID       int64          `db:"scene_id" json:"scene_id"`
	CampaignID    int64          `db:"campaign_id" json:"campaign_id"`
	Status        string         `db:"status" json:"status"`
	Round         int            `db:"round" json:"round"`
	TurnIndex     int            `db:"turn_index" json:"turn_index"`
	TurnStartedAt time.Time      `db:"turn_started_at" json:"turn_started_at"`
	TurnSeconds   int            `db:"turn_seconds" json:"turn_seconds"`
	Paused        bool           `db:"paused" json:"paused"`
	RemainingMs   int            `db:"remaining_ms" json:"remaining_ms"`
	CenterX       float64        `db:"center_x" json:"center_x"`
	CenterY       float64        `db:"center_y" json:"center_y"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
	Combatants    []VTTCombatant `db:"-" json:"combatants"`
}

type VTTCombatant struct {
	ID             int64  `db:"id" json:"id"`
	CombatID       int64  `db:"combat_id" json:"combat_id"`
	TokenID        int64  `db:"token_id" json:"token_id"`
	Initiative     int    `db:"initiative" json:"initiative"`
	IsPlayer       bool   `db:"is_player" json:"is_player"`
	MovementUsedFt int    `db:"movement_used_ft" json:"movement_used_ft"`
	Dashed         bool   `db:"dashed" json:"dashed"`
	Pending        bool   `db:"pending" json:"pending"`
	Name           string `db:"name" json:"name"`
}
