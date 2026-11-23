package service

import (
	"context"
	"errors"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

var (
	ErrInsufficientGold = repository.ErrInsufficientGold
	ErrItemNotTradeable = repository.ErrTradeItem
	ErrItemQuestBound   = repository.ErrTradeItem
	ErrItemNotOwned     = repository.ErrTradeItem
	ErrTradeConflict    = repository.ErrTradeItem
	ErrTradeInvalidated = repository.ErrTradeInvalidated
	// ErrCounterRecipient: a counter-offer must go back to the original offeror.
	ErrCounterRecipient = errors.New("counter-offer must be addressed to the original offeror")
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
	recipient, err := s.charRepo.GetByID(ctx, req.RecipientCharacterID)
	if err != nil || recipient == nil || recipient.CampaignID != offeror.CampaignID || recipient.ID == offeror.ID {
		return nil, ErrNotFound
	}
	role, err := s.campaignRepo.GetMemberRole(ctx, offeror.CampaignID, userID)
	if !mayActOnTrade(role, err, offeror.UserID, userID) {
		return nil, ErrForbidden
	}
	return s.tradeRepo.CreateTransactional(ctx, offeror, recipient, req)
}

func (s *TradeService) authorizeOffer(ctx context.Context, tradeID, userID int64, offeror bool) (*domain.TradeOffer, error) {
	offer, err := s.tradeRepo.GetByID(ctx, tradeID)
	if err != nil || offer == nil {
		return nil, ErrNotFound
	}
	characterID := offer.RecipientCharacterID
	if offeror {
		characterID = offer.OfferorCharacterID
	}
	character, err := s.charRepo.GetByID(ctx, characterID)
	if err != nil || character == nil {
		return nil, ErrNotFound
	}
	role, err := s.campaignRepo.GetMemberRole(ctx, offer.CampaignID, userID)
	if !mayActOnTrade(role, err, character.UserID, userID) {
		return nil, ErrForbidden
	}
	return offer, nil
}

// mayActOnTrade: only the campaign member who owns the character may create, accept, reject,
// cancel or counter a trade. The GM sees every trade but is read-only (security.md), so the
// GM role grants nothing here.
func mayActOnTrade(role string, roleErr error, ownerID, userID int64) bool {
	return roleErr == nil && role != "" && ownerID == userID
}

func (s *TradeService) AcceptTrade(ctx context.Context, tradeID, userID int64, isGM bool) (*domain.TradeOffer, error) {
	if _, err := s.authorizeOffer(ctx, tradeID, userID, false); err != nil {
		return nil, err
	}
	return s.tradeRepo.AcceptTransactional(ctx, tradeID)
}

func (s *TradeService) RejectTrade(ctx context.Context, tradeID, userID int64, isGM bool) error {
	if _, err := s.authorizeOffer(ctx, tradeID, userID, false); err != nil {
		return err
	}
	_, err := s.tradeRepo.FinishTransactional(ctx, tradeID, domain.TradeRejected)
	return err
}

func (s *TradeService) CancelTrade(ctx context.Context, tradeID, userID int64, isGM bool) error {
	if _, err := s.authorizeOffer(ctx, tradeID, userID, true); err != nil {
		return err
	}
	_, err := s.tradeRepo.FinishTransactional(ctx, tradeID, domain.TradeCancelled)
	return err
}

func (s *TradeService) List(ctx context.Context, userID int64) ([]domain.TradeOffer, error) {
	return s.tradeRepo.ListForUser(ctx, userID)
}

func (s *TradeService) CounterOffer(ctx context.Context, tradeID, userID int64, req *domain.CreateTradeRequest) (*domain.TradeOffer, error) {
	original, err := s.authorizeOffer(ctx, tradeID, userID, false)
	if err != nil {
		return nil, err
	}
	if req.RecipientCharacterID != original.OfferorCharacterID {
		return nil, ErrCounterRecipient
	}
	// Rejecting the original and filing the counter is one transaction: a counter that
	// fails (gold, items) leaves the original offer pending.
	offeror, err := s.charRepo.GetByID(ctx, original.RecipientCharacterID)
	if err != nil || offeror == nil {
		return nil, ErrNotFound
	}
	recipient, err := s.charRepo.GetByID(ctx, req.RecipientCharacterID)
	if err != nil || recipient == nil || recipient.CampaignID != offeror.CampaignID || recipient.ID == offeror.ID {
		return nil, ErrNotFound
	}
	return s.tradeRepo.CounterTransactional(ctx, tradeID, offeror, recipient, req)
}

func (s *TradeService) ExpireStaleTrades(ctx context.Context) error {
	stale, err := s.tradeRepo.GetExpiredPending(ctx)
	if err != nil {
		return err
	}
	for _, offer := range stale {
		if _, err := s.tradeRepo.FinishTransactional(ctx, offer.ID, domain.TradeExpired); err != nil && !errors.Is(err, repository.ErrTradeUnavailable) {
			return err
		}
	}
	return nil
}

func (s *TradeService) Purchase(ctx context.Context, campaignID, itemID, characterID, userID int64) error {
	character, err := s.charRepo.GetByID(ctx, characterID)
	if err != nil || character == nil || character.CampaignID != campaignID {
		return ErrNotFound
	}
	role, err := s.campaignRepo.GetMemberRole(ctx, campaignID, userID)
	if err != nil || (role != domain.RoleGM && character.UserID != userID) {
		return ErrForbidden
	}
	return s.tradeRepo.Purchase(ctx, campaignID, itemID, characterID)
}
