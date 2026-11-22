package worker

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/service"
)

type RAGJob struct {
	Query      string
	CampaignID int64
	CharacterID *int64
	UserID     int64
	IsGM       bool
	LoreTier   string
	ResultChan chan RAGResult
}

type RAGResult struct {
	Answer  string
	Sources []domain.LoreSource
	Error   error
}

type RAGWorkerPool struct {
	pool     *Pool
	ragSvc   *service.RAGService
	timeout  time.Duration
}

func NewRAGWorkerPool(ragSvc *service.RAGService, ollamaCfg config.OllamaConfig, workerCfg config.WorkerConfig) *RAGWorkerPool {
	pool := NewPool(workerCfg.PoolSize, workerCfg.QueueDepth)
	return &RAGWorkerPool{
		pool:    pool,
		ragSvc:  ragSvc,
		timeout: ollamaCfg.TimeoutDuration(),
	}
}

func (wp *RAGWorkerPool) SubmitQuery(ctx context.Context, job RAGJob) {
	resultChan := make(chan RAGResult, 1)

	// Override worker run to handle RAG
	go wp.processRAGJob(ctx, job, resultChan)

	// Wait for result or timeout
	go func() {
		select {
		case result := <-resultChan:
			job.ResultChan <- result
		case <-time.After(wp.timeout):
			job.ResultChan <- RAGResult{Error: fmt.Errorf("RAG query timed out")}
		case <-ctx.Done():
			job.ResultChan <- RAGResult{Error: ctx.Err()}
		}
	}()
}

func (wp *RAGWorkerPool) processRAGJob(ctx context.Context, job RAGJob, resultChan chan RAGResult) {
	// Import domain for LoreTier
	answer, sources, err := wp.ragSvc.Query(ctx, job.CampaignID, job.CharacterID, job.UserID, job.IsGM, toLoreTier(job.LoreTier), job.Query)
	resultChan <- RAGResult{Answer: answer, Sources: sources, Error: err}
}

func toLoreTier(s string) domain.LoreTier {
	switch s {
	case "character_lore":
		return domain.LoreTierCharacter
	case "gm_hidden_lore":
		return domain.LoreTierGMHidden
	default:
		return domain.LoreTierCampaignPlot
	}
}

func init() {
	_ = log.Println
}

type TradeExpiryWorker struct {
	tradeSvc  *service.TradeService
	interval  time.Duration
	stopChan  chan struct{}
	wg        sync.WaitGroup
}

func NewTradeExpiryWorker(tradeSvc *service.TradeService, interval time.Duration) *TradeExpiryWorker {
	return &TradeExpiryWorker{
		tradeSvc: tradeSvc,
		interval: interval,
		stopChan: make(chan struct{}),
	}
}

func (w *TradeExpiryWorker) Start() {
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				ctx := context.Background()
				if err := w.tradeSvc.ExpireStaleTrades(ctx); err != nil {
					log.Printf("Trade expiry error: %v", err)
				}
			case <-w.stopChan:
				return
			}
		}
	}()
}

func (w *TradeExpiryWorker) Stop() {
	close(w.stopChan)
	w.wg.Wait()
}

var (
	_ sync.Locker = (*sync.Mutex)(nil)
)