package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PendingAuthorization struct {
	CorrelationID string
	ClientID      string
	RedirectURI   string
	CodeChallenge string
	OriginalState string
}

const pendingAuthorizationTTL = 10 * time.Minute

func StorePendingAuthorization(ctx context.Context, db *pgxpool.Pool, clientID, redirectURI, codeChallenge, originalState string) (string, error) {
	correlationID, err := GenerateState()
	if err != nil {
		return "", err
	}

	_, err = db.Exec(ctx, `
	INSERT INTO pending_authorizations (correlation_id, client_id, redirect_uri, code_challenge, original_state, expires_at)
	VALUES($1, $2, $3, $4, $5, $6)
	`, correlationID, clientID, redirectURI, codeChallenge, originalState, time.Now().Add(pendingAuthorizationTTL))

	if err != nil {
		return "", err
	}

	return correlationID, nil
}

var ErrPendingAuthorizationNotFound = errors.New("pending authorization not found or already used")

func GetPendingAuthorization(ctx context.Context, db *pgxpool.Pool, correlationID string) (*PendingAuthorization, error) {

	var p PendingAuthorization
	var expiresAt time.Time

	err := db.QueryRow(ctx, `
	SELECT correlation_id, client_id, redirect_uri, code_challenge, original_state, expires_at
	FROM pending_authorizations
	WHERE correlation_id = $1
	`, correlationID).Scan(&p.CorrelationID, &p.ClientID, &p.RedirectURI, &p.CodeChallenge, &p.OriginalState, &expiresAt)

	if err == pgx.ErrNoRows {
		return nil, ErrPendingAuthorizationNotFound
	}
	if err != nil {
		return nil, err
	}
	if time.Now().After(expiresAt) {
		return nil, ErrPendingAuthorizationNotFound
	}

	return &p, nil
}

func DeletePendingAuthorization(ctx context.Context, db *pgxpool.Pool, correlationID string) error {
	_, err := db.Exec(ctx, `DELETE FROM pending_authorizations WHERE correlation_id = $1`, correlationID)
	return err
}
