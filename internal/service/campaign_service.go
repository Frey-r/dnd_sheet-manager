package service

import (
	"context"
	"errors"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrForbidden      = errors.New("forbidden")
	ErrCampaignExists = errors.New("campaign with this code already exists")
)

type CampaignService struct {
	campaignRepo *repository.CampaignRepository
	userRepo     *repository.UserRepository
}

func NewCampaignService(campaignRepo *repository.CampaignRepository, userRepo *repository.UserRepository) *CampaignService {
	return &CampaignService{campaignRepo: campaignRepo, userRepo: userRepo}
}

func (s *CampaignService) Create(ctx context.Context, userID int64, req *domain.CreateCampaignRequest) (*domain.Campaign, error) {
	if req.GameMode == "" {
		req.GameMode = "local"
	}
	campaign := &domain.Campaign{
		Name:        req.Name,
		Description: req.Description,
		JoinCode:    repository.GenerateJoinCode(),
		GMUserID:    userID,
		Status:      domain.CampaignActive,
		GameMode:    req.GameMode,
	}

	if err := s.campaignRepo.Create(ctx, campaign); err != nil {
		return nil, err
	}

	// GM is also a member
	if err := s.campaignRepo.AddMember(ctx, campaign.ID, userID, domain.RoleGM); err != nil {
		return nil, err
	}

	return campaign, nil
}

func (s *CampaignService) GetByID(ctx context.Context, campaignID, userID int64) (*domain.Campaign, error) {
	campaign, err := s.campaignRepo.GetByID(ctx, campaignID)
	if err != nil || campaign == nil {
		return nil, ErrNotFound
	}

	isMember, err := s.campaignRepo.IsMember(ctx, campaignID, userID)
	if err != nil || !isMember {
		return nil, ErrForbidden
	}

	return campaign, nil
}

func (s *CampaignService) ListByUser(ctx context.Context, userID int64) ([]domain.Campaign, error) {
	return s.campaignRepo.ListByUser(ctx, userID)
}

func (s *CampaignService) Update(ctx context.Context, campaignID, userID int64, req *domain.UpdateCampaignRequest) (*domain.Campaign, error) {
	campaign, err := s.campaignRepo.GetByID(ctx, campaignID)
	if err != nil || campaign == nil {
		return nil, ErrNotFound
	}

	role, err := s.campaignRepo.GetMemberRole(ctx, campaignID, userID)
	if err != nil || role != domain.RoleGM {
		return nil, ErrForbidden
	}

	if req.Name != nil {
		campaign.Name = *req.Name
	}
	if req.Description != nil {
		campaign.Description = *req.Description
	}
	if req.Status != nil {
		campaign.Status = *req.Status
	}

	if err := s.campaignRepo.Update(ctx, campaign); err != nil {
		return nil, err
	}

	return campaign, nil
}

func (s *CampaignService) Delete(ctx context.Context, campaignID, userID int64) error {
	campaign, err := s.campaignRepo.GetByID(ctx, campaignID)
	if err != nil || campaign == nil {
		return ErrNotFound
	}

	role, err := s.campaignRepo.GetMemberRole(ctx, campaignID, userID)
	if err != nil || role != domain.RoleGM {
		return ErrForbidden
	}

	return s.campaignRepo.Delete(ctx, campaignID)
}

func (s *CampaignService) Join(ctx context.Context, userID int64, joinCode string) (*domain.Campaign, error) {
	campaign, err := s.campaignRepo.GetByJoinCode(ctx, joinCode)
	if err != nil || campaign == nil {
		return nil, ErrNotFound
	}

	isMember, _ := s.campaignRepo.IsMember(ctx, campaign.ID, userID)
	if isMember {
		return campaign, nil // already a member
	}

	if err := s.campaignRepo.AddMember(ctx, campaign.ID, userID, domain.RolePlayer); err != nil {
		return nil, err
	}

	return campaign, nil
}

func (s *CampaignService) GetMembers(ctx context.Context, campaignID, userID int64) ([]domain.CampaignMember, error) {
	isMember, err := s.campaignRepo.IsMember(ctx, campaignID, userID)
	if err != nil || !isMember {
		return nil, ErrForbidden
	}
	return s.campaignRepo.GetMembers(ctx, campaignID)
}

func (s *CampaignService) GetMemberRole(ctx context.Context, campaignID, userID int64) (string, error) {
	return s.campaignRepo.GetMemberRole(ctx, campaignID, userID)
}

func (s *CampaignService) IsMember(ctx context.Context, campaignID, userID int64) (bool, error) {
	return s.campaignRepo.IsMember(ctx, campaignID, userID)
}

func (s *CampaignService) IsGM(ctx context.Context, campaignID, userID int64) bool {
	role, _ := s.campaignRepo.GetMemberRole(ctx, campaignID, userID)
	return role == domain.RoleGM
}
