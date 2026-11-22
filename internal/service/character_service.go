package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

var (
	ErrCharacterNotOwned = errors.New("character not owned by this user")
	ErrNoSpellSlots      = errors.New("no spell slots available")
	ErrInvalidSpellSlot  = errors.New("invalid spell slot level or total")
)

type CharacterService struct {
	charRepo     *repository.CharacterRepository
	campaignRepo *repository.CampaignRepository
	itemRepo     *repository.ItemRepository
	statRolls    *repository.StatRollRepository
	content      contentGetter
	catalog      characterCatalog
}

// contentGetter reads one catalog entry; *repository.ContentRepository satisfies it.
type contentGetter interface {
	Get(ctx context.Context, id int64) (*domain.ContentEntity, error)
}

// characterCatalog is the read-only catalog lookup used to build characters;
// *repository.SRDRepository satisfies it (srd-integration.md).
type characterCatalog interface {
	GetClassByName(name string) (*domain.SRDClass, error)
	GetRaceByName(name string) (*domain.SRDRace, error)
	SpellRefByContent(ctx context.Context, contentID int64) (*int64, error)
	EquipmentRefByContent(ctx context.Context, contentID int64) (*int64, error)
}

// WithCatalog enables catalog checks on creation, catalog spell-slot progression and the
// srd_ref_id link of spells and items picked from the compendium.
func (s *CharacterService) WithCatalog(c characterCatalog) *CharacterService {
	s.catalog = c
	return s
}

// catalogWarnings returns non-blocking notes when the class or race is not in the catalog;
// the character is still created as homebrew.
func (s *CharacterService) catalogWarnings(class, race string) []string {
	if s.catalog == nil {
		return nil
	}
	var warnings []string
	if _, err := s.catalog.GetClassByName(class); errors.Is(err, sql.ErrNoRows) {
		warnings = append(warnings, fmt.Sprintf("La clase «%s» no está en el catálogo; se crea como clase propia.", class))
	}
	// The creator stores versioned names ("Elf (XPHB)"); the catalog row is named "Elf".
	if _, err := s.catalog.GetRaceByName(race); errors.Is(err, sql.ErrNoRows) && !s.knownBaseRace(race) {
		warnings = append(warnings, fmt.Sprintf("La raza «%s» no está en el catálogo; se crea como raza propia.", race))
	}
	return warnings
}

// knownBaseRace reports whether the race without its " (SOURCE)" suffix is in the catalog.
func (s *CharacterService) knownBaseRace(race string) bool {
	race = strings.TrimSpace(race)
	open := strings.LastIndex(race, " (")
	if open <= 0 || !strings.HasSuffix(race, ")") {
		return false
	}
	_, err := s.catalog.GetRaceByName(race[:open])
	return err == nil
}

// ProficiencyBonusForLevel is the 5e character proficiency bonus (+2 at 1-4, +3 at 5-8 ... +6 at 17-20).
func ProficiencyBonusForLevel(level int) int {
	return 2 + (min(max(level, 1), 20)-1)/4
}

// catalogSlotTotals returns the slot totals for levels 1-9 of a catalog class at a character
// level, and false when the class has no row for that level.
func catalogSlotTotals(class *domain.SRDClass, level int) ([9]int, bool) {
	if class == nil {
		return [9]int{}, false
	}
	for _, row := range class.SpellSlots {
		if row.ClassLevel == level {
			return [9]int{row.Slot1, row.Slot2, row.Slot3, row.Slot4, row.Slot5, row.Slot6, row.Slot7, row.Slot8, row.Slot9}, true
		}
	}
	return [9]int{}, false
}

// spellSlotTotals prefers the catalog progression of the class and falls back to the fixed
// level-1 table for classes the catalog does not know.
func (s *CharacterService) spellSlotTotals(class string, level int) ([9]int, bool) {
	if s.catalog != nil {
		if found, err := s.catalog.GetClassByName(class); err == nil {
			if totals, ok := catalogSlotTotals(found, level); ok {
				return totals, true
			}
		}
	}
	_, casting, level1 := ClassRule(class)
	if casting == "" || level != 1 {
		return [9]int{}, false
	}
	return [9]int{level1}, true
}

// WithContent lets items added from the compendium take their value from the catalog entry.
func (s *CharacterService) WithContent(c contentGetter) *CharacterService {
	s.content = c
	return s
}

