package service

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"

	"dnd-campaign-manager/internal/domain"
)

// MaxEncounterCombatants caps the combatants one encounter request may create.
const MaxEncounterCombatants = 50

var (
	ErrEncounterEmpty    = errors.New("encounter must contain between 1 and 50 combatants")
	ErrEncounterTooLarge = errors.New("encounter exceeds 50 combatants")
	ErrEncounterBadCount = errors.New("count must be between 1 and 50")
	ErrEncounterBadEntry = errors.New("every combatant needs a name")
	ErrEncounterBadStats = errors.New("combatant stats out of range")
	ErrEncounterBadID    = errors.New("monster_id must be positive")
	ErrUnknownSRDMonster = errors.New("unknown srd monster")
)

// EncounterEntry is one element of the encounter request: either a plain combatant
// (name/hp/max_hp/...) or an SRD monster reference {monster_id, count} whose stats
// are resolved server-side.
type EncounterEntry struct {
	domain.Combatant
	MonsterID *int64 `json:"monster_id"`
	Count     int    `json:"count"`
}

// MonsterIDs returns the distinct SRD monster ids referenced by the entries.
func MonsterIDs(entries []EncounterEntry) []int64 {
	seen := map[int64]bool{}
	var ids []int64
	for _, e := range entries {
		if e.MonsterID != nil && !seen[*e.MonsterID] {
			seen[*e.MonsterID] = true
			ids = append(ids, *e.MonsterID)
		}
	}
	return ids
}

// abilityModifier is the 5e modifier (floor((score-10)/2)) for an ability score.
func abilityModifier(score int) int {
	d := score - 10
	if d < 0 && d%2 != 0 {
		return d/2 - 1
	}
	return d / 2
}

// rollD20 returns a uniform 1..20.
func rollD20() int { return rand.IntN(20) + 1 }

// ResolveEncounter turns request entries into combatants for a campaign. SRD monster
// entries take hp, max_hp and AC from the monster row and roll initiative as
// d20 + DEX modifier (srd-integration.md); client-sent hp/ac/initiative are ignored
// for them. Plain entries are passed through (stripped of ids and monster links).
// monsters must contain every referenced id. roll is injectable for tests.
func ResolveEncounter(campaignID int64, entries []EncounterEntry, monsters map[int64]domain.SRDMonster, roll func() int) ([]*domain.Combatant, error) {
	if roll == nil {
		roll = rollD20
	}
	total := 0
	perMonster := map[int64]int{}
	for _, e := range entries {
		if e.MonsterID == nil {
			total++
		} else {
			if *e.MonsterID <= 0 {
				return nil, ErrEncounterBadID
			}
			if e.Count < 1 || e.Count > MaxEncounterCombatants {
				return nil, ErrEncounterBadCount
			}
			total += e.Count
			perMonster[*e.MonsterID] += e.Count
		}
		if total > MaxEncounterCombatants {
			return nil, ErrEncounterTooLarge
		}
	}
	if total == 0 {
		return nil, ErrEncounterEmpty
	}

	seq := map[int64]int{}
	out := make([]*domain.Combatant, 0, total)
	for _, e := range entries {
		if e.MonsterID == nil {
			c := e.Combatant
			if strings.TrimSpace(c.Name) == "" {
				return nil, ErrEncounterBadEntry
			}
			if c.AC != nil && (*c.AC < 0 || *c.AC > 100) {
				return nil, ErrEncounterBadStats
			}
			c.ID, c.CampaignID, c.SRDMonsterID, c.CharacterID = 0, campaignID, nil, nil
			out = append(out, &c)
			continue
		}
		m, ok := monsters[*e.MonsterID]
		if !ok {
			return nil, fmt.Errorf("%w: %d", ErrUnknownSRDMonster, *e.MonsterID)
		}
		hp := m.HP
		if hp < 1 {
			hp = 1
		}
		for i := 0; i < e.Count; i++ {
			seq[m.ID]++
			name := m.Name
			if perMonster[m.ID] > 1 {
				name = fmt.Sprintf("%s %d", m.Name, seq[m.ID])
			}
			ac, id := m.AC, m.ID
			out = append(out, &domain.Combatant{
				CampaignID:   campaignID,
				Name:         name,
				Initiative:   roll() + abilityModifier(m.DEX),
				HP:           hp,
				MaxHP:        hp,
				AC:           &ac,
				SRDMonsterID: &id,
			})
		}
	}
	return out, nil
}
