package domain

import "time"

type Combatant struct {
	ID           int64     `db:"id" json:"id"`
	CampaignID   int64     `db:"campaign_id" json:"campaign_id"`
	CharacterID  *int64    `db:"character_id" json:"character_id,omitempty"`
	Name         string    `db:"name" json:"name"`
	Initiative   int       `db:"initiative" json:"initiative"`
	HP           int       `db:"hp" json:"hp"`
	MaxHP        int       `db:"max_hp" json:"max_hp"`
	IsPlayer     bool      `db:"is_player" json:"is_player"`
	AC           *int      `db:"ac" json:"ac,omitempty"`
	SRDMonsterID *int64    `db:"srd_monster_id" json:"srd_monster_id,omitempty"`
	SortOrder    int       `db:"sort_order" json:"sort_order"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type CombatLogEntry struct {
	ID         int64     `db:"id" json:"id"`
	CampaignID int64     `db:"campaign_id" json:"campaign_id"`
	ActorID    *int64    `db:"actor_id" json:"actor_id,omitempty"`
	Body       string    `db:"body" json:"body"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

type CombatState struct {
	Round      int              `json:"round"`
	Turn       int              `json:"turn"`
	Combatants []Combatant      `json:"combatants"`
	Log        []CombatLogEntry `json:"log"`
}