// CatalogValueCP returns the price of a 5etools item entry in copper (5etools stores `value`
// in cp already), or nil when the entry has no numeric positive value.
func CatalogValueCP(data json.RawMessage) *int64 {
	var entry struct {
		Value *float64 `json:"value"`
	}
	if len(data) == 0 || json.Unmarshal(data, &entry) != nil || entry.Value == nil || *entry.Value <= 0 {
		return nil
	}
	v := int64(math.Round(*entry.Value))
	return &v
}

// WithStatRolls enables verification of rolled ability scores.
func (s *CharacterService) WithStatRolls(r *repository.StatRollRepository) *CharacterService {
	s.statRolls = r
	return s
}

func NewCharacterService(charRepo *repository.CharacterRepository, campaignRepo *repository.CampaignRepository, itemRepo *repository.ItemRepository) *CharacterService {
	return &CharacterService{charRepo: charRepo, campaignRepo: campaignRepo, itemRepo: itemRepo}
}

func (s *CharacterService) Create(ctx context.Context, userID int64, req *domain.CreateCharacterRequest) (*domain.Character, error) {
	isMember, err := s.campaignRepo.IsMember(ctx, req.CampaignID, userID)
	if err != nil || !isMember {
		return nil, ErrForbidden
	}

	existing, _ := s.charRepo.GetByUserAndCampaign(ctx, userID, req.CampaignID)
	if existing != nil {
		return existing, nil // return existing character if already has one in this campaign
	}

	appearance, err := ValidateAppearance(req.Appearance)
	if err != nil {
		return nil, err
	}

	char := &domain.Character{
		Appearance: appearance,
		UserID:     userID,
		CampaignID: req.CampaignID,
		Name:       req.Name,
		Race:       req.Race,
		Class:      req.Class,
		Background: req.Background,
		Alignment:  req.Alignment,
	}
	final := [6]int{req.StrScore, req.DexScore, req.ConScore, req.IntScore, req.WisScore, req.ChaScore}
	if req.StatRollID != nil {
		if s.statRolls == nil || req.BaseScores == nil {
			return nil, ErrRolledScoresMismatch
		}
		roll, err := s.statRolls.Get(ctx, *req.StatRollID)
		if err != nil || roll.CampaignID != req.CampaignID || roll.UserID != userID || roll.Status != "available" {
			return nil, ErrRolledScoresMismatch
		}
		totals := make([]int, len(roll.Totals))
		for i, v := range roll.Totals {
			totals[i] = int(v)
		}
		if !IsPermutation(totals, *req.BaseScores) {
			return nil, ErrRolledScoresMismatch
		}
		if !ValidBonuses(*req.BaseScores, final) {
			return nil, ErrInvalidBonuses
		}
	}
	if err := ApplyStartingStats(char, final); err != nil {
		return nil, err
	}
	// Racial Perception proficiency (e.g. PHB Elf "Keen Senses") counts in the stored passive
	// Perception, which the hub and the VTT read; the sheet computes the same value.
	if granted, err := s.charRepo.RaceGrantsSkill(ctx, char.Race, "perception"); err == nil && granted {
		char.PassivePerception += char.ProficiencyBonus
	}
	if req.Speed >= 5 && req.Speed <= 120 {
		char.Speed = req.Speed
	}

	if err := s.charRepo.Create(ctx, char); err != nil {
		return nil, err
	}
	if req.StatRollID != nil {
		_ = s.statRolls.MarkUsed(ctx, *req.StatRollID, char.ID)
	}

	// Initialize spell slots for spellcasters
	s.initializeSpellSlots(ctx, char.ID, char.Class, char.Level)
	char.Warnings = s.catalogWarnings(char.Class, char.Race)

	return char, nil
}

// initializeSpellSlots stores the slot totals of the class at a level (catalog progression,
// with the fixed level-1 table as fallback), keeping slots already spent within the new totals.
func (s *CharacterService) initializeSpellSlots(ctx context.Context, charID int64, class string, level int) {
	totals, ok := s.spellSlotTotals(class, level)
	if !ok {
		return
	}
	for i, total := range totals {
		_ = s.charRepo.SetSpellSlotTotal(ctx, charID, i+1, total)
	}
}

