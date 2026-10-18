package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EnvironmentHandler struct {
	DB *pgxpool.Pool
}

type EnvironmentResponse struct {
	EnvironmentID int64  `json:"environment_id"`
	UserID        int64  `json:"user_id"`
	Rank          int64  `json:"rank"`
	Slug          string `json:"slug"`
}

type CreateEnvironmentRequest struct {
	Slug string `json:"slug"`
	Rank int64  `json:"rank"`
}

type ListEnvironmentsResponse struct {
	Environments []EnvironmentResponse `json:"environments"`
}

type UpdateEnvironmentDataRequest struct {
	Slug          *string `json:"slug"`
	Rank          *int64  `json:"rank"`
	EnvironmentID int64   `json:"environment_id"`
}

type BulkUpdateEnvironmentRequest struct {
	EnvironmentUpdates []UpdateEnvironmentDataRequest `json:"environment_updates"`
}

type UpdateResponse struct {
	Success      bool  `json:"success"`
	UpdatedCount int64 `json:"updated_count"`
}

func (h *EnvironmentHandler) CreateEnvironment(w http.ResponseWriter, r *http.Request) {

	var req CreateEnvironmentRequest
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	requestingUserID := strconv.FormatInt(userID, 10)
	if requestingUserID == " " {
		http.Error(w, "user id cannot be blank", http.StatusUnauthorized)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "wrong request format. please update", http.StatusBadRequest)
		return
	}

	if isBlank(req.Slug) || req.Rank == 0 {
		http.Error(w, "Wrong values sent in Request", http.StatusBadRequest)
		return
	}

	var resp EnvironmentResponse
	err := h.DB.QueryRow(r.Context(), `
	INSERT INTO environment(slug, rank, user_id)
	VALUES ($1, $2, $3)
	RETURNING environment_id, slug, rank, user_id
	`, req.Slug, req.Rank, requestingUserID).Scan(&resp.EnvironmentID, &resp.Slug, &resp.Rank, &resp.UserID)

	if err != nil {
		http.Error(w, "error in inserting environment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *EnvironmentHandler) GetEnvironmentByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == " " {
		http.Error(w, "id cannot be empty", http.StatusBadRequest)
		return
	}

	var resp EnvironmentResponse

	err := h.DB.QueryRow(r.Context(), `
	SELECT environment_id, slug, rank, user_id
	FROM environment
	WHERE environment_id = $1
	`, id).Scan(&resp.EnvironmentID, &resp.Slug, &resp.Rank, &resp.UserID)

	if err == pgx.ErrNoRows {
		http.Error(w, "environment not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to fetch environment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)

}

func (h *EnvironmentHandler) ListEnvironmentsByUser(w http.ResponseWriter, r *http.Request) {

	user_id := r.PathValue("user_id")
	if user_id == " " {
		http.Error(w, "id cannot be empty", http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
	SELECT environment_id, slug, rank, user_id
	FROM environment
	WHERE user_id = $1
	`, user_id)

	if err != nil {
		http.Error(w, "failed to run the list environments query", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	envs := []EnvironmentResponse{}
	for rows.Next() {
		var env EnvironmentResponse
		if err := rows.Scan(&env.EnvironmentID, &env.Slug, &env.Rank, &env.UserID); err != nil {
			http.Error(w, "failed to scan the environment query", http.StatusInternalServerError)
			return
		}

		envs = append(envs, env)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "error found while scanning through environments", http.StatusInternalServerError)
		return
	}

	var resp ListEnvironmentsResponse
	resp.Environments = envs
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *EnvironmentHandler) UpdateBulkEnvironments(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	requestingUserID := strconv.FormatInt(userID, 10)
	if requestingUserID == "" {
		http.Error(w, "user id cannot be NULL", http.StatusBadRequest)
		return
	}

	var req BulkUpdateEnvironmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "wrong update data", http.StatusBadRequest)
		return
	}

	updateRequests := req.EnvironmentUpdates
	successCount := 0
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		http.Error(w, "Error in Initiating DB", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	for _, request := range updateRequests {

		tag, err := tx.Exec(r.Context(), `
		UPDATE environment
		SET slug = COALESCE($1, slug),
		rank = COALESCE($2, rank)
		WHERE user_id = $3
		AND environment_id = $4
		`, request.Slug, request.Rank, requestingUserID, request.EnvironmentID)

		if err != nil {
			http.Error(w, "not authorized to change environment", http.StatusUnauthorized)
			return
		}
		if tag.RowsAffected() == 0 {
			http.Error(w, "environment not found or not yours", http.StatusNotFound)
			return
		}
		successCount += 1
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "failed to commit environment change: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var output UpdateResponse
	output.Success = true
	output.UpdatedCount = int64(successCount)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(output)
}

func (h *EnvironmentHandler) DeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	requestingUserID := strconv.FormatInt(userID, 10)
	if requestingUserID == "" {
		http.Error(w, "user id cannot be NULL", http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `
	DELETE FROM environment
	WHERE environment_id = $1
	AND user_id = $2
	`, id, requestingUserID)

	if err != nil {
		http.Error(w, "error in deleting environment", http.StatusInternalServerError)
		return
	}

	if tag.RowsAffected() == 0 {
		http.Error(w, "environment not found, or only its owner can delete it", http.StatusNotFound)
		return
	}

	var resp DeletionStatus
	resp.Status = "success"
	resp.Deleted = true
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *EnvironmentHandler) UpdateEnvironment(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	requestingUserID := strconv.FormatInt(userID, 10)
	if requestingUserID == "" {
		http.Error(w, "user id cannot be NULL", http.StatusBadRequest)
		return
	}

	var req UpdateEnvironmentDataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "error in decoding environment data", http.StatusBadRequest)
		return
	}

	if req.Rank != nil {
		http.Error(w, "cannot edit a single environment's rank. must be reordered", http.StatusBadRequest)
		return
	}

	if req.Slug == nil || req.EnvironmentID == 0 || strings.TrimSpace(*req.Slug) == "" {
		http.Error(w, "request must contain environmentID and slug", http.StatusBadRequest)
		return
	}

	var resp EnvironmentResponse

	err := h.DB.QueryRow(r.Context(), `
	UPDATE environment
	SET slug = COALESCE($1, slug)
	WHERE environment_id = $2 AND user_id = $3
	RETURNING environment_id, slug, rank, user_id
	`, req.Slug, req.EnvironmentID, requestingUserID).Scan(&resp.EnvironmentID, &resp.Slug, &resp.Rank, &resp.UserID)

	if err == pgx.ErrNoRows {
		http.Error(w, "environment not found", http.StatusNotFound)
		return
	}

	if err != nil {
		http.Error(w, "error in updating Slug for Environment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
