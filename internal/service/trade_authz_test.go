package service

import (
	"errors"
	"testing"

	"dnd-campaign-manager/internal/domain"
)

func TestMayActOnTrade(t *testing.T) {
	cases := []struct {
		name    string
		role    string
		err     error
		owner   int64
		user    int64
		allowed bool
	}{
		{"owner player", domain.RolePlayer, nil, 7, 7, true},
		{"other player", domain.RolePlayer, nil, 7, 8, false},
		{"gm is read-only on others' trades", domain.RoleGM, nil, 7, 1, false},
		{"gm acting with own character", domain.RoleGM, nil, 1, 1, true},
		{"not a member", "", nil, 7, 7, false},
		{"lookup error", domain.RolePlayer, errors.New("db down"), 7, 7, false},
	}
	for _, tc := range cases {
		if got := mayActOnTrade(tc.role, tc.err, tc.owner, tc.user); got != tc.allowed {
			t.Errorf("%s: got %v want %v", tc.name, got, tc.allowed)
		}
	}
}
