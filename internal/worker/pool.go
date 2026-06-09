package worker

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Job struct {
	ID      string
	Payload interface{}
}

type Result struct {
	JobID   string
	Payload interface{}
	Error   error
}

type Worker struct {
	id      int
	jobChan chan Job
	resultChan chan Result
}

func (w *Worker) Run(ctx context.Context) {
	for {
		select {
		case job, ok := <-w.jobChan:
			if !ok {
				return
			}
			// Process job - overridden by pool
			w.resultChan <- Result{JobID: job.ID, Payload: nil}
		case <-ctx.Done():
			return
		}
	}
}

type Pool struct {
	workers    []*Worker
	jobQueue   chan Job
	resultChan chan Result
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	size       int
	queueDepth int
}

func NewPool(size, queueDepth int) *Pool {
	ctx, cancel := context.WithCancel(context.Background())
	pool := &Pool{
		workers:    make([]*Worker, size),
		jobQueue:   make(chan Job, queueDepth),
		resultChan: make(chan Result, queueDepth),
		ctx:        ctx,
		cancel:     cancel,
		size:       size,
		queueDepth: queueDepth,
	}

	for i := 0; i < size; i++ {
		w := &Worker{
			id:      i,
			jobChan: pool.jobQueue,
			resultChan: pool.resultChan,
		}
		pool.workers[i] = w
		pool.wg.Add(1)
		go func() {
			defer pool.wg.Done()
			w.Run(ctx)
		}()
	}

	return pool
}

func (p *Pool) Submit(job Job) error {
	select {
	case p.jobQueue <- job:
		return nil
	default:
		return fmt.Errorf("worker pool queue full")
	}
}

func (p *Pool) SubmitBlocking(job Job) error {
	select {
	case p.jobQueue <- job:
		return nil
	case <-time.After(5 * time.Second):
		return fmt.Errorf("worker pool timeout")
	}
}

func (p *Pool) Results() <-chan Result {
	return p.resultChan
}

func (p *Pool) Shutdown() {
	p.cancel()
	close(p.jobQueue)
	p.wg.Wait()
	close(p.resultChan)
}

func (p *Pool) Size() int {
	return p.size
}

func (p *Pool) QueueDepth() int {
	return p.queueDepth
}

func (p *Pool) ActiveWorkers() int {
	return p.size
}