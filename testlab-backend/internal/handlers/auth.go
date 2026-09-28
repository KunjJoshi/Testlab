package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

func (h *AuthHandler) GithubLogin(w http.ResponseWriter, r *http.Request) {
	state, err := auth.GenerateState()
	if err != nil {
		http.Error(w, "failed to start login", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: "oauth_state", Value: state, HttpOnly: true, Path: "/", MaxAge: 600,
	})
	http.Redirect(w, r, auth.GithubOAuthConfig().AuthCodeURL(state), http.StatusTemporaryRedirect)
}

func (h *AuthHandler) GithubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	pending, err := auth.GetPendingAuthorization(r.Context(), h.DB, state)
	if err == nil {
		h.handleCIMDCallback(w, r, code, pending)
		return
	}
	if !errors.Is(err, auth.ErrPendingAuthorizationNotFound) {
		http.Error(w, "failed to look up pending authorization: "+err.Error(), http.StatusInternalServerError)
		return
	}

	h.handleLegacyCallback(w, r, code, state)
}

func (h *AuthHandler) handleCIMDCallback(w http.ResponseWriter, r *http.Request, code string, pending *auth.PendingAuthorization) {
	userID, err := h.exchangeAndUpsertUser(r, code)
	if err != nil {
		http.Error(w, "failed to complete github login: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := auth.DeletePendingAuthorization(r.Context(), h.DB, pending.CorrelationID); err != nil {
		http.Error(w, "failed to finalize login: "+err.Error(), http.StatusInternalServerError)
		return
	}

	oauthCode, err := auth.IssueOAuthCode(r.Context(), h.DB, userID, pending.ClientID, pending.RedirectURI, pending.CodeChallenge)
	if err != nil {
		http.Error(w, "failed to issue authorization code: "+err.Error(), http.StatusInternalServerError)
		return
	}

	redirectURL, err := buildClientRedirectURL(pending.RedirectURI, oauthCode, pending.OriginalState)
	if err != nil {
		http.Error(w, "failed to build redirect: "+err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) handleLegacyCallback(w http.ResponseWriter, r *http.Request, code, state string) {
	cookie, err := r.Cookie("oauth_state")
	if err != nil || cookie.Value != state {
		http.Error(w, "invalid oauth state", http.StatusBadRequest)
		return
	}

	userID, err := h.exchangeAndUpsertUser(r, code)
	if err != nil {
		http.Error(w, "failed to complete github login: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jwtStr, err := auth.IssueToken(userID)
	if err != nil {
		http.Error(w, "failed to issue session token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": jwtStr})
}

func (h *AuthHandler) exchangeAndUpsertUser(r *http.Request, code string) (int64, error) {
	token, err := auth.GithubOAuthConfig().Exchange(r.Context(), code)
	if err != nil {
		return 0, fmt.Errorf("failed to exchange code: %w", err)
	}

	ghUser, err := auth.FetchGithubUser(r.Context(), token)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch github profile: %w", err)
	}

	var userID int64
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO users (username, email, github_user_id, github_access_token, avatar_url)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (github_user_id) DO UPDATE
		    SET github_access_token = EXCLUDED.github_access_token,
		        avatar_url = EXCLUDED.avatar_url,
		        username = EXCLUDED.username,
		        updated_at = NOW()
		RETURNING user_id
	`, ghUser.Login, ghUser.Email, fmt.Sprint(ghUser.ID), token.AccessToken, ghUser.AvatarURL).Scan(&userID)
	if err != nil {
		return 0, fmt.Errorf("failed to upsert user: %w", err)
	}

	return userID, nil
}

func buildClientRedirectURL(redirectURI, code, state string) (string, error) {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return "", err
	}
	q := parsed.Query()
	q.Set("code", code)
	q.Set("state", state)
	parsed.RawQuery = q.Encode()
	return parsed.String(), nil
}
