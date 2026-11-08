package service

import (
	"context"
	"errors"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

var (
	ErrCharacterNotOwned = errors.New("character not owned by this user")
	ErrNoSpellSlots      = errors.New("no spell slots available")
)

type CharacterService struct {
	charRepo     *repository.CharacterRepository
	campaignRepo *repository.CampaignRepository
	itemRepo     *repository.ItemRepository
	statRolls    *repository.StatRollRepository
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
	s.initializeSpellSlots(ctx, char.ID, char.Class)

	return char, nil
}

func (s *CharacterService) initializeSpellSlots(ctx context.Context, charID int64, class string) {
	// Level-1 slots by class (full casters 2, warlock 1, half casters 0).
	_, casting, level1 := ClassRule(class)
	if casting == "" {
		return
	}
	for level := 1; level <= 9; level++ {
		total := 0
		if level == 1 {
			total = level1
		}
		slot := &domain.SpellSlot{
			CharacterID: charID,
			Level:       level,
			Total:       total,
			Used:        0,
		}
		s.charRepo.UpsertSpellSlot(ctx, slot)
	}
}

func (s *CharacterService) Authorize(ctx context.Context, charID, userID int64) (bool, error) {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return false, ErrNotFound
	}
	role, err := s.campaignRepo.GetMemberRole(ctx, char.CampaignID, userID)
	if err != nil || role == "" {
		return false, ErrForbidden
	}
	if role != domain.RoleGM && char.UserID != userID {
		return false, ErrForbidden
	}
	return role == domain.RoleGM, nil
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
	applyCharacterUpdates(char, req)

	if err := s.charRepo.Update(ctx, char); err != nil {
		return nil, err
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
		c.Gold = *req.Gold
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
		Prepared:    false,
		SRDRefID:    req.SRDRefID,
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
