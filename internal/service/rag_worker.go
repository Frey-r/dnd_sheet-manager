package service

import (
	"context"
	"errors"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/domain"
)

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
	Sources []string
	Err     error
}
type loreWork struct {
	ctx         context.Context
	query       *LoreQuery
	vectorizeID int64
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
		size = 2
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
						_ = pool.rag.VectorizeLoreEntry(ctx, job.vectorizeID)
						cancel()
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
		return errors.New("lore worker queue full")
	}
}

func (p *LoreWorkerPool) Query(ctx context.Context, query LoreQuery) <-chan LoreResult {
	result := make(chan LoreResult, 1)
	select {
	case p.jobs <- loreWork{ctx: ctx, query: &query, result: result}:
	default:
		result <- LoreResult{Err: errors.New("lore worker queue full")}
	}
	return result
}

func (p *LoreWorkerPool) Close() { close(p.done) }
