package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AccessHandler struct {
	DB *pgxpool.Pool
}

type ProvideAccessRequest struct {
	UserID      int    `json:"user_id"`
	SuiteID     int    `json:"suite_id"`
	AccessScope string `json:"access_scope"`
}

type RemoveAccessRequest struct {
	UserID  int `json:"user_id"`
	SuiteID int `json:"suite_id"`
}

type AccessHandlingResponse struct {
	SharingID   int       `json:"sharing_id"`
	UserID      int       `json:"user_id"`
	SuiteID     int       `json:"suite_id"`
	AccessScope string    `json:"access_scope"`
	ProviderID  int       `json:"provider_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SharedUserResponse struct {
	AccessHandlingResponse
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

type ListUsersResponse struct {
	Users []SharedUserResponse
}

type RemovalRequest struct {
	UserID  int `json:"user_id"`
	SuiteID int `json:"suite_id"`
}

type UserSearchResult struct {
	UserID       int    `json:"user_id"`
	Username     string `json:"username"`
	AvatarURL    string `json:"avatar_url"`
	GithubUserID string `json:"github_user_id"`
}

type UserSearchResponse struct {
	Results []UserSearchResult `json:"results"`
}

func (h *AccessHandler) ProvideAccessToUser(w http.ResponseWriter, r *http.Request) {

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

	var req ProvideAccessRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Error in decoding request body. Request body format unsupported", http.StatusBadRequest)
		return
	}

	var permission_access bool
	err = h.DB.QueryRow(r.Context(), `
	SELECT EXISTS(
	SELECT 1 FROM test_suites
	WHERE suite_id = $1
	AND (
	owner_id = $2
	OR EXISTS(
	SELECT 1 FROM shared_suites
	WHERE suite_id = test_suites.suite_id
	AND user_id = $2
	AND access_scope IN ('admin')
	)))
	`, req.SuiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "only the suite owner or an admin can manage access", http.StatusForbidden)
		return
	}

	if req.SuiteID == 0 || req.UserID == 0 || req.AccessScope == "" {
		http.Error(w, "Suite ID, Access Scope and User ID must always be provided", http.StatusBadRequest)
		return
	}
	if !validAccessScopes[req.AccessScope] {
		http.Error(w, "access_scope must be one of read, write, admin", http.StatusBadRequest)
		return
	}

	var isOwner, userExists, alreadyShared bool
	err = h.DB.QueryRow(r.Context(), `
	SELECT
		EXISTS(SELECT 1 FROM test_suites WHERE suite_id = $1 AND owner_id = $2),
		EXISTS(SELECT 1 FROM users WHERE user_id = $2),
		EXISTS(SELECT 1 FROM shared_suites WHERE suite_id = $1 AND user_id = $2)
	`, req.SuiteID, req.UserID).Scan(&isOwner, &userExists, &alreadyShared)
	if err != nil {
		http.Error(w, "failed to check the requested user: "+err.Error(), http.StatusInternalServerError)
		return
	}
	switch {
	case isOwner:
		http.Error(w, "that user owns this suite and already has full access", http.StatusBadRequest)
		return
	case !userExists:
		http.Error(w, "that user doesn't have a Testlab account", http.StatusNotFound)
		return
	case alreadyShared:
		http.Error(w, "that user already has access; change their access level instead", http.StatusConflict)
		return
	}

	var resp AccessHandlingResponse
	err = h.DB.QueryRow(r.Context(), `
	INSERT INTO shared_suites(user_id, provider_id, suite_id, access_scope)
	VALUES ($1, $2, $3, $4)
	RETURNING sharing_id, user_id, provider_id, suite_id, access_scope, created_at, updated_at
	`, req.UserID, requestingUserID, req.SuiteID, req.AccessScope).Scan(
		&resp.SharingID,
		&resp.UserID,
		&resp.ProviderID,
		&resp.SuiteID,
		&resp.AccessScope,
		&resp.CreatedAt,
		&resp.UpdatedAt,
	)

	if err != nil {
		http.Error(w, "failed to share the suite: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *AccessHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "query parameter is required", http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
	SELECT user_id, username, avatar_url, github_user_id 
	FROM users
	WHERE username ILIKE '%' || $1 || '%'
	ORDER BY username ASC
	LIMIT 5
	`, query)

	if err != nil {
		http.Error(w, "failed to search users: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []UserSearchResult
	for rows.Next() {
		var u UserSearchResult
		if err = rows.Scan(&u.UserID, &u.Username, &u.AvatarURL, &u.GithubUserID); err != nil {
			http.Error(w, "error in loading user records", http.StatusInternalServerError)
			return
		}
		results = append(results, u)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "error scanning user rows", http.StatusInternalServerError)
		return
	}

	var resp UserSearchResponse
	resp.Results = results
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)

}