// SetSpellSlotTotal lets the owner or the GM change a slot total (srd-integration.md: the
// player MAY modify the totals).
func (s *CharacterService) SetSpellSlotTotal(ctx context.Context, charID int64, level, total int) ([]domain.SpellSlot, error) {
	if level < 1 || level > 9 || total < 0 || total > 9 {
		return nil, ErrInvalidSpellSlot
	}
	if err := s.charRepo.SetSpellSlotTotal(ctx, charID, level, total); err != nil {
		return nil, err
	}
	return s.charRepo.GetSpellSlots(ctx, charID)
}

func (s *CharacterService) Authorize(ctx context.Context, charID, userID int64) (bool, error) {
	isGM, _, err := s.AuthorizeInCampaign(ctx, charID, userID)
	return isGM, err
}

// AuthorizeInCampaign is Authorize plus the character's campaign id, which is returned even
// when access is denied so the 403 can be audited against that campaign (security.md).
func (s *CharacterService) AuthorizeInCampaign(ctx context.Context, charID, userID int64) (bool, int64, error) {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return false, 0, ErrNotFound
	}
	role, err := s.campaignRepo.GetMemberRole(ctx, char.CampaignID, userID)
	if err != nil || role == "" {
		return false, char.CampaignID, ErrForbidden
	}
	if role != domain.RoleGM && char.UserID != userID {
		return false, char.CampaignID, ErrForbidden
	}
	return role == domain.RoleGM, char.CampaignID, nil
}

// UpdateAppearance changes the avatar; only the owner or the campaign GM may do it.
func (s *CharacterService) UpdateAppearance(ctx context.Context, charID, userID int64, raw []byte) (*domain.Character, error) {
	if _, err := s.Authorize(ctx, charID, userID); err != nil {
		return nil, err
	}
	appearance, err := ValidateAppearance(raw)
	if err != nil {
		return nil, err
	}
	if err := s.charRepo.UpdateAppearance(ctx, charID, appearance); err != nil {
		return nil, err
	}
	return s.charRepo.GetByID(ctx, charID)
}

func (s *CharacterService) GetByID(ctx context.Context, charID, userID int64, isGM bool) (*domain.Character, error) {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return nil, ErrNotFound
	}

	if !isGM && char.UserID != userID {
		return nil, ErrForbidden
	}

	return char, nil
}

func (s *CharacterService) GetByUserAndCampaign(ctx context.Context, userID, campaignID int64) (*domain.Character, error) {
	return s.charRepo.GetByUserAndCampaign(ctx, userID, campaignID)
}

func (s *CharacterService) ListByCampaign(ctx context.Context, campaignID int64) ([]domain.CharacterWithOwner, error) {
	return s.charRepo.ListByCampaign(ctx, campaignID)
}

func (s *CharacterService) Update(ctx context.Context, charID, userID int64, isGM bool, req *domain.UpdateCharacterRequest) (*domain.Character, error) {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return nil, ErrNotFound
	}

	if !isGM && char.UserID != userID {
		return nil, ErrForbidden
	}

	// Apply updates
	oldLevel, oldClass := char.Level, char.Class
	applyCharacterUpdates(char, req)

	if err := s.charRepo.Update(ctx, char); err != nil {
		return nil, err
	}
	if char.Level != oldLevel || char.Class != oldClass {
		s.initializeSpellSlots(ctx, char.ID, char.Class, char.Level)
	}

	return char, nil
}

