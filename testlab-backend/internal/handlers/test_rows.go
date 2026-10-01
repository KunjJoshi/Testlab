package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RowsHandler struct {
	DB *pgxpool.Pool
}

type CreateTestRowsRequest struct {
	TestName               string `json:"test_name"`
	ParentSuiteID          int    `json:"parent_suite"`
	TestDescription        string `json:"test_description"`
	ExecutionSteps         string `json:"execution_steps"`
	ExpectedOutput         string `json:"expected_output"`
	ExpectedResponseStatus int    `json:"expected_response_status"`
}

type BulkTestRowsImportRequest struct {
	TestRows      []CreateTestRowsRequest `json:"test_rows"`
	ParentSuiteID int                     `json:"parent_suite_id"`
}

type TestRowsResponse struct {
	TestRowID              int       `json:"test_row_id"`
	TestName               string    `json:"test_name"`
	ParentSuiteID          int       `json:"parent_suite"`
	TestDescription        string    `json:"test_description"`
	ExecutionSteps         string    `json:"execution_steps"`
	ExpectedOutput         string    `json:"expected_output"`
	ExpectedResponseStatus int       `json:"expected_response_status"`
	TestStatus             string    `json:"status"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type UpdateTestRequest struct {
	TestName               *string `json:"test_name"`
	TestDescription        *string `json:"test_description"`
	ExecutionSteps         *string `json:"execution_steps"`
	ExpectedOutput         *string `json:"expected_output"`
	ExpectedResponseStatus *int    `json:"expected_response_status"`
	TestStatus             *string `json:"status"`
}

type ListTestRowsResponse struct {
	Tests []TestRowsResponse `json:"tests"`
}

func (h *RowsHandler) CreateNewTestRow(w http.ResponseWriter, r *http.Request) {
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

	var req CreateTestRowsRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Error in decoding request body. Request body format unsupported", http.StatusBadRequest)
		return
	}

	if req.ParentSuiteID == 0 || isBlank(req.TestName) {
		http.Error(w, "Parent Suite ID and Test Name must always be provided", http.StatusBadRequest)
		return
	}
	if !isValidHTTPStatus(req.ExpectedResponseStatus) {
		http.Error(w, "expected_response_status must be an HTTP status code between 100 and 599", http.StatusBadRequest)
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
	AND access_scope IN ('write', 'admin')
	)))
	`, req.ParentSuiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "suite not found, or you don't have write access to it", http.StatusForbidden)
		return
	}

	var resp TestRowsResponse
	err = h.DB.QueryRow(r.Context(), `
	INSERT INTO test_rows(test_name, parent_id, test_description, expected_output, execution_steps, expected_response_status)
	VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING row_id, test_name, parent_id, test_description,
	expected_output, COALESCE(execution_steps, ''), expected_response_status, test_status, created_at, updated_at
	`, req.TestName,
		req.ParentSuiteID,
		req.TestDescription,
		req.ExpectedOutput,
		req.ExecutionSteps,
		req.ExpectedResponseStatus).Scan(&resp.TestRowID,
		&resp.TestName,
		&resp.ParentSuiteID,
		&resp.TestDescription,
		&resp.ExpectedOutput,
		&resp.ExecutionSteps,
		&resp.ExpectedResponseStatus,
		&resp.TestStatus,
		&resp.CreatedAt,
		&resp.UpdatedAt)

	if err != nil {
		http.Error(w, "error in inserting test row to Parent Suite", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *RowsHandler) ImportBulkTestRows(w http.ResponseWriter, r *http.Request) {
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

	var req BulkTestRowsImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Error in decoding request body. Request body format unsupported", http.StatusBadRequest)
		return
	}

	testRows := req.TestRows
	parentID := req.ParentSuiteID

	if parentID == 0 {
		http.Error(w, "parent_suite_id must be provided", http.StatusBadRequest)
		return
	}
	if len(testRows) == 0 {
		http.Error(w, "test_rows must contain at least one item", http.StatusBadRequest)
		return
	}
	for i, row := range testRows {
		if isBlank(row.TestName) {
			http.Error(w, fmt.Sprintf("test_rows[%d]: test_name is required", i), http.StatusBadRequest)
			return
		}
		if !isValidHTTPStatus(row.ExpectedResponseStatus) {
			http.Error(w, fmt.Sprintf("test_rows[%d]: expected_response_status must be an HTTP status code between 100 and 599", i), http.StatusBadRequest)
			return
		}
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
		              AND access_scope IN ('write', 'admin')
		        )
		      )
		)
	`, parentID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if !permission_access {
		http.Error(w, "suite not found, or you don't have write access to it", http.StatusForbidden)
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		http.Error(w, "failed to start transaction: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	for i, rowReq := range testRows {
		_, err := tx.Exec(r.Context(), `
			INSERT INTO test_rows
			    (test_name, parent_id, test_description, expected_output, execution_steps, expected_response_status)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, rowReq.TestName, parentID, rowReq.TestDescription, rowReq.ExpectedOutput, rowReq.ExecutionSteps, rowReq.ExpectedResponseStatus)

		if err != nil {
			http.Error(w, fmt.Sprintf("failed to insert row %d: %s", i, err.Error()), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "failed to commit transaction: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"status": "success", "inserted": len(testRows)})
}

func (h *RowsHandler) ListAllTestRows(w http.ResponseWriter, r *http.Request) {
	testSuiteID := r.PathValue("suite_id")

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
		OR EXISTS (
			SELECT 1 FROM shared_suites
			WHERE suite_id = test_suites.suite_id
			AND user_id = $2
			)
		)
	)
	`, testSuiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "could not find requested Test Suite for your user account", http.StatusNotFound)
		return
	}

	tests := []TestRowsResponse{}

	rows, err := h.DB.Query(r.Context(), `
	SELECT row_id, test_name, parent_id, test_description, expected_output, test_status, COALESCE(execution_steps, ''),
	expected_response_status, created_at, updated_at
	FROM test_rows
	WHERE parent_id = $1
	ORDER BY updated_at DESC
	`, testSuiteID)

	if err != nil {
		http.Error(w, "error in fetching  tests for this suite", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {

		var test TestRowsResponse
		if err := rows.Scan(&test.TestRowID, &test.TestName, &test.ParentSuiteID, &test.TestDescription, &test.ExpectedOutput,
			&test.TestStatus, &test.ExecutionSteps, &test.ExpectedResponseStatus, &test.CreatedAt, &test.UpdatedAt); err != nil {
			http.Error(w, "error in loading test", http.StatusInternalServerError)
			return
		}

		tests = append(tests, test)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "error in scanning test rows for user", http.StatusInternalServerError)
		return
	}

	var resp ListTestRowsResponse
	resp.Tests = tests
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *RowsHandler) UpdateRow(w http.ResponseWriter, r *http.Request) {

	testRowID := r.PathValue("row_id")

	var testSuiteID int
	err := h.DB.QueryRow(r.Context(), `
	SELECT parent_id FROM test_rows WHERE row_id = $1
	`, testRowID).Scan(&testSuiteID)

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

	if err == pgx.ErrNoRows {
		http.Error(w, "test row not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to look up test row: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var permission_access bool

	err = h.DB.QueryRow(r.Context(), `
	SELECT EXISTS(
	SELECT 1 FROM test_suites
	WHERE suite_id = $1
	AND (
		owner_id = $2
		OR EXISTS (
			SELECT 1 FROM shared_suites
			WHERE suite_id = test_suites.suite_id
			AND user_id = $2
			AND access_scope IN ('write', 'admin')
			)
		)
	)
	`, testSuiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "you don't have write access to this suite", http.StatusForbidden)
		return
	}

	var req UpdateTestRequest
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "malformed request body", http.StatusBadRequest)
		return
	}
	if req.TestName != nil && isBlank(*req.TestName) {
		http.Error(w, "test_name cannot be empty", http.StatusBadRequest)
		return
	}
	if req.ExpectedResponseStatus != nil && !isValidHTTPStatus(*req.ExpectedResponseStatus) {
		http.Error(w, "expected_response_status must be an HTTP status code between 100 and 599", http.StatusBadRequest)
		return
	}
	if req.TestStatus != nil && !validTestStatuses[*req.TestStatus] {
		http.Error(w, "status must be one of untested, in_progress, passed, failed", http.StatusBadRequest)
		return
	}

	var resp TestRowsResponse
	err = h.DB.QueryRow(r.Context(), `
	UPDATE test_rows
	SET test_name = COALESCE($1, test_name),
		test_description = COALESCE($2, test_description),
		expected_output = COALESCE($3, expected_output),
		execution_steps = COALESCE($4, execution_steps),
		expected_response_status = COALESCE($5, expected_response_status),
		test_status = COALESCE($6, test_status),
		updated_at = NOW()
	
	WHERE row_id = $7
	RETURNING row_id, test_name, test_description, expected_output, parent_id, expected_response_status,
	COALESCE(execution_steps, ''), test_status, created_at, updated_at
	`, req.TestName, req.TestDescription, req.ExpectedOutput, req.ExecutionSteps, req.ExpectedResponseStatus, req.TestStatus, testRowID).Scan(&resp.TestRowID, &resp.TestName, &resp.TestDescription, &resp.ExpectedOutput, &resp.ParentSuiteID,
		&resp.ExpectedResponseStatus, &resp.ExecutionSteps, &resp.TestStatus, &resp.CreatedAt, &resp.UpdatedAt)

	if err == pgx.ErrNoRows {
		http.Error(w, "test row not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to update test row: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *RowsHandler) DeleteTestRow(w http.ResponseWriter, r *http.Request) {

	testRowID := r.PathValue("row_id")

	var testSuiteID int
	err := h.DB.QueryRow(r.Context(), `
	SELECT parent_id FROM test_rows WHERE row_id = $1
	`, testRowID).Scan(&testSuiteID)

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

	if err == pgx.ErrNoRows {
		http.Error(w, "test row not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to look up test row: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var permission_access bool

	err = h.DB.QueryRow(r.Context(), `
	SELECT EXISTS(
	SELECT 1 FROM test_suites
	WHERE suite_id = $1
	AND (
		owner_id = $2
		OR EXISTS (
			SELECT 1 FROM shared_suites
			WHERE suite_id = test_suites.suite_id
			AND user_id = $2
			AND access_scope IN ('write', 'admin')
			)
		)
	)
	`, testSuiteID, requestingUserID).Scan(&permission_access)

	if err != nil {
		http.Error(w, "failed to check permissions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !permission_access {
		http.Error(w, "you don't have write access to this suite", http.StatusForbidden)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `DELETE FROM test_rows WHERE row_id = $1`, testRowID)

	var resp DeletionStatus
	if err != nil {
		http.Error(w, "error in deleting test row", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "test row not found", http.StatusNotFound)
		return
	}

	resp.Status = "success"
	resp.Deleted = true
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
