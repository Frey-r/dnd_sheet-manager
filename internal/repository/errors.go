package repository

import "errors"

var (
	ErrResourceNotFound     = errors.New("resource not found")
	ErrSpellSlotUnavailable = errors.New("no spell slots available")
	ErrResourceConflict     = errors.New("resource is locked or no longer available")
)