func applyCharacterUpdates(c *domain.Character, req *domain.UpdateCharacterRequest) {
	if req.Name != nil {
		c.Name = *req.Name
	}
	if req.Race != nil {
		c.Race = *req.Race
	}
	if req.Class != nil {
		c.Class = *req.Class
	}
	if req.Level != nil {
		c.Level = *req.Level
		// The proficiency bonus follows the level table (srd-integration.md: level 5 -> +3).
		c.ProficiencyBonus = ProficiencyBonusForLevel(c.Level)
	}
	if req.Background != nil {
		c.Background = *req.Background
	}
	if req.Alignment != nil {
		c.Alignment = *req.Alignment
	}
	if req.StrScore != nil {
		c.StrScore = *req.StrScore
	}
	if req.DexScore != nil {
		c.DexScore = *req.DexScore
	}
	if req.ConScore != nil {
		c.ConScore = *req.ConScore
	}
	if req.IntScore != nil {
		c.IntScore = *req.IntScore
	}
	if req.WisScore != nil {
		c.WisScore = *req.WisScore
	}
	if req.ChaScore != nil {
		c.ChaScore = *req.ChaScore
	}
	if req.MaxHP != nil {
		c.MaxHP = *req.MaxHP
	}
	if req.CurrentHP != nil {
		c.CurrentHP = *req.CurrentHP
	}
	if req.TempHP != nil {
		c.TempHP = *req.TempHP
	}
	// Current HP stays within [0, max HP] and temporary HP is never negative (characters.md).
	c.CurrentHP = min(max(c.CurrentHP, 0), max(c.MaxHP, 0))
	c.TempHP = max(c.TempHP, 0)
	if req.AC != nil {
		c.AC = *req.AC
	}
	if req.Speed != nil {
		c.Speed = *req.Speed
	}
	if req.Inspiration != nil {
		c.Inspiration = *req.Inspiration
	}
	if req.XP != nil {
		c.XP = *req.XP
	}
	if req.Gold != nil {
		c.Gold = max(*req.Gold, 0)
	}
	if req.Silver != nil {
		c.Silver = max(*req.Silver, 0)
	}
	if req.Copper != nil {
		c.Copper = max(*req.Copper, 0)
	}
	if req.PhysicalDescription != nil {
		c.PhysicalDescription = domain.EncodePhysicalDescription(*req.PhysicalDescription)
	}
	if req.PersonalityTraits != nil {
		c.PersonalityTraits = *req.PersonalityTraits
	}
	if req.Ideals != nil {
		c.Ideals = *req.Ideals
	}
	if req.Bonds != nil {
		c.Bonds = *req.Bonds
	}
	if req.Flaws != nil {
		c.Flaws = *req.Flaws
	}
	if req.BackstoryText != nil {
		c.BackstoryText = *req.BackstoryText
	}
	if req.Notes != nil {
		c.Notes = *req.Notes
	}
	if req.SpellcastingAbility != nil {
		c.SpellcastingAbility = *req.SpellcastingAbility
	}
}

func (s *CharacterService) UpdateHP(ctx context.Context, charID, userID int64, isGM bool, currentHP, tempHP int) error {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return ErrNotFound
	}

	if !isGM && char.UserID != userID {
		return ErrForbidden
	}

	if currentHP > char.MaxHP {
		currentHP = char.MaxHP
	}
	if currentHP < 0 {
		currentHP = 0
	}
	if tempHP < 0 {
		tempHP = 0
	}
	return s.charRepo.UpdateHP(ctx, charID, currentHP, tempHP)
}

func (s *CharacterService) UpdateGold(ctx context.Context, charID, userID int64, isGM bool, gold int) error {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return ErrNotFound
	}

	if !isGM && char.UserID != userID {
		return ErrForbidden
	}

	return s.charRepo.UpdateGold(ctx, charID, gold)
}

func (s *CharacterService) LongRest(ctx context.Context, charID int64) error {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return ErrNotFound
	}

	// Restore HP to max
	if err := s.charRepo.UpdateHP(ctx, charID, char.MaxHP, 0); err != nil {
		return err
	}

	// Restore all spell slots
	return s.charRepo.RestoreAllSpellSlots(ctx, charID)
}

func (s *CharacterService) GetSpellSlots(ctx context.Context, charID int64) ([]domain.SpellSlot, error) {
	return s.charRepo.GetSpellSlots(ctx, charID)
}

func (s *CharacterService) GetInventory(ctx context.Context, charID int64) ([]domain.InventoryItem, error) {
	return s.itemRepo.GetByCharacter(ctx, charID)
}

func (s *CharacterService) GetSpells(ctx context.Context, charID int64) ([]domain.Spell, error) {
	return s.itemRepo.GetSpellsByCharacter(ctx, charID)
}

func (s *CharacterService) GetFeatures(ctx context.Context, charID int64) ([]domain.CharacterFeature, error) {
	return s.charRepo.GetFeatures(ctx, charID)
}

func (s *CharacterService) AddSpell(ctx context.Context, charID int64, req *domain.CreateSpellRequest) (*domain.Spell, error) {
	spell := &domain.Spell{
		CharacterID: charID,
		Name:        req.Name,
		Level:       req.Level,
		School:      req.School,
		CastingTime: req.CastingTime,
		Range:       req.Range,
		Duration:    req.Duration,
		Description: req.Description,
		Components:  req.Components,
		DamageType:  req.DamageType,
		Prepared:    req.Prepared != nil && *req.Prepared,
		SRDRefID:    req.SRDRefID,
	}
	// A spell picked from the compendium links to its srd_spells row (srd-data.md: srd_ref_id).
	if req.ContentEntityID != nil && s.catalog != nil {
		ref, err := s.catalog.SpellRefByContent(ctx, *req.ContentEntityID)
		if err != nil {
			return nil, err
		}
		if ref != nil {
			spell.SRDRefID = ref
		}
	}
	if err := s.itemRepo.CreateSpell(ctx, spell); err != nil {
		return nil, err
	}
	return spell, nil
}

