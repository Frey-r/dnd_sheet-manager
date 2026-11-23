package service

import (
	"context"
	"errors"
	"testing"

	"dnd-campaign-manager/internal/foundry"
)

// fakeStore emulates a transactional store: writes are staged and only visible
// (committed) when the callback succeeds.
type fakeStore struct{ committed []string }

type fakeTx struct{ staged []string }

func (s *fakeStore) inTx(_ context.Context, fn func(*fakeTx) error) error {
	tx := &fakeTx{}
	if err := fn(tx); err != nil {
		return err // rollback: staged writes dropped
	}
	s.committed = append(s.committed, tx.staged...)
	return nil
}

func TestSyncReferenceType(t *testing.T) {
	docs := func(names ...string) func(context.Context) ([]*foundry.Document, error) {
		return func(context.Context) ([]*foundry.Document, error) {
			out := make([]*foundry.Document, 0, len(names))
			for _, n := range names {
				out = append(out, &foundry.Document{Name: n})
			}
			return out, nil
		}
	}
	boom := errors.New("boom")
	tests := []struct {
		name      string
		fetch     func(context.Context) ([]*foundry.Document, error)
		failOn    string
		wantN     int
		wantErr   bool
		wantStore int
	}{
		{"all written", docs("a", "b", "c"), "", 3, false, 3},
		{"empty type", docs(), "", 0, false, 0},
		{"upsert failure rolls back whole type", docs("a", "b", "c"), "c", 0, true, 0},
		{"fetch failure writes nothing", func(context.Context) ([]*foundry.Document, error) { return nil, boom }, "", 0, true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			st := &fakeStore{}
			n, err := syncReferenceType(context.Background(), tt.fetch, st.inTx, func(tx *fakeTx, d *foundry.Document) error {
				if d.Name == tt.failOn {
					return boom
				}
				tx.staged = append(tx.staged, d.Name)
				return nil
			})
			if (err != nil) != tt.wantErr || n != tt.wantN || len(st.committed) != tt.wantStore {
				t.Fatalf("n=%d err=%v committed=%v; want n=%d err=%v committed=%d", n, err, st.committed, tt.wantN, tt.wantErr, tt.wantStore)
			}
		})
	}
}

func TestFailedTypeDoesNotStopOthers(t *testing.T) {
	st := &fakeStore{}
	counts, errs := map[string]int{}, []string{}
	fetch := func(context.Context) ([]*foundry.Document, error) {
		return []*foundry.Document{{Name: "x"}, {Name: "bad"}}, nil
	}
	good := func(context.Context) ([]*foundry.Document, error) { return []*foundry.Document{{Name: "ok"}}, nil }
	apply := func(tx *fakeTx, d *foundry.Document) error {
		if d.Name == "bad" {
			return errors.New("constraint")
		}
		tx.staged = append(tx.staged, d.Name)
		return nil
	}
	n, err := syncReferenceType(context.Background(), fetch, st.inTx, apply)
	recordReferenceResult(counts, &errs, "spells", n, err)
	n, err = syncReferenceType(context.Background(), good, st.inTx, apply)
	recordReferenceResult(counts, &errs, "classes", n, err)

	if len(errs) != 1 || counts["classes"] != 1 || counts["spells"] != 0 {
		t.Fatalf("counts=%v errs=%v", counts, errs)
	}
	if len(st.committed) != 1 || st.committed[0] != "ok" {
		t.Fatalf("committed=%v", st.committed)
	}
}
