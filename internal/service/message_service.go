package service

import (
	"context"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

type MessageService struct {
	msgRepo      *repository.MessageRepository
	campaignRepo *repository.CampaignRepository
	userRepo     *repository.UserRepository
}

func NewMessageService(msgRepo *repository.MessageRepository, campaignRepo *repository.CampaignRepository, userRepo *repository.UserRepository) *MessageService {
	return &MessageService{msgRepo: msgRepo, campaignRepo: campaignRepo, userRepo: userRepo}
}

func (s *MessageService) SendMessage(ctx context.Context, senderID, campaignID int64, isGM bool, req *domain.SendMessageRequest) (*domain.Message, error) {
	// Validate membership
	isMember, err := s.campaignRepo.IsMember(ctx, campaignID, senderID)
	if err != nil || !isMember {
		return nil, ErrForbidden
	}

	// GM can send broadcasts or direct messages
	// Players can only send player_direct messages
	if !isGM && (req.MessageType == domain.MessageTypeGMBroadcast || req.MessageType == domain.MessageTypeGMDirect) {
		return nil, ErrForbidden
	}

	msg := &domain.Message{
		CampaignID:   campaignID,
		SenderUserID: senderID,
		MessageType:  req.MessageType,
		Subject:      req.Subject,
		Body:         req.Body,
		IsRead:       false,
	}

	if req.RecipientUserID != nil {
		isMember, err := s.campaignRepo.IsMember(ctx, campaignID, *req.RecipientUserID)
		if err != nil || !isMember || *req.RecipientUserID == senderID {
			return nil, ErrForbidden
		}
		msg.RecipientUserID = req.RecipientUserID
	} else if req.MessageType != domain.MessageTypeGMBroadcast {
		return nil, ErrForbidden
	}

	if err := s.msgRepo.Create(ctx, msg); err != nil {
		return nil, err
	}

	return msg, nil
}

func (s *MessageService) GetConversations(ctx context.Context, campaignID, userID int64) ([]domain.Conversation, error) {
	return s.msgRepo.GetConversationsList(ctx, campaignID, userID)
}

func (s *MessageService) GetConversation(ctx context.Context, campaignID, userID, otherUserID int64, limit, offset int) ([]domain.Message, error) {
	return s.msgRepo.GetConversation(ctx, campaignID, userID, otherUserID, limit, offset)
}

func (s *MessageService) GetGMMessages(ctx context.Context, campaignID, userID int64, limit, offset int) ([]domain.Message, error) {
	return s.msgRepo.GetGMDirectMessages(ctx, campaignID, userID, limit, offset)
}

func (s *MessageService) MarkAsRead(ctx context.Context, userID int64) error {
	return s.msgRepo.MarkAsRead(ctx, userID)
}

func (s *MessageService) GetUnreadCount(ctx context.Context, userID int64) (int, error) {
	return s.msgRepo.GetUnreadCount(ctx, userID)
}

func (s *MessageService) GetPendingMessagesForUser(ctx context.Context, userID int64) ([]domain.Message, error) {
	// For offline message delivery on reconnect
	// This would need a more complex query - for now we rely on REST history
	return nil, nil
}