func (h *AccessHandler) ListAllUsersWithAccess(w http.ResponseWriter, r *http.Request) {

	suiteID := r.PathValue("suite_id")

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

	var permission_access bool
	err := h.DB.QueryRow(r.Context(), `
	SELECT EXISTS(
	SELECT 1 FROM test_suites
	WHERE suite_id = $1
	AND (
	owner_id = $2
	OR EXISTS(
	SELECT 1 FROM shared_suites
	WHERE suite_id = test_suites.suite_id
	AND user_id = $2
	AND access_scope IN ('admin')
	)))
	`, suiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "only the suite owner or an admin can manage access", http.StatusForbidden)
		return
	}

	if suiteID == "" {
		http.Error(w, "Suite ID, Access Scope and User ID must always be provided", http.StatusBadRequest)
		return
	}

	users := []SharedUserResponse{}

	rows, err := h.DB.Query(r.Context(), `
	SELECT s.sharing_id, s.user_id, s.provider_id, s.suite_id, s.access_scope, s.created_at, s.updated_at,
	u.username, COALESCE(u.avatar_url, '')
	FROM shared_suites s JOIN users u ON u.user_id = s.user_id
	WHERE s.suite_id = $1
	`, suiteID)

	if err != nil {
		http.Error(w, "error in loading user records", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {

		var access SharedUserResponse
		err = rows.Scan(&access.SharingID, &access.UserID, &access.ProviderID, &access.SuiteID,
			&access.AccessScope, &access.CreatedAt, &access.UpdatedAt, &access.Username, &access.AvatarURL)

		if err != nil {
			http.Error(w, "error in loading test", http.StatusInternalServerError)
			return
		}

		users = append(users, access)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "error in scanning test rows for user", http.StatusInternalServerError)
		return
	}

	var resp ListUsersResponse
	resp.Users = users
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AccessHandler) UpdateUserAccess(w http.ResponseWriter, r *http.Request) {

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

	var req ProvideAccessRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Error in decoding request body. Request body format unsupported", http.StatusBadRequest)
		return
	}

	var permission_access bool
	err = h.DB.QueryRow(r.Context(), `
	SELECT EXISTS(
	SELECT 1 FROM test_suites
	WHERE suite_id = $1
	AND (
	owner_id = $2
	OR EXISTS(
	SELECT 1 FROM shared_suites
	WHERE suite_id = test_suites.suite_id
	AND user_id = $2
	AND access_scope IN ('admin')
	)))
	`, req.SuiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "only the suite owner or an admin can manage access", http.StatusForbidden)
		return
	}

	if req.SuiteID == 0 || req.UserID == 0 || req.AccessScope == "" {
		http.Error(w, "Suite ID, Access Scope and User ID must always be provided", http.StatusBadRequest)
		return
	}
	if !validAccessScopes[req.AccessScope] {
		http.Error(w, "access_scope must be one of read, write, admin", http.StatusBadRequest)
		return
	}

	var resp AccessHandlingResponse
	err = h.DB.QueryRow(r.Context(), `
	UPDATE shared_suites
	SET access_scope = $1,
		updated_at = NOW()
	WHERE user_id = $2 AND suite_id = $3
	RETURNING sharing_id, user_id, provider_id, suite_id, access_scope, created_at, updated_at
	`, req.AccessScope, req.UserID, req.SuiteID).Scan(&resp.SharingID,
		&resp.UserID,
		&resp.ProviderID,
		&resp.SuiteID,
		&resp.AccessScope,
		&resp.CreatedAt,
		&resp.UpdatedAt)

	if err == pgx.ErrNoRows {
		http.Error(w, "user record not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to update user record: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AccessHandler) RemoveUserAccess(w http.ResponseWriter, r *http.Request) {

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

	var req RemovalRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Error in decoding request body. Request body format unsupported", http.StatusBadRequest)
		return
	}

	var permission_access bool
	err = h.DB.QueryRow(r.Context(), `
	SELECT EXISTS(
	SELECT 1 FROM test_suites
	WHERE suite_id = $1
	AND (
	owner_id = $2
	OR EXISTS(
	SELECT 1 FROM shared_suites
	WHERE suite_id = test_suites.suite_id
	AND user_id = $2
	AND access_scope IN ('admin')
	)))
	`, req.SuiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "only the suite owner or an admin can manage access", http.StatusForbidden)
		return
	}

	if req.SuiteID == 0 || req.UserID == 0 {
		http.Error(w, "Suite ID and User ID must always be provided", http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `DELETE FROM shared_suites WHERE suite_id = $1 AND user_id = $2`,
		req.SuiteID, req.UserID)

	var resp DeletionStatus

	if err != nil {
		http.Error(w, "error in deleting user record", http.StatusInternalServerError)
		return
	}

	if tag.RowsAffected() == 0 {
		http.Error(w, "record not found", http.StatusNotFound)
		return
	}

	resp.Status = "success"
	resp.Deleted = true
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)

}
