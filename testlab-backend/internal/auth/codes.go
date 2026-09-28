package auth

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const oauthCodeTTL = 60 * time.Second

func IssueOAuthCode(ctx context.Context, db *pgxpool.Pool, userID int64, clientID, redirectURI, codeChallenge string) (string, error) {
	code, err := GenerateState()
	if err != nil {
		return "", err
	}

	_, err = db.Exec(ctx, `
		INSERT INTO oauth_codes (code, user_id, client_id, redirect_uri, code_challenge, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, code, userID, clientID, redirectURI, codeChallenge, time.Now().Add(oauthCodeTTL))
	if err != nil {
		return "", err
	}

	return code, nil
}

type OAuthCode struct {
	UserID        int64
	ClientID      string
	RedirectURI   string
	CodeChallenge string
}

func GetAndDeleteOAuthCode(ctx context.Context, db *pgxpool.Pool, code string) (*OAuthCode, error) {
	var oc OAuthCode
	var expiresAt time.Time

	err := db.QueryRow(ctx, `
		DELETE FROM oauth_codes
		WHERE code = $1
		RETURNING user_id, client_id, redirect_uri, code_challenge, expires_at
	`, code).Scan(&oc.UserID, &oc.ClientID, &oc.RedirectURI, &oc.CodeChallenge, &expiresAt)

	if err != nil {
		return nil, err
	}
	if time.Now().After(expiresAt) {
		return nil, pgx.ErrNoRows // treat an expired code the same as "not found"
	}

	return &oc, nil
}
