package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Forwarding of the caller's bearer token is covered end to end in
// cmd/server (TestCreateSuiteForwardsCallerToken), where the auth middleware
// puts it in the request context.
func TestClientForwardsRequest(t *testing.T) {
	var gotMethod, gotPath string
	var gotBody map[string]any
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"suite_id":5}`))
	}))
	defer backend.Close()

	c := &Client{BaseURL: backend.URL}
	resp, err := c.Post(context.Background(), "/suites", map[string]any{"suite_name": "Smoke"})
	if err != nil {
		t.Fatalf("Post: %v", err)
	}

	if string(resp) != `{"suite_id":5}` {
		t.Errorf("response = %s", resp)
	}
	if gotMethod != http.MethodPost || gotPath != "/suites" || gotBody["suite_name"] != "Smoke" {
		t.Errorf("backend saw %s %s %v", gotMethod, gotPath, gotBody)
	}
}

func TestClientReturnsBackendErrors(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "suite not found", http.StatusNotFound)
	}))
	defer backend.Close()

	c := &Client{BaseURL: backend.URL}
	_, err := c.Get(context.Background(), "/suites/99")
	if err == nil || !strings.Contains(err.Error(), "404") || !strings.Contains(err.Error(), "suite not found") {
		t.Errorf("err = %v, want it to include the status and backend message", err)
	}
}
