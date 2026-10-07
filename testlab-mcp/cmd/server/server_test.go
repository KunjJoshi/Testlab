package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/auth"
	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

const testSecret = "server-test-secret"

type backendCall struct {
	Method, Path, Auth string
	Body               map[string]any
}

// startMCP runs the real MCP stack (tools, stateless streamable HTTP, bearer
// middleware) in front of a fake backend that records every call it receives.
func startMCP(t *testing.T) (mcpURL string, calls *[]backendCall) {
	t.Helper()
	t.Setenv("JWT_SECRET", testSecret)
	recorded := []backendCall{}

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call := backendCall{Method: r.Method, Path: r.URL.Path, Auth: r.Header.Get("Authorization")}
		json.NewDecoder(r.Body).Decode(&call.Body)
		recorded = append(recorded, call)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		io.WriteString(w, `{"ok":true}`)
	}))
	t.Cleanup(backend.Close)

	s := server.NewMCPServer("testlab", "test")
	registerAllTools(s, &client.Client{BaseURL: backend.URL})

	mux := http.NewServeMux()
	mux.Handle("/mcp", auth.RequireBearerToken(server.NewStreamableHTTPServer(s, server.WithStateLess(true))))
	mcp := httptest.NewServer(mux)
	t.Cleanup(mcp.Close)

	return mcp.URL + "/mcp", &recorded
}

func userToken(t *testing.T) string {
	t.Helper()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, auth.Claims{
		UserID:           1,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

type rpcResponse struct {
	Result struct {
		Tools []struct {
			Name string `json:"name"`
		} `json:"tools"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError bool `json:"isError"`
	} `json:"result"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func rpc(t *testing.T, url, token, method string, params any) rpcResponse {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("%s: status %d: %s", method, resp.StatusCode, raw)
	}

	// The response may be plain JSON or a single server-sent event.
	payload := string(raw)
	if i := strings.Index(payload, "data: "); i >= 0 {
		payload = strings.TrimSpace(strings.SplitN(payload[i+len("data: "):], "\n", 2)[0])
	}
	var out rpcResponse
	if err := json.Unmarshal([]byte(payload), &out); err != nil {
		t.Fatalf("%s: decode %q: %v", method, raw, err)
	}
	if out.Error != nil {
		t.Fatalf("%s: JSON-RPC error: %s", method, out.Error.Message)
	}
	return out
}

func TestToolsList(t *testing.T) {
	url, _ := startMCP(t)
	res := rpc(t, url, userToken(t), "tools/list", map[string]any{})

	var names []string
	for _, tool := range res.Result.Tools {
		names = append(names, tool.Name)
	}
	sort.Strings(names)

	want := []string{
		"bulk-import-test-rows", "create-test-row", "create-test-suite", "delete-suite",
		"delete-test-row", "get-suite-by-id", "list-all-suites", "list-test-rows",
		"list-users-with-access", "provide-access", "remove-access", "update-access",
		"update-suite", "update-test-row",
	}
	if strings.Join(names, ",") != strings.Join(want, ",") {
		t.Errorf("tools = %v\nwant    %v", names, want)
	}
}

func TestCreateSuiteForwardsCallerToken(t *testing.T) {
	url, calls := startMCP(t)
	token := userToken(t)

	res := rpc(t, url, token, "tools/call", map[string]any{
		"name":      "create-test-suite",
		"arguments": map[string]any{"suite_name": "Smoke", "suite_description": "CI run"},
	})
	if res.Result.IsError {
		t.Fatalf("tool returned an error: %+v", res.Result.Content)
	}
	if len(res.Result.Content) == 0 || res.Result.Content[0].Text != `{"ok":true}` {
		t.Errorf("tool result = %+v, want the backend response", res.Result.Content)
	}

	if len(*calls) != 1 {
		t.Fatalf("backend calls = %d, want 1", len(*calls))
	}
	call := (*calls)[0]
	if call.Method != http.MethodPost || call.Path != "/suites" || call.Body["suite_name"] != "Smoke" {
		t.Errorf("backend call = %+v", call)
	}
	if call.Auth != "Bearer "+token {
		t.Error("the caller's token was not forwarded to the backend")
	}
}

func TestBulkImportBuildsBackendRequest(t *testing.T) {
	url, calls := startMCP(t)

	rpc(t, url, userToken(t), "tools/call", map[string]any{
		"name": "bulk-import-test-rows",
		"arguments": map[string]any{
			"parent_suite_id": 7,
			"test_rows_json":  `[{"test_name":"A","expected_response_status":200},{"test_name":"B","expected_response_status":404}]`,
		},
	})

	if len(*calls) != 1 {
		t.Fatalf("backend calls = %d, want 1", len(*calls))
	}
	call := (*calls)[0]
	rows, _ := call.Body["test_rows"].([]any)
	if call.Path != "/tests/import-bulk" || call.Body["parent_suite_id"] != float64(7) || len(rows) != 2 {
		t.Errorf("backend call = %+v", call)
	}
}

func TestMCPRequiresToken(t *testing.T) {
	url, _ := startMCP(t)
	resp, err := http.Post(url, "application/json", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}
