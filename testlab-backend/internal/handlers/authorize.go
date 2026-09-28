package handlers

import (
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
)

type AuthorizeHandler struct {
	DB        *pgxpool.Pool
	CIMDCache *auth.CIMDCache
}

func (h *AuthorizeHandler) Authorize(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	responseType := query.Get("response_type")
	clientID := query.Get("client_id")
	redirectURI := query.Get("redirect_uri")
	codeChallenge := query.Get("code_challenge")
	codeChallengeMethod := query.Get("code_challenge_method")
	state := query.Get("state")

	if err := validateAuthorizeParams(responseType, clientID, redirectURI, codeChallenge, codeChallengeMethod); err != nil {
		writeAuthorizeError(w, err)
		return
	}

	metadata, err := auth.FetchClientMetadata(h.CIMDCache, clientID)
	if err != nil {
		writeAuthorizeError(w, fmt.Errorf("unable to verify requesting application: %w", err))
		return
	}

	if !auth.IsRedirectURIAllowed(metadata, redirectURI) {
		writeAuthorizeError(w, fmt.Errorf("redirect_uri is not registered for this client"))
		return
	}

	correlationID, err := auth.StorePendingAuthorization(r.Context(), h.DB, clientID, redirectURI, codeChallenge, state)
	if err != nil {
		writeAuthorizeError(w, fmt.Errorf("failed to start login: %w", err))
		return
	}

	githubAuthURL := auth.GithubOAuthConfig().AuthCodeURL(correlationID)
	http.Redirect(w, r, githubAuthURL, http.StatusTemporaryRedirect)
}

func validateAuthorizeParams(responseType, clientID, redirectURI, codeChallenge, codeChallengeMethod string) error {
	if responseType != "code" {
		return fmt.Errorf("unsupported response_type: %s", responseType)
	}
	if clientID == "" {
		return fmt.Errorf("client_id is required")
	}
	if redirectURI == "" {
		return fmt.Errorf("redirect_uri is required")
	}
	if codeChallenge == "" {
		return fmt.Errorf("code_challenge is required")
	}
	if codeChallengeMethod != "S256" {
		return fmt.Errorf("unsupported code_challenge_method: %s (only S256 is supported)", codeChallengeMethod)
	}
	return nil
}

func writeAuthorizeError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusBadRequest)
	w.Write([]byte(err.Error()))
}