func (s *CharacterService) AddItem(ctx context.Context, charID int64, req *domain.CreateItemRequest) (*domain.InventoryItem, error) {
	item := &domain.InventoryItem{
		CharacterID:        charID,
		Name:               req.Name,
		ItemType:           domain.ItemType(req.ItemType),
		Rarity:             domain.Rarity(req.Rarity),
		Weight:             req.Weight,
		Quantity:           req.Quantity,
		Description:        req.Description,
		RequiresAttunement: req.RequiresAttunement,
		IsTradeable:        req.IsTradeable,
		SRDRefID:           req.SRDRefID,
	}
	if item.Quantity <= 0 {
		item.Quantity = 1
	}
	item.IsTradeable = req.IsTradeable
	if req.ContentID != nil && s.content != nil {
		entity, err := s.content.Get(ctx, *req.ContentID)
		if err != nil {
			return nil, err
		}
		if entity != nil && (entity.Type == "item" || entity.Type == "baseitem" || entity.Type == "magicvariant") {
			item.ValueCP = CatalogValueCP(entity.Data)
		}
	}
	// srd_ref_id points at srd_equipment (its FK); magic items keep only value and text.
	if req.ContentID != nil && item.SRDRefID == nil && s.catalog != nil {
		ref, err := s.catalog.EquipmentRefByContent(ctx, *req.ContentID)
		if err != nil {
			return nil, err
		}
		item.SRDRefID = ref
	}
	if err := s.itemRepo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *CharacterService) RemoveItem(ctx context.Context, charID, itemID int64) error {
	if err := s.itemRepo.DeleteForCharacter(ctx, charID, itemID); err == repository.ErrResourceNotFound {
		return ErrNotFound
	} else {
		return err
	}
}

func (s *CharacterService) EquipItem(ctx context.Context, charID, itemID int64) error {
	item, err := s.itemRepo.GetByID(ctx, itemID)
	if err != nil || item == nil || item.CharacterID != charID {
		return ErrNotFound
	}
	if item.TradeLocked {
		return ErrTradeConflict
	}
	item.IsEquipped = !item.IsEquipped
	return s.itemRepo.UpdateForCharacter(ctx, charID, item)
}

func (s *CharacterService) UpdateItem(ctx context.Context, charID, itemID int64, req *domain.UpdateItemRequest) (*domain.InventoryItem, error) {
	if req.Quantity != nil && *req.Quantity < 0 {
		return nil, errors.New("quantity cannot be negative")
	}
	item, err := s.itemRepo.GetByID(ctx, itemID)
	if err != nil || item == nil || item.CharacterID != charID {
		return nil, ErrNotFound
	}
	if item.TradeLocked {
		return nil, ErrTradeConflict
	}
	if req.Name != nil && *req.Name != "" {
		item.Name = *req.Name
	}
	if req.Quantity != nil {
		item.Quantity = *req.Quantity
	}
	if req.IsEquipped != nil {
		item.IsEquipped = *req.IsEquipped
	}
	if req.SlotType != nil {
		item.SlotType = *req.SlotType
	}
	if req.IsAttuned != nil {
		item.IsAttuned = *req.IsAttuned
	}
	if req.IsTradeable != nil {
		item.IsTradeable = *req.IsTradeable
	}
	if req.QuestBound != nil {
		item.QuestBound = *req.QuestBound
	}
	return item, s.itemRepo.UpdateForCharacter(ctx, charID, item)
}

func (s *CharacterService) CastSpell(ctx context.Context, charID, spellID int64) ([]domain.SpellSlot, error) {
	slots, err := s.charRepo.CastSpell(ctx, charID, spellID)
	switch err {
	case nil:
		return slots, nil
	case repository.ErrSpellSlotUnavailable:
		return nil, ErrNoSpellSlots
	case repository.ErrResourceNotFound:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (s *CharacterService) Rest(ctx context.Context, charID int64) error {
	if err := s.charRepo.LongRest(ctx, charID); err == repository.ErrResourceNotFound {
		return ErrNotFound
	} else {
		return err
	}
}
