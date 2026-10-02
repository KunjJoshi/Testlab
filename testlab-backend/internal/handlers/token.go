package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
)

type TokenHandler struct {
	DB *pgxpool.Pool
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

func (h *TokenHandler) Token(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeTokenError(w, "invalid_request", "failed to parse form body")
		return
	}

	grantType := r.PostForm.Get("grant_type")
	code := r.PostForm.Get("code")
	redirectURI := r.PostForm.Get("redirect_uri")
	clientID := r.PostForm.Get("client_id")
	codeVerifier := r.PostForm.Get("code_verifier")

	if grantType != "authorization_code" {
		writeTokenError(w, "unsupported_grant_type", "only authorization_code is supported")
		return
	}
	if code == "" || redirectURI == "" || clientID == "" || codeVerifier == "" {
		writeTokenError(w, "invalid_request", "code, redirect_uri, client_id, and code_verifier are all required")
		return
	}

	oauthCode, err := auth.GetAndDeleteOAuthCode(r.Context(), h.DB, code)
	if err == pgx.ErrNoRows {
		writeTokenError(w, "invalid_grant", "code is invalid, expired, or already used")
		return
	}
	if err != nil {
		writeTokenError(w, "server_error", err.Error())
		return
	}

	if oauthCode.ClientID != clientID {
		writeTokenError(w, "invalid_grant", "client_id does not match the one used to obtain this code")
		return
	}
	if oauthCode.RedirectURI != redirectURI {
		writeTokenError(w, "invalid_grant", "redirect_uri does not match the one used to obtain this code")
		return
	}
	if !auth.VerifyPKCE(codeVerifier, oauthCode.CodeChallenge) {
		writeTokenError(w, "invalid_grant", "code_verifier does not match code_challenge")
		return
	}

	jwtStr, err := auth.IssueToken(oauthCode.UserID)
	if err != nil {
		writeTokenError(w, "server_error", "failed to issue access token")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokenResponse{
		AccessToken: jwtStr,
		TokenType:   "Bearer",
		ExpiresIn:   int(auth.TokenTTL.Seconds()),
	})
}

func writeTokenError(w http.ResponseWriter, errorCode, description string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(map[string]string{
		"error":             errorCode,
		"error_description": description,
	})
}
