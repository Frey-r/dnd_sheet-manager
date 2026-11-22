package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"dnd-campaign-manager/internal/config"
)

// A full queue must answer ErrLoreBusy (503 RAG_BUSY) for both Oracle queries and raw prompts.
func TestLoreWorkerPoolBusy(t *testing.T) {
	pool := &LoreWorkerPool{jobs: make(chan loreWork), done: make(chan struct{})} // no workers, no buffer
	if _, err := pool.GenerateResponse(context.Background(), "hola"); !errors.Is(err, ErrLoreBusy) {
		t.Fatalf("GenerateResponse: want ErrLoreBusy, got %v", err)
	}
	if r := <-pool.Query(context.Background(), LoreQuery{}); !errors.Is(r.Err, ErrLoreBusy) {
		t.Fatalf("Query: want ErrLoreBusy, got %v", r.Err)
	}
	if err := pool.Vectorize(1); !errors.Is(err, ErrLoreBusy) {
		t.Fatalf("Vectorize: want ErrLoreBusy, got %v", err)
	}
}

// Raw prompts run inside the pool: with no LLM reachable the worker's error comes back.
func TestLoreWorkerPoolGenerateResponseRunsInPool(t *testing.T) {
	rag := NewRAGService(config.OllamaConfig{BaseURL: "http://127.0.0.1:1", Timeout: 1}, nil, nil)
	pool := NewLoreWorkerPool(rag, config.WorkerConfig{})
	defer pool.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := pool.GenerateResponse(ctx, "hola"); err == nil || errors.Is(err, ErrLoreBusy) {
		t.Fatalf("want an LLM connection error, got %v", err)
	}
}

func TestLoreWorkerPoolDefaultSize(t *testing.T) {
	if DefaultLorePoolSize != 4 {
		t.Fatalf("resilience.md default pool size is 4, got %d", DefaultLorePoolSize)
	}
}
