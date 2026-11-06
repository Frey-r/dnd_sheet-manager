package repository

import (
	"context"
	"database/sql"
	"dnd-campaign-manager/internal/domain"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type MessageRepository struct {
	db *sqlx.DB
}

func NewMessageRepository(db *sqlx.DB) *MessageRepository {
	return &MessageRepository{db: db}
}

func (r *MessageRepository) Create(ctx context.Context, m *domain.Message) error {
	query := `
		INSERT INTO messages (campaign_id, sender_user_id, recipient_user_id, message_type, subject, body, is_read)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`
	return r.db.QueryRowxContext(ctx, query,
		m.CampaignID, m.SenderUserID, m.RecipientUserID, m.MessageType, m.Subject, m.Body, m.IsRead,
	).Scan(&m.ID, &m.CreatedAt)
}

func (r *MessageRepository) GetByID(ctx context.Context, id int64) (*domain.Message, error) {
	var m domain.Message
	query := `SELECT * FROM messages WHERE id=$1`
	err := r.db.GetContext(ctx, &m, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &m, err
}

func (r *MessageRepository) GetConversation(ctx context.Context, campaignID, userID, otherUserID int64, limit, offset int) ([]domain.Message, error) {
	messages := []domain.Message{}
	query := `
		SELECT * FROM messages
		WHERE campaign_id=$1
			AND ((sender_user_id=$2 AND recipient_user_id=$3) OR (sender_user_id=$3 AND recipient_user_id=$2))
		ORDER BY created_at DESC
		LIMIT $4 OFFSET $5`
	err := r.db.SelectContext(ctx, &messages, query, campaignID, userID, otherUserID, limit, offset)
	return messages, err
}

func (r *MessageRepository) GetGMDirectMessages(ctx context.Context, campaignID, userID int64, limit, offset int) ([]domain.Message, error) {
	messages := []domain.Message{}
	query := `
		SELECT * FROM messages
		WHERE campaign_id=$1
			AND message_type IN ('gm_direct', 'gm_broadcast')
			AND (recipient_user_id=$2 OR recipient_user_id IS NULL)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`
	err := r.db.SelectContext(ctx, &messages, query, campaignID, userID, limit, offset)
	return messages, err
}

func (r *MessageRepository) GetUnreadCount(ctx context.Context, userID int64) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM messages WHERE recipient_user_id=$1 AND is_read=false`
	err := r.db.GetContext(ctx, &count, query, userID)
	return count, err
}

func (r *MessageRepository) MarkAsRead(ctx context.Context, userID int64) error {
	query := `UPDATE messages SET is_read=true WHERE recipient_user_id=$1 AND is_read=false`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *MessageRepository) GetConversationsList(ctx context.Context, campaignID, userID int64) ([]domain.Conversation, error) {
	conversations := []domain.Conversation{}
	query := `
		WITH latest AS (
			SELECT
				CASE
					WHEN sender_user_id = $2 THEN recipient_user_id
					ELSE sender_user_id
				END as other_user_id,
				MAX(created_at) as last_message_at
			FROM messages
			WHERE campaign_id = $1
				AND (sender_user_id = $2 OR recipient_user_id = $2)
			GROUP BY other_user_id
		)
		SELECT
			u.id as other_user_id,
			u.username as other_username,
			COALESCE(m.message_type, 'player_direct') as conversation_type,
			m.body as last_message,
			l.last_message_at
		FROM latest l
		JOIN users u ON l.other_user_id = u.id
		LEFT JOIN messages m ON m.id = (
			SELECT id FROM messages
			WHERE campaign_id = $1
				AND ((sender_user_id = $2 AND recipient_user_id = l.other_user_id)
					OR (sender_user_id = l.other_user_id AND recipient_user_id = $2))
			ORDER BY created_at DESC LIMIT 1
		)
		ORDER BY l.last_message_at DESC`
	err := r.db.SelectContext(ctx, &conversations, query, campaignID, userID)
	return conversations, err
}

// Trade repository
type TradeRepository struct {
	db *sqlx.DB
}

func NewTradeRepository(db *sqlx.DB) *TradeRepository {
	return &TradeRepository{db: db}
}

func (r *TradeRepository) Create(ctx context.Context, t *domain.TradeOffer) error {
	query := `
		INSERT INTO trade_offers (campaign_id, offeror_character_id, recipient_character_id,
			offered_item_ids, offered_gold, requested_item_ids, requested_gold, status, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at`
	offeredJSON, _ := json.Marshal(t.OfferedItemIDs)
	requestedJSON, _ := json.Marshal(t.RequestedItemIDs)
	return r.db.QueryRowxContext(ctx, query,
		t.CampaignID, t.OfferorCharacterID, t.RecipientCharacterID,
		string(offeredJSON), t.OfferedGold, string(requestedJSON), t.RequestedGold,
		t.Status, t.ExpiresAt,
	).Scan(&t.ID, &t.CreatedAt)
}

func (r *TradeRepository) GetByID(ctx context.Context, id int64) (*domain.TradeOffer, error) {
	var t domain.TradeOffer
	query := `SELECT * FROM trade_offers WHERE id=$1`
	err := r.db.GetContext(ctx, &t, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}

func (r *TradeRepository) UpdateStatus(ctx context.Context, id int64, status domain.TradeStatus) error {
	query := `UPDATE trade_offers SET status=$1 WHERE id=$2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *TradeRepository) GetPendingByRecipient(ctx context.Context, recipientCharID int64) ([]domain.TradeOffer, error) {
	offers := []domain.TradeOffer{}
	query := `SELECT * FROM trade_offers WHERE recipient_character_id=$1 AND status='pending' AND expires_at > $2`
	err := r.db.SelectContext(ctx, &offers, query, recipientCharID, time.Now())
	return offers, err
}

func (r *TradeRepository) GetExpiredPending(ctx context.Context) ([]domain.TradeOffer, error) {
	offers := []domain.TradeOffer{}
	query := `SELECT * FROM trade_offers WHERE status='pending' AND expires_at < $1`
	err := r.db.SelectContext(ctx, &offers, query, time.Now())
	return offers, err
}

// Lore repository
type LoreRepository struct {
	db *sqlx.DB
}

func NewLoreRepository(db *sqlx.DB) *LoreRepository {
	return &LoreRepository{db: db}
}

func (r *LoreRepository) Create(ctx context.Context, l *domain.LoreEntry) error {
	query := `
		INSERT INTO lore_entries (campaign_id, character_id, content_text, lore_tier, chapter_order, title)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowxContext(ctx, query,
		l.CampaignID, l.CharacterID, l.ContentText, l.LoreTier, l.ChapterOrder, l.Title,
	).Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
}

func (r *LoreRepository) Update(ctx context.Context, l *domain.LoreEntry) error {
	query := `UPDATE lore_entries SET content_text=$1, title=$2, chapter_order=$3, lore_tier=$4, updated_at=NOW() WHERE id=$5`
	_, err := r.db.ExecContext(ctx, query, l.ContentText, l.Title, l.ChapterOrder, l.LoreTier, l.ID)
	return err
}

func (r *LoreRepository) GetByID(ctx context.Context, id int64) (*domain.LoreEntry, error) {
	var l domain.LoreEntry
	query := `SELECT ` + loreCols + ` FROM lore_entries WHERE id=$1`
	err := r.db.GetContext(ctx, &l, query, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &l, err
}

// loreCols lists every lore_entries column except the pgvector embedding.
const loreCols = `id, campaign_id, character_id, content_text, lore_tier, chapter_order, title, foundry_uuid, is_foundry_orphan, created_at, updated_at`

func (r *LoreRepository) GetByCampaign(ctx context.Context, campaignID int64) ([]domain.LoreEntry, error) {
	entries := []domain.LoreEntry{}
	query := `SELECT ` + loreCols + ` FROM lore_entries WHERE campaign_id=$1 ORDER BY chapter_order, title`
	err := r.db.SelectContext(ctx, &entries, query, campaignID)
	return entries, err
}

func (r *LoreRepository) GetByCharacter(ctx context.Context, characterID int64) ([]domain.LoreEntry, error) {
	entries := []domain.LoreEntry{}
	query := `SELECT ` + loreCols + ` FROM lore_entries WHERE character_id=$1 ORDER BY created_at`
	err := r.db.SelectContext(ctx, &entries, query, characterID)
	return entries, err
}

func vectorLiteral(vector []float32) string {
	result := "["
	for i, value := range vector {
		if i > 0 {
			result += ","
		}
		result += fmt.Sprintf("%g", value)
	}
	return result + "]"
}

func (r *LoreRepository) ListVisible(ctx context.Context, campaignID, userID int64, isGM bool) ([]domain.LoreEntry, error) {
	entries := []domain.LoreEntry{}
	query := `SELECT ` + loreCols + ` FROM lore_entries WHERE campaign_id=$1 AND ($2 OR lore_tier='campaign_plot' OR character_id IN (SELECT id FROM characters WHERE user_id=$3 AND campaign_id=$1)) ORDER BY chapter_order,title`
	err := r.db.SelectContext(ctx, &entries, query, campaignID, isGM, userID)
	return entries, err
}

func (r *LoreRepository) SearchByTier(ctx context.Context, campaignID int64, tier domain.LoreTier, query []float32, limit int) ([]domain.LoreEntry, error) {
	entries := []domain.LoreEntry{}
	sqlQuery := `
		SELECT ` + loreCols + ` FROM lore_entries
		WHERE campaign_id=$1 AND lore_tier=$2 AND content_vector IS NOT NULL
		ORDER BY content_vector <=> $3::vector
		LIMIT $4`
	err := r.db.SelectContext(ctx, &entries, sqlQuery, campaignID, tier, vectorLiteral(query), limit)
	return entries, err
}

// SearchTextByTier is the no-AI fallback: Spanish full-text search over title and content,
// matching any of the given words (already sanitized), best rank first.
func (r *LoreRepository) SearchTextByTier(ctx context.Context, campaignID int64, tier domain.LoreTier, words []string, limit int) ([]domain.LoreEntry, error) {
	entries := []domain.LoreEntry{}
	if len(words) == 0 {
		return entries, nil
	}
	sqlQuery := `
		SELECT id, campaign_id, character_id, content_text, lore_tier, chapter_order, title,
		       foundry_uuid, is_foundry_orphan, created_at, updated_at
		FROM lore_entries,
		     to_tsquery('spanish', $3) AS q
		WHERE campaign_id=$1 AND lore_tier=$2
		  AND to_tsvector('spanish', coalesce(title, '') || ' ' || content_text) @@ q
		ORDER BY ts_rank(to_tsvector('spanish', coalesce(title, '') || ' ' || content_text), q) DESC, chapter_order
		LIMIT $4`
	err := r.db.SelectContext(ctx, &entries, sqlQuery, campaignID, tier, strings.Join(words, " | "), limit)
	return entries, err
}

func (r *LoreRepository) UpdateVector(ctx context.Context, id int64, vector []float32) error {
	query := `UPDATE lore_entries SET content_vector=$1::vector, updated_at=NOW() WHERE id=$2`
	_, err := r.db.ExecContext(ctx, query, vectorLiteral(vector), id)
	return err
}

func (r *LoreRepository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM lore_entries WHERE id=$1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
