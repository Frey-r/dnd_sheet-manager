package service

import (
	"fmt"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

// SRDService handles D&D 5e SRD rules logic: encounter building, spell planning, loadout analysis.
type SRDService struct {
	repo *repository.SRDRepository
}

// NewSRDService creates a new SRDService.
func NewSRDService(repo *repository.SRDRepository) *SRDService {
	return &SRDService{repo: repo}
}

// ── CR / XP Tables ──────────────────────────────────────────

// CRToXP maps Challenge Rating strings to XP values (SRD 5.1).
var CRToXP = map[string]int{
	"0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
	"1": 200, "2": 450, "3": 700, "4": 1100,
	"5": 1800, "6": 2300, "7": 2900, "8": 3900,
	"9": 5000, "10": 5900, "11": 7200, "12": 8400,
	"13": 10000, "14": 11500, "15": 13000, "16": 15000,
	"17": 18000, "18": 20000, "19": 22000, "20": 25000,
	"21": 33000, "22": 41000, "23": 50000, "24": 62000,
	"25": 75000, "26": 90000, "27": 105000, "28": 120000,
	"29": 135000, "30": 155000,
}

// CRToNumeric converts a CR string to a float64 for comparison.
func CRToNumeric(cr string) float64 {
	switch cr {
	case "0":
		return 0
	case "1/8":
		return 0.125
	case "1/4":
		return 0.25
	case "1/2":
		return 0.5
	default:
		var n float64
		fmt.Sscanf(cr, "%f", &n)
		return n
	}
}

// GetXPForCR returns the XP value for a given CR string.
func GetXPForCR(cr string) int {
	if xp, ok := CRToXP[cr]; ok {
		return xp
	}
	return 0
}

// ── Passthrough to Repository ───────────────────────────────

func (s *SRDService) SearchMonsters(f domain.MonsterFilters) (*domain.PaginatedResult[domain.MonsterListItem], error) {
	return s.repo.SearchMonsters(f)
}

func (s *SRDService) GetMonster(id int64) (*MonsterDetail, error) {
	m, err := s.repo.GetMonster(id)
	if err != nil {
		return nil, err
	}
	return NewMonsterDetail(m), nil
}

func (s *SRDService) SearchSpells(f domain.SpellFilters) (*domain.PaginatedResult[domain.SpellListItem], error) {
	return s.repo.SearchSpells(f)
}

func (s *SRDService) GetSpell(id int64) (*SpellDetail, error) {
	sp, err := s.repo.GetSpell(id)
	if err != nil {
		return nil, err
	}
	return NewSpellDetail(sp), nil
}

func (s *SRDService) SearchEquipment(f domain.EquipmentFilters) (*domain.PaginatedResult[domain.SRDEquipment], error) {
	return s.repo.SearchEquipment(f)
}

func (s *SRDService) GetEquipment(id int64) (*domain.SRDEquipment, error) {
	return s.repo.GetEquipment(id)
}

func (s *SRDService) SearchMagicItems(f domain.MagicItemFilters) (*domain.PaginatedResult[domain.SRDMagicItem], error) {
	return s.repo.SearchMagicItems(f)
}

func (s *SRDService) GetMagicItem(id int64) (*domain.SRDMagicItem, error) {
	return s.repo.GetMagicItem(id)
}

func (s *SRDService) ListClasses() ([]domain.SRDClass, error) {
	return s.repo.ListClasses()
}

func (s *SRDService) GetClassByName(name string) (*domain.SRDClass, error) {
	return s.repo.GetClassByName(name)
}

func (s *SRDService) ListRaces() ([]domain.SRDRace, error) {
	return s.repo.ListRaces()
}

func (s *SRDService) GetRaceByName(name string) (*domain.SRDRace, error) {
	return s.repo.GetRaceByName(name)
}

func (s *SRDService) ListConditions() ([]domain.SRDCondition, error) {
	return s.repo.ListConditions()
}

func (s *SRDService) SearchRules(f domain.RulesFilters) (*domain.PaginatedResult[domain.SRDRule], error) {
	return s.repo.SearchRules(f)
}
