package service

import (
	"context"
	"errors"
	"time"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

var (
	ErrInsufficientGold    = errors.New("insufficient gold balance")
	ErrItemNotTradeable     = errors.New("item is not tradeable")
	ErrItemQuestBound       = errors.New("item is quest-bound")
	ErrItemNotOwned         = errors.New("item not owned by character")
	ErrTradeConflict        = errors.New("item no longer available for trade")
)

type TradeService struct {
	tradeRepo    *repository.TradeRepository
	charRepo     *repository.CharacterRepository
	itemRepo     *repository.ItemRepository
	campaignRepo *repository.CampaignRepository
}

func NewTradeService(tradeRepo *repository.TradeRepository, charRepo *repository.CharacterRepository, itemRepo *repository.ItemRepository, campaignRepo *repository.CampaignRepository) *TradeService {
	return &TradeService{tradeRepo: tradeRepo, charRepo: charRepo, itemRepo: itemRepo, campaignRepo: campaignRepo}
}

func (s *TradeService) CreateOffer(ctx context.Context, offerorCharID, userID int64, isGM bool, req *domain.CreateTradeRequest) (*domain.TradeOffer, error) {
	offeror, err := s.charRepo.GetByID(ctx, offerorCharID)
	if err != nil || offeror == nil {
		return nil, ErrNotFound
	}

	if !isGM && offeror.UserID != userID {
		return nil, ErrForbidden
	}

	// Validate gold
	if req.OfferedGold > offeror.Gold {
		return nil, ErrInsufficientGold
	}

	// Validate items are tradeable and not locked
	if len(req.OfferedItemIDs) > 0 {
		items, err := s.itemRepo.GetByIDs(ctx, req.OfferedItemIDs)
		if err != nil {
			return nil, err
		}
		for _, item := range items {
			if item.CharacterID != offerorCharID {
				return nil, ErrItemNotOwned
			}
			if !item.IsTradeable {
				return nil, ErrItemNotTradeable
			}
			if item.QuestBound {
				return nil, ErrItemQuestBound
			}
			if item.TradeLocked {
				return nil, ErrTradeConflict
			}
		}
	}

	// Validate requested gold doesn't exceed offeror's balance (for gold-only transfers from recipient side handled in accept)
	// Actually no, this is the offeror's offer — they are offering gold and requesting items
	// The offeror needs to have the gold they're offering

	offer := &domain.TradeOffer{
		CampaignID:           offeror.CampaignID,
		OfferorCharacterID:   offerorCharID,
		RecipientCharacterID: req.RecipientCharacterID,
		OfferedGold:          req.OfferedGold,
		Status:               domain.TradePending,
		ExpiresAt:            time.Now().Add(10 * time.Minute),
	}

	// Convert item IDs to JSON for storage
	offer.OfferedItemIDs = intSliceToJSON(req.OfferedItemIDs)
	offer.RequestedItemIDs = intSliceToJSON(req.RequestedItemIDs)

	if err := s.tradeRepo.Create(ctx, offer); err != nil {
		return nil, err
	}

	// Lock offered items
	if err := s.itemRepo.LockItemsForTrade(ctx, req.OfferedItemIDs, true); err != nil {
		return nil, err
	}

	return offer, nil
}

func (s *TradeService) AcceptTrade(ctx context.Context, tradeID, userID int64, isGM bool) (*domain.TradeOffer, error) {
	offer, err := s.tradeRepo.GetByID(ctx, tradeID)
	if err != nil || offer == nil {
		return nil, ErrNotFound
	}

	if offer.Status != domain.TradePending {
		return nil, errors.New("trade is no longer pending")
	}

	if time.Now().After(offer.ExpiresAt) {
		return nil, errors.New("trade offer has expired")
	}

	recipient, err := s.charRepo.GetByID(ctx, offer.RecipientCharacterID)
	if err != nil || recipient == nil {
		return nil, ErrNotFound
	}

	// Only recipient or GM can accept
	if !isGM && recipient.UserID != userID {
		return nil, ErrForbidden
	}

	// Verify offeror's gold still available
	offeror, err := s.charRepo.GetByID(ctx, offer.OfferorCharacterID)
	if err != nil || offeror == nil {
		return nil, ErrNotFound
	}

	if offer.OfferedGold > offeror.Gold {
		return nil, ErrInsufficientGold
	}

	// Verify offered items still available and unlocked
	offeredItemIDs := jsonToIntSlice(offer.OfferedItemIDs)
	if len(offeredItemIDs) > 0 {
		items, err := s.itemRepo.GetByIDs(ctx, offeredItemIDs)
		if err != nil || len(items) != len(offeredItemIDs) {
			return nil, ErrTradeConflict
		}
		for _, item := range items {
			if item.TradeLocked == false || item.CharacterID != offer.OfferorCharacterID {
				return nil, ErrTradeConflict
			}
		}
	}

	// Execute atomic transfer
	if err := s.executeTransfer(ctx, offer, offeror, recipient); err != nil {
		return nil, err
	}

	offer.Status = domain.TradeAccepted
	if err := s.tradeRepo.UpdateStatus(ctx, tradeID, domain.TradeAccepted); err != nil {
		return nil, err
	}

	return offer, nil
}

func (s *TradeService) executeTransfer(ctx context.Context, offer *domain.TradeOffer, offeror, recipient *domain.Character) error {
	// Transfer gold: deduct from offeror, add to recipient
	if err := s.charRepo.UpdateGold(ctx, offeror.ID, offeror.Gold-offer.OfferedGold); err != nil {
		return err
	}
	if err := s.charRepo.UpdateGold(ctx, recipient.ID, recipient.Gold+offer.OfferedGold); err != nil {
		// Rollback offeror's gold
		s.charRepo.UpdateGold(ctx, offeror.ID, offeror.Gold)
		return err
	}

	// Transfer gold in reverse direction (recipient offering gold to offeror)
	requestedGold := parseIntFromJSON(offer.RequestedGold)
	if requestedGold > 0 {
		if err := s.charRepo.UpdateGold(ctx, recipient.ID, recipient.Gold-requestedGold); err != nil {
			return err
		}
		if err := s.charRepo.UpdateGold(ctx, offeror.ID, offeror.Gold+requestedGold); err != nil {
			s.charRepo.UpdateGold(ctx, recipient.ID, recipient.Gold+requestedGold)
			return err
		}
	}

	// Transfer items: offeror -> recipient
	offeredItemIDs := jsonToIntSlice(offer.OfferedItemIDs)
	if len(offeredItemIDs) > 0 {
		if err := s.itemRepo.TransferItems(ctx, offeredItemIDs, offeror.ID, recipient.ID); err != nil {
			return err
		}
	}

	// Transfer items: recipient -> offeror
	requestedItemIDs := jsonToIntSlice(offer.RequestedItemIDs)
	if len(requestedItemIDs) > 0 {
		if err := s.itemRepo.TransferItems(ctx, requestedItemIDs, recipient.ID, offeror.ID); err != nil {
			return err
		}
	}

	return nil
}

func (s *TradeService) RejectTrade(ctx context.Context, tradeID, userID int64, isGM bool) error {
	offer, err := s.tradeRepo.GetByID(ctx, tradeID)
	if err != nil || offer == nil {
		return ErrNotFound
	}

	if offer.Status != domain.TradePending {
		return errors.New("trade is no longer pending")
	}

	recipient, _ := s.charRepo.GetByID(ctx, offer.RecipientCharacterID)
	if !isGM && recipient != nil && recipient.UserID != userID {
		return ErrForbidden
	}

	// Release item locks
	offeredItemIDs := jsonToIntSlice(offer.OfferedItemIDs)
	s.itemRepo.LockItemsForTrade(ctx, offeredItemIDs, false)

	return s.tradeRepo.UpdateStatus(ctx, tradeID, domain.TradeRejected)
}

func (s *TradeService) CancelTrade(ctx context.Context, tradeID, userID int64, isGM bool) error {
	offer, err := s.tradeRepo.GetByID(ctx, tradeID)
	if err != nil || offer == nil {
		return ErrNotFound
	}

	if offer.Status != domain.TradePending {
		return errors.New("trade is no longer pending")
	}

	offeror, _ := s.charRepo.GetByID(ctx, offer.OfferorCharacterID)
	if !isGM && offeror != nil && offeror.UserID != userID {
		return ErrForbidden
	}

	// Release item locks
	offeredItemIDs := jsonToIntSlice(offer.OfferedItemIDs)
	s.itemRepo.LockItemsForTrade(ctx, offeredItemIDs, false)

	return s.tradeRepo.UpdateStatus(ctx, tradeID, domain.TradeCancelled)
}

func (s *TradeService) ExpireStaleTrades(ctx context.Context) error {
	stale, err := s.tradeRepo.GetExpiredPending(ctx)
	if err != nil {
		return err
	}

	for _, offer := range stale {
		offeredItemIDs := jsonToIntSlice(offer.OfferedItemIDs)
		s.itemRepo.LockItemsForTrade(ctx, offeredItemIDs, false)
		s.tradeRepo.UpdateStatus(ctx, offer.ID, domain.TradeExpired)
	}

	return nil
}

func intSliceToJSON(ids []int64) string {
	if len(ids) == 0 {
		return "[]"
	}
	result := "["
	for i, id := range ids {
		if i > 0 {
			result += ","
		}
		result += formatInt64(id)
	}
	return result + "]"
}

func jsonToIntSlice(json string) []int64 {
	if json == "" || json == "[]" {
		return nil
	}
	// Simple JSON parsing without external lib
	ids := []int64{}
	start := false
	num := ""
	for _, c := range json {
		if c == '[' {
			start = true
			continue
		}
		if start {
			if c >= '0' && c <= '9' {
				num += string(c)
			} else if c == ',' || c == ']' {
				if num != "" {
					ids = append(ids, parseInt64(num))
					num = ""
				}
			}
		}
	}
	return ids
}

func parseInt64(s string) int64 {
	var v int64
	for _, c := range s {
		v = v*10 + int64(c-'0')
	}
	return v
}

func formatInt64(n int64) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append(digits, byte('0'+n%10))
		n /= 10
	}
	for i, j := 0, len(digits)-1; i < j; i, j = i+1, j-1 {
		digits[i], digits[j] = digits[j], digits[i]
	}
	return string(digits)
}

func parseIntFromJSON(v interface{}) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	}
	return 0
}