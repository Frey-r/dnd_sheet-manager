package service

import (
	"context"
	"errors"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrForbidden      = errors.New("forbidden")
	ErrCampaignExists = errors.New("campaign with this code already exists")
	// ErrInvalidCover is returned for a cover image that is not an uploaded file or an http(s) URL.
	ErrInvalidCover = errors.New("la portada debe ser una imagen subida o una URL http(s)")
)

type CampaignService struct {
	campaignRepo *repository.CampaignRepository
	userRepo     *repository.UserRepository
}

func NewCampaignService(campaignRepo *repository.CampaignRepository, userRepo *repository.UserRepository) *CampaignService {
	return &CampaignService{campaignRepo: campaignRepo, userRepo: userRepo}
}

// ValidCoverURL accepts no cover, an uploaded file (/uploads/...) or an http(s) URL, so a
// cover can never carry a javascript: or data: URL.
func ValidCoverURL(raw string) bool {
	u := strings.TrimSpace(raw)
	lower := strings.ToLower(u)
	return u == "" || strings.HasPrefix(u, "/uploads/") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "http://")
}

func (s *CampaignService) Create(ctx context.Context, userID int64, req *domain.CreateCampaignRequest) (*domain.Campaign, error) {
	if req.GameMode == "" {
		req.GameMode = "local"
	}
	if !ValidCoverURL(req.CoverURL) {
		return nil, ErrInvalidCover
	}
	campaign := &domain.Campaign{
		Name:        req.Name,
		Description: req.Description,
		CoverURL:    strings.TrimSpace(req.CoverURL),
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
	if req.BastionSalePct != nil {
		campaign.BastionSalePct = *req.BastionSalePct
	}
	if req.CoverURL != nil {
		if !ValidCoverURL(*req.CoverURL) {
			return nil, ErrInvalidCover
		}
		campaign.CoverURL = strings.TrimSpace(*req.CoverURL)
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
