package foundry

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"dnd-campaign-manager/internal/config"
)

func newTestClient(url string, retries int) *Client {
	c := New(config.FoundryConfig{RelayBaseURL: url, APIKey: "k", ClientID: "w", MaxRetries: retries})
	c.retries = retries
	c.backoff = func(int) time.Duration { return time.Millisecond }
	return c
}

func TestDoRetriesTransientFailures(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) < 3 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		_, _ = w.Write([]byte(`{"results":[]}`))
	}))
	defer srv.Close()
	if _, err := newTestClient(srv.URL, 3).Search(context.Background(), SearchOpts{DocumentType: "Actor"}); err != nil {
		t.Fatalf("expected success after retries: %v", err)
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("calls = %d, want 3", got)
	}
}

func TestDoDoesNotRetryClientErrorsAndIsBounded(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()
	if _, err := newTestClient(srv.URL, 3).Get(context.Background(), "x"); err == nil {
		t.Fatal("expected error")
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("404 retried: calls = %d", got)
	}

	atomic.StoreInt32(&calls, 0)
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer down.Close()
	if err := newTestClient(down.URL, 2).Health(context.Background()); err == nil {
		t.Fatal("expected error")
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("calls = %d, want 3 (1 + 2 retries)", got)
	}
}
