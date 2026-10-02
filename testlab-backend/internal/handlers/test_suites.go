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

type SuiteHandler struct {
	DB *pgxpool.Pool
}

type CreateSuiteRequest struct {
	SuiteName        string `json:"suite_name"`
	SuiteDescription string `json:"suite_description"`
	OwnerID          int    `json:"owner_id"`
}

type SuiteResponse struct {
	SuiteID          int       `json:"suite_id"`
	SuiteName        string    `json:"suite_name"`
	SuiteDescription string    `json:"suite_description"`
	OwnerID          int       `json:"owner_id"`
	OwnershipType    string    `json:"ownership_type"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type SharedSuiteResponse struct {
	SuiteID          int       `json:"suite_id"`
	SuiteName        string    `json:"suite_name"`
	SuiteDescription string    `json:"suite_description"`
	OwnerID          int       `json:"owner_id"`
	OwnerUsername    string    `json:"owner_username"`
	OwnershipType    string    `json:"ownership_type"`
	AccessScope      string    `json:"access_scope"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
type ListSuitesResponse struct {
	OwnedSuites  []SuiteResponse
	SharedSuites []SharedSuiteResponse
}

type UpdateSuiteRequest struct {
	SuiteName        *string `json:"suite_name"`
	SuiteDescription *string `json:"suite_description"`
}

type DeletionStatus struct {
	Status  string `json:"status"`
	Deleted bool   `json:"deleted"`
}

func (h *SuiteHandler) CreateSuite(w http.ResponseWriter, r *http.Request) {
	var req CreateSuiteRequest

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	requestingUserID := strconv.FormatInt(userID, 10)

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body for request", http.StatusBadRequest)
		return
	}

	if isBlank(req.SuiteName) {
		http.Error(w, "suite_name is required", http.StatusBadRequest)
		return
	}

	var resp SuiteResponse

	err := h.DB.QueryRow(r.Context(),
		` INSERT INTO test_suites(suite_name, suite_description, owner_id)
		VALUES ($1, $2, $3)
		RETURNING suite_id, suite_name, COALESCE(suite_description, ''), owner_id, 'owned', created_at, updated_at`,
		req.SuiteName, req.SuiteDescription, requestingUserID,
	).Scan(&resp.SuiteID, &resp.SuiteName, &resp.SuiteDescription, &resp.OwnerID, &resp.OwnershipType, &resp.CreatedAt, &resp.UpdatedAt)

	if err != nil {
		http.Error(w, "Failed to write the Test Suite to database", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *SuiteHandler) GetSuiteByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
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

	var resp SuiteResponse
	err := h.DB.QueryRow(r.Context(), `
		SELECT t.suite_id, t.suite_name, COALESCE(t.suite_description, ''), t.owner_id,
		       CASE WHEN t.owner_id = $2 THEN 'owned' ELSE 'shared' END AS ownership_type,
		       t.created_at, t.updated_at
		FROM test_suites t
		WHERE t.suite_id = $1
		  AND (
		    t.owner_id = $2
		    OR EXISTS (
		        SELECT 1 FROM shared_suites s
		        WHERE s.suite_id = t.suite_id AND s.user_id = $2
		    )
		  )
	`, id, requestingUserID).Scan(
		&resp.SuiteID, &resp.SuiteName, &resp.SuiteDescription,
		&resp.OwnerID, &resp.OwnershipType, &resp.CreatedAt, &resp.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		http.Error(w, "suite not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to fetch suite: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *SuiteHandler) ListAllSuites(w http.ResponseWriter, r *http.Request) {

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

	rows, err := h.DB.Query(r.Context(), `
	SELECT suite_id, suite_name, COALESCE(suite_description, ''), owner_id, 'owned' as ownership_type,
	created_at, updated_at
	FROM test_suites WHERE owner_id = $1
	`, requestingUserID)

	if err != nil {
		http.Error(w, "failed to run the list suites query", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	suites := []SuiteResponse{}
	for rows.Next() {
		var s SuiteResponse
		if err := rows.Scan(&s.SuiteID, &s.SuiteName, &s.SuiteDescription, &s.OwnerID, &s.OwnershipType, &s.CreatedAt, &s.UpdatedAt); err != nil {
			http.Error(w, "failed to read Suite Row", http.StatusInternalServerError)
			return
		}

		suites = append(suites, s)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "error found while scanning through suites", http.StatusInternalServerError)
		return
	}

	sharedSuites := []SharedSuiteResponse{}

	rows, err = h.DB.Query(r.Context(), `
	SELECT t.suite_id, t.owner_id, u.username, t.suite_name, COALESCE(t.suite_description, ''), s.access_scope,
	'shared' as ownership_type, t.created_at, t.updated_at
	FROM test_suites t
	JOIN shared_suites s ON t.suite_id = s.suite_id
	JOIN users u ON u.user_id = t.owner_id
	WHERE s.user_id = $1
	`, requestingUserID)

	if err != nil {
		http.Error(w, "error in fetching shared suites for user", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var s SharedSuiteResponse
		if err := rows.Scan(&s.SuiteID, &s.OwnerID, &s.OwnerUsername, &s.SuiteName, &s.SuiteDescription, &s.AccessScope,
			&s.OwnershipType, &s.CreatedAt, &s.UpdatedAt); err != nil {
			http.Error(w, "error in loading shared suite row", http.StatusInternalServerError)
			return
		}
		sharedSuites = append(sharedSuites, s)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "error in scanning shared suites for user", http.StatusInternalServerError)
		return
	}

	var resp ListSuitesResponse
	resp.OwnedSuites = suites
	resp.SharedSuites = sharedSuites

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *SuiteHandler) UpdateSuiteByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
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

	var req UpdateSuiteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body provided", http.StatusBadRequest)
		return
	}
	if req.SuiteName != nil && isBlank(*req.SuiteName) {
		http.Error(w, "suite_name cannot be empty", http.StatusBadRequest)
		return
	}

	var resp SuiteResponse
	err := h.DB.QueryRow(r.Context(), `
		UPDATE test_suites
		SET suite_name = COALESCE($1, suite_name),
		    suite_description = COALESCE($2, suite_description),
		    updated_at = NOW()
		WHERE suite_id = $3
		  AND (
		    owner_id = $4
		    OR EXISTS (
		        SELECT 1 FROM shared_suites s
		        WHERE s.suite_id = test_suites.suite_id
		          AND s.user_id = $4
		          AND s.access_scope IN ('write', 'admin')
		    )
		  )
		RETURNING suite_id, suite_name, COALESCE(suite_description, ''), owner_id,
		          CASE WHEN owner_id = $4 THEN 'owned' ELSE 'shared' END, created_at, updated_at
	`, req.SuiteName, req.SuiteDescription, id, requestingUserID).Scan(
		&resp.SuiteID, &resp.SuiteName, &resp.SuiteDescription, &resp.OwnerID,
		&resp.OwnershipType, &resp.CreatedAt, &resp.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		http.Error(w, "suite not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to update suite: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *SuiteHandler) DeleteSuiteByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

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
	DELETE FROM test_suites
	WHERE suite_id = $1
	AND (
	owner_id = $2
	OR EXISTS (
		SELECT 1 FROM shared_suites s
		WHERE s.suite_id = test_suites.suite_id
		AND s.user_id = $2
		AND s.access_scope IN ('admin'))
		)
	`, id, requestingUserID)

	var resp DeletionStatus

	if err != nil {
		http.Error(w, "error in deleting test suite", http.StatusInternalServerError)
		return
	}

	if tag.RowsAffected() == 0 {
		http.Error(w, "suite not found, or only its owner or an admin can delete it", http.StatusNotFound)
		return
	}

	resp.Status = "success"
	resp.Deleted = true
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)

}
