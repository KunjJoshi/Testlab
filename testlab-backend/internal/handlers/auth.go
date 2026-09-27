package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
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
	cookie, err := r.Cookie("oauth_state")
	if err != nil || cookie.Value != r.URL.Query().Get("state") {
		http.Error(w, "invalid oauth state", http.StatusBadRequest)
		return
	}

	token, err := auth.GithubOAuthConfig().Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		http.Error(w, "failed to exchange code: "+err.Error(), http.StatusInternalServerError)
		return
	}

	ghUser, err := auth.FetchGithubUser(r.Context(), token)
	if err != nil {
		http.Error(w, "failed to fetch github profile: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var id int64
	err = h.DB.QueryRow(r.Context(), `
	INSERT INTO users (username, email, github_user_id, github_access_token, avatar_url)
	VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT (github_user_id) DO UPDATE
	SET github_access_token = EXCLUDED.github_access_token,
	avatar_url = EXCLUDED.avatar_url,
	username = EXCLUDED.username,
	updated_at = NOW()
	RETURNING user_id`, ghUser.Login, ghUser.Email,
		fmt.Sprint(ghUser.ID), token.AccessToken, ghUser.AvatarURL).Scan(&id)

	if err != nil {
		http.Error(w, "failed to upsert user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jwtStr, err := auth.IssueToken(id)
	if err != nil {
		http.Error(w, "failed to issue session token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": jwtStr})

}
