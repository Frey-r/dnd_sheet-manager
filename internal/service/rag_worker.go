package service

import (
	"context"
	"errors"
	"log"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/domain"
)

// ErrLoreBusy means every Oracle worker is busy and the queue is full (resilience.md):
// the caller answers 503 RAG_BUSY instead of the "no AI" error.
var ErrLoreBusy = errors.New("lore worker queue full")

// DefaultLorePoolSize is the worker count when worker.pool_size is not configured.
const DefaultLorePoolSize = 4

type LoreQuery struct {
	CampaignID  int64
	CharacterID *int64
	UserID      int64
	IsGM        bool
	Tier        domain.LoreTier
	Text        string
}

type LoreResult struct {
	Answer  string
	Sources []domain.LoreSource
	Err     error
}
type loreWork struct {
	ctx         context.Context
	query       *LoreQuery
	vectorizeID int64
	prompt      string // raw LLM prompt (bot test); answered in LoreResult.Answer
	result      chan LoreResult
}

type LoreWorkerPool struct {
	rag  *RAGService
	jobs chan loreWork
	done chan struct{}
}

func NewLoreWorkerPool(rag *RAGService, cfg config.WorkerConfig) *LoreWorkerPool {
	size, depth := cfg.PoolSize, cfg.QueueDepth
	if size < 1 {
		size = DefaultLorePoolSize
	}
	if depth < 1 {
		depth = 32
	}
	pool := &LoreWorkerPool{rag: rag, jobs: make(chan loreWork, depth), done: make(chan struct{})}
	for range size {
		go func() {
			for {
				select {
				case job := <-pool.jobs:
					if job.vectorizeID > 0 {
						ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
						if err := pool.rag.VectorizeLoreEntry(ctx, job.vectorizeID); err != nil {
							// Without this an Oracle with a broken embedding setup silently
							// falls back to keyword search forever.
							log.Printf("lore: vectorize entry %d: %v", job.vectorizeID, err)
						}
						cancel()
					} else if job.prompt != "" {
						answer, err := pool.rag.GenerateResponse(job.ctx, job.prompt)
						job.result <- LoreResult{Answer: answer, Err: err}
					} else if job.query != nil {
						answer, sources, err := pool.rag.Query(job.ctx, job.query.CampaignID, job.query.CharacterID, job.query.UserID, job.query.IsGM, job.query.Tier, job.query.Text)
						job.result <- LoreResult{Answer: answer, Sources: sources, Err: err}
					}
				case <-pool.done:
					return
				}
			}
		}()
	}
	return pool
}

func (p *LoreWorkerPool) Vectorize(id int64) error {
	select {
	case p.jobs <- loreWork{vectorizeID: id}:
		return nil
	default:
		return ErrLoreBusy
	}
}

func (p *LoreWorkerPool) Query(ctx context.Context, query LoreQuery) <-chan LoreResult {
	result := make(chan LoreResult, 1)
	select {
	case p.jobs <- loreWork{ctx: ctx, query: &query, result: result}:
	default:
		result <- LoreResult{Err: ErrLoreBusy}
	}
	return result
}

// GenerateResponse runs a raw LLM prompt through the same bounded pool as Oracle queries
// (resilience.md: every LLM call goes through the worker pool). It returns ErrLoreBusy when
// the queue is full and honours ctx while waiting for a worker.
func (p *LoreWorkerPool) GenerateResponse(ctx context.Context, prompt string) (string, error) {
	result := make(chan LoreResult, 1)
	select {
	case p.jobs <- loreWork{ctx: ctx, prompt: prompt, result: result}:
	default:
		return "", ErrLoreBusy
	}
	select {
	case r := <-result:
		return r.Answer, r.Err
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

func (p *LoreWorkerPool) Close() { close(p.done) }
