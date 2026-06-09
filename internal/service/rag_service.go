package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"
)

type RAGService struct {
	ollamaConfig config.OllamaConfig
	loreRepo     *repository.LoreRepository
	charRepo     *repository.CharacterRepository
}

func NewRAGService(ollamaConfig config.OllamaConfig, loreRepo *repository.LoreRepository, charRepo *repository.CharacterRepository) *RAGService {
	return &RAGService{ollamaConfig: ollamaConfig, loreRepo: loreRepo, charRepo: charRepo}
}

type EmbeddingRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type EmbeddingResponse struct {
	Embeddings [][]float32 `json:"embeddings"`
}

type GenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type GenerateResponse struct {
	Response string `json:"response"`
}

func (s *RAGService) GetEmbedding(ctx context.Context, text string) ([]float32, error) {
	reqBody := EmbeddingRequest{
		Model: s.ollamaConfig.EmbeddingModel,
		Input: text,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.ollamaConfig.BaseURL+"/api/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: s.ollamaConfig.TimeoutDuration()}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama embedding error: status %d", resp.StatusCode)
	}

	var embResp EmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embResp); err != nil {
		return nil, err
	}

	if len(embResp.Embeddings) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	return embResp.Embeddings[0], nil
}

func (s *RAGService) GenerateResponse(ctx context.Context, prompt string) (string, error) {
	reqBody := GenerateRequest{
		Model:  s.ollamaConfig.LLMModel,
		Prompt: prompt,
		Stream: false,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.ollamaConfig.BaseURL+"/api/generate", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: s.ollamaConfig.TimeoutDuration() * 3}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama generate error: status %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	var genResp GenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&genResp); err != nil {
		return "", err
	}

	return genResp.Response, nil
}

func (s *RAGService) VectorizeLoreEntry(ctx context.Context, entryID int64) error {
	entry, err := s.loreRepo.GetByID(ctx, entryID)
	if err != nil || entry == nil {
		return ErrNotFound
	}

	embedding, err := s.GetEmbedding(ctx, entry.ContentText)
	if err != nil {
		return err
	}

	return s.loreRepo.UpdateVector(ctx, entryID, embedding)
}

func (s *RAGService) Query(ctx context.Context, campaignID int64, characterID *int64, userID int64, isGM bool, loreTier domain.LoreTier, query string) (string, []string, error) {
	// Get query embedding
	queryEmbedding, err := s.GetEmbedding(ctx, query)
	if err != nil {
		return "", nil, err
	}

	// Determine which lore tier to search based on role
	searchTier := loreTier
	if !isGM && loreTier == domain.LoreTierGMHidden {
		searchTier = domain.LoreTierCampaignPlot // downgrade to campaign plot
	}

	// Search for relevant entries
	var entries []domain.LoreEntry
	if characterID != nil && searchTier == domain.LoreTierCharacter {
		// Character lore search — find character's lore entries
		charEntries, err := s.loreRepo.GetByCharacter(ctx, *characterID)
		if err != nil {
			return "", nil, err
		}
		entries = charEntries
	} else {
		entries, err = s.loreRepo.SearchByTier(ctx, campaignID, searchTier, queryEmbedding, 5)
		if err != nil {
			return "", nil, err
		}
	}

	if len(entries) == 0 {
		return "No se encontró información relevante en el lore.", nil, nil
	}

	// Build context from entries
	contextText := buildContextFromEntries(entries)
	sources := make([]string, len(entries))
	for i, entry := range entries {
		if entry.Title != "" {
			sources[i] = entry.Title
		} else {
			sources[i] = fmt.Sprintf("Entrada de lore #%d", entry.ID)
		}
	}

	// Build prompt with context
	systemPrompt := `Eres un asistente de Dungeons & Dragons. Usa ÚNICAMENTE la información proporcionada en el contexto para responder. Si la información del contexto no es suficiente, indica que no tienes esa información. No inventas detalles que no estén en el contexto. Responde en español.`

	userPrompt := fmt.Sprintf(`Contexto del lore de la campaña:
%s

Pregunta del jugador: %s

Responde basándote únicamente en el contexto proporcionado.`, contextText, query)

	fullPrompt := systemPrompt + "\n\n" + userPrompt

	response, err := s.GenerateResponse(ctx, fullPrompt)
	if err != nil {
		return "", nil, err
	}

	return response, sources, nil
}

func buildContextFromEntries(entries []domain.LoreEntry) string {
	var buf bytes.Buffer
	for i, entry := range entries {
		buf.WriteString(fmt.Sprintf("--- Entrada %d ---\n", i+1))
		if entry.Title != "" {
			buf.WriteString(fmt.Sprintf("Título: %s\n", entry.Title))
		}
		buf.WriteString(entry.ContentText)
		buf.WriteString("\n\n")
	}
	return buf.String()
}

func (s *RAGService) VectorizeCharacterBackstory(ctx context.Context, charID int64) error {
	char, err := s.charRepo.GetByID(ctx, charID)
	if err != nil || char == nil {
		return ErrNotFound
	}

	if char.BackstoryText == "" {
		return nil
	}

	// Create a lore entry for the character's backstory
	entry := &domain.LoreEntry{
		CampaignID:  char.CampaignID,
		CharacterID:  &charID,
		ContentText:  char.BackstoryText,
		LoreTier:    domain.LoreTierCharacter,
		Title:       fmt.Sprintf("Historia de %s", char.Name),
		ChapterOrder: 0,
	}

	// Check if lore entry already exists for this character
	existing, _ := s.loreRepo.GetByCharacter(ctx, charID)
	if len(existing) > 0 {
		// Update existing
		entry.ID = existing[0].ID
		return s.loreRepo.Update(ctx, entry)
	}

	if err := s.loreRepo.Create(ctx, entry); err != nil {
		return err
	}

	// Vectorize
	return s.VectorizeLoreEntry(ctx, entry.ID)
}