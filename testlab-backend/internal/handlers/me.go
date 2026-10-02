package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MeHandler struct {
	DB *pgxpool.Pool
}

type MeResponse struct {
	UserID    int64     `json:"user_id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	AvatarURL string    `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *MeHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var resp MeResponse
	err := h.DB.QueryRow(r.Context(), `
	SELECT user_id, username, email, COALESCE(avatar_url, ''), created_at
	FROM users WHERE user_id = $1
	`, userID).Scan(&resp.UserID, &resp.Username, &resp.Email, &resp.AvatarURL, &resp.CreatedAt)

	// A valid token for a user that no longer exists is treated as an expired session.
	if err == pgx.ErrNoRows {
		http.Error(w, "user not found", http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, "failed to fetch user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
