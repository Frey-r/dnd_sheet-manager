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

	char := &domain.Character{
		UserID:     userID,
		CampaignID: req.CampaignID,
		Name:       req.Name,
		Race:       req.Race,
		Class:      req.Class,
		Level:      1,
		SpellcastingAbility: "INT",
	}

	if err := s.charRepo.Create(ctx, char); err != nil {
		return nil, err
	}

	// Initialize spell slots for spellcasters
	s.initializeSpellSlots(ctx, char.ID, char.Class)

	return char, nil
}

func (s *CharacterService) initializeSpellSlots(ctx context.Context, charID int64, class string) {
	// Only initialize for known spellcaster classes
	spellcasterClasses := map[string]bool{
		"wizard": true, "sorcerer": true, "cleric": true,
		"druid": true, "paladin": true, "ranger": true,
		"warlock": true, "artificer": true,
	}

	if !spellcasterClasses[class] {
		return
	}

	// Initialize level 1 with 2 slots, level 2+ with 0
	for level := 1; level <= 9; level++ {
		total := 0
		if level == 1 {
			total = 2
		}
		slot := &domain.SpellSlot{
			CharacterID: charID,
			Level:      level,
			Total:      total,
			Used:       0,
		}
		s.charRepo.UpsertSpellSlot(ctx, slot)
	}
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
	if req.Name != nil           { c.Name = *req.Name }
	if req.Race != nil           { c.Race = *req.Race }
	if req.Class != nil          { c.Class = *req.Class }
	if req.Level != nil          { c.Level = *req.Level }
	if req.Background != nil     { c.Background = *req.Background }
	if req.Alignment != nil     { c.Alignment = *req.Alignment }
	if req.StrScore != nil       { c.StrScore = *req.StrScore }
	if req.DexScore != nil       { c.DexScore = *req.DexScore }
	if req.ConScore != nil       { c.ConScore = *req.ConScore }
	if req.IntScore != nil       { c.IntScore = *req.IntScore }
	if req.WisScore != nil       { c.WisScore = *req.WisScore }
	if req.ChaScore != nil       { c.ChaScore = *req.ChaScore }
	if req.MaxHP != nil          { c.MaxHP = *req.MaxHP }
	if req.CurrentHP != nil      { c.CurrentHP = *req.CurrentHP }
	if req.TempHP != nil         { c.TempHP = *req.TempHP }
	if req.AC != nil             { c.AC = *req.AC }
	if req.Speed != nil          { c.Speed = *req.Speed }
	if req.Inspiration != nil    { c.Inspiration = *req.Inspiration }
	if req.XP != nil            { c.XP = *req.XP }
	if req.Gold != nil           { c.Gold = *req.Gold }
	if req.PersonalityTraits != nil { c.PersonalityTraits = *req.PersonalityTraits }
	if req.Ideals != nil        { c.Ideals = *req.Ideals }
	if req.Bonds != nil          { c.Bonds = *req.Bonds }
	if req.Flaws != nil          { c.Flaws = *req.Flaws }
	if req.BackstoryText != nil  { c.BackstoryText = *req.BackstoryText }
	if req.Notes != nil          { c.Notes = *req.Notes }
	if req.SpellcastingAbility != nil { c.SpellcastingAbility = *req.SpellcastingAbility }
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
	if err := s.itemRepo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *CharacterService) RemoveItem(ctx context.Context, charID, itemID int64) error {
	return s.itemRepo.Delete(ctx, itemID)
}

func (s *CharacterService) EquipItem(ctx context.Context, charID, itemID int64) error {
	item, err := s.itemRepo.GetByID(ctx, itemID)
	if err != nil || item == nil {
		return ErrNotFound
	}
	item.IsEquipped = !item.IsEquipped
	return s.itemRepo.Update(ctx, item)
}