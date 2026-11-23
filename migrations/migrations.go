package migrations

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/pressly/goose/v3"
)

// Only versioned files: setup.sql is the legacy bootstrap script, not a goose migration.
//
//go:embed 0*.sql
var files embed.FS

func Up(ctx context.Context, db *sql.DB) error {
	return run(ctx, db, false)
}

func Down(ctx context.Context, db *sql.DB) error {
	return run(ctx, db, true)
}

func run(ctx context.Context, db *sql.DB, down bool) error {
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("configure migrations: %w", err)
	}
	goose.SetBaseFS(files)

	var legacy bool
	if err := db.QueryRowContext(ctx, `SELECT EXISTS (
		SELECT 1 FROM schema_migrations WHERE version = 'setup.sql'
	)`).Scan(&legacy); err != nil {
		legacy = false
	}

	if legacy {
		if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS goose_db_version (
			id BIGSERIAL PRIMARY KEY,
			version_id BIGINT NOT NULL,
			is_applied BOOLEAN NOT NULL,
			tstamp TIMESTAMP NOT NULL DEFAULT NOW()
		)`); err != nil {
			return fmt.Errorf("create migration history: %w", err)
		}
		// setup.sql covered 001–007; later files applied by the legacy runner are
		// recorded by name in schema_migrations ("008_srd_reference_data.sql", ...).
		versions := []int64{1, 2, 3, 4, 5, 6, 7}
		rows, err := db.QueryContext(ctx, `SELECT version FROM schema_migrations`)
		if err == nil {
			for rows.Next() {
				var name string
				if rows.Scan(&name) == nil {
					var v int64
					if _, scanErr := fmt.Sscanf(name, "%d_", &v); scanErr == nil && v > 0 {
						versions = append(versions, v)
					}
				}
			}
			_ = rows.Close()
		}
		for _, version := range versions {
			if _, err := db.ExecContext(ctx, `INSERT INTO goose_db_version(version_id, is_applied)
				SELECT $1, TRUE WHERE NOT EXISTS (SELECT 1 FROM goose_db_version WHERE version_id=$1 AND is_applied=TRUE)`, version); err != nil {
				return fmt.Errorf("baseline migration %d: %w", version, err)
			}
		}
	}
	if down {
		if err := goose.DownContext(ctx, db, "."); err != nil {
			return fmt.Errorf("roll back migration: %w", err)
		}
		return nil
	}
	if err := goose.UpContext(ctx, db, "."); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
