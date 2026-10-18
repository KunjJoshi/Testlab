package auth

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
)

var defaultEnvironmentSlugs = map[string]int{"local": 1, "dev": 2, "qa": 3, "prod": 4}

type execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func AddDefaultEnvironments(ctx context.Context, db execer, userID int64) error {
	for slug, rank := range defaultEnvironmentSlugs {
		if _, err := db.Exec(ctx, `
		INSERT INTO environment (slug, user_id, rank)
		VALUES ($1, $2, $3)
		`, slug, userID, rank); err != nil {
			return fmt.Errorf("failed to add default environment %q: %w", slug, err)
		}
	}
	return nil
}
