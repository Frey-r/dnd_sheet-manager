package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"dnd-campaign-manager/internal/config"
)

// Regression: the client posted {"input"} to the legacy /api/embeddings, which expects
// {"prompt"} and answers an empty vector, so semantic lore search never worked.
func TestGetEmbeddingUsesEmbedEndpoint(t *testing.T) {
	ollama := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/embed" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["input"] != "hola" || body["model"] != "nomic-embed-text" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"embeddings": [][]float32{{0.1, 0.2, 0.3}}})
	}))
	defer ollama.Close()

	rag := NewRAGService(config.OllamaConfig{BaseURL: ollama.URL, EmbeddingModel: "nomic-embed-text", Timeout: 5}, nil, nil)
	got, err := rag.GetEmbedding(context.Background(), "hola")
	if err != nil {
		t.Fatalf("GetEmbedding: %v", err)
	}
	if len(got) != 3 || got[0] != 0.1 {
		t.Fatalf("embedding = %v, want [0.1 0.2 0.3]", got)
	}
}
