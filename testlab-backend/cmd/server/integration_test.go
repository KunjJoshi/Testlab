package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
)

// The integration test needs a disposable Postgres database:
//
//	TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/testlab_test?sslmode=disable go test ./...
//
// It creates a uniquely named schema, applies every migration in
// supabase/migrations into it, runs the happy path through the real router,
// and drops the schema afterwards. Never point it at a database you care about.
const migrationsDir = "../../supabase/migrations"

func setupDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping database integration test")
	}
	ctx := context.Background()

	suffix := make([]byte, 4)
	if _, err := rand.Read(suffix); err != nil {
		t.Fatal(err)
	}
	schema := "testlab_it_" + hex.EncodeToString(suffix)

	admin, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer admin.Close(ctx)
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		conn, err := pgx.Connect(context.Background(), dbURL)
		if err != nil {
			return
		}
		defer conn.Close(context.Background())
		conn.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	})

	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("no migrations found in %s (err=%v)", migrationsDir, err)
	}
	sort.Strings(files)
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	for _, f := range files {
		sql, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		// PgConn().Exec uses the simple protocol, which allows several statements per file.
		if _, err := conn.Conn().PgConn().Exec(ctx, string(sql)).ReadAll(); err != nil {
			t.Fatalf("apply %s: %v", filepath.Base(f), err)
		}
	}
	return pool
}

func createUser(t *testing.T, pool *pgxpool.Pool, username string) (int64, string) {
	t.Helper()
	var id int64
	err := pool.QueryRow(context.Background(), `
		INSERT INTO users (username, email, github_user_id, github_access_token, avatar_url)
		VALUES ($1, $1 || '@example.com', $1 || '-gh', 'gho_test', 'https://avatars.example.com/' || $1)
		RETURNING user_id`, username).Scan(&id)
	if err != nil {
		t.Fatalf("insert user %s: %v", username, err)
	}
	token, err := auth.IssueToken(id)
	if err != nil {
		t.Fatal(err)
	}
	return id, token
}

type apiClient struct {
	t      *testing.T
	server *httptest.Server
}

// call sends a JSON request with a bearer token, asserts the status and decodes the body into out.
func (c apiClient) call(method, path, token string, body any, wantStatus int, out any) {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.t.Fatal(err)
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.server.URL+path, reader)
	if err != nil {
		c.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.server.Client().Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != wantStatus {
		c.t.Fatalf("%s %s: status %d, want %d; body: %s", method, path, resp.StatusCode, wantStatus, raw)
	}
	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			c.t.Fatalf("%s %s: decode %s: %v", method, path, raw, err)
		}
	}
}

type suiteJSON struct {
	SuiteID          int    `json:"suite_id"`
	SuiteName        string `json:"suite_name"`
	SuiteDescription string `json:"suite_description"`
	OwnerID          int    `json:"owner_id"`
	OwnerUsername    string `json:"owner_username"`
	AccessScope      string `json:"access_scope"`
}

type rowJSON struct {
	TestRowID int    `json:"test_row_id"`
	TestName  string `json:"test_name"`
	Status    string `json:"status"`
}

func TestHappyPath(t *testing.T) {
	t.Setenv("JWT_SECRET", "integration-test-secret")
	pool := setupDB(t)

	server := httptest.NewServer(newRouter(pool, "http://testlab.local"))
	t.Cleanup(server.Close)
	api := apiClient{t: t, server: server}

	ownerID, owner := createUser(t, pool, "alice-owner")
	bobID, bob := createUser(t, pool, "bob-builder")

	t.Run("public metadata and auth guard", func(t *testing.T) {
		var meta map[string]any
		api.call("GET", "/.well-known/oauth-authorization-server", "", nil, 200, &meta)
		if meta["issuer"] != "http://testlab.local" {
			t.Errorf("issuer = %v", meta["issuer"])
		}
		api.call("GET", "/suites", "", nil, 401, nil)
	})

	t.Run("me", func(t *testing.T) {
		var me struct {
			UserID   int64  `json:"user_id"`
			Username string `json:"username"`
		}
		api.call("GET", "/me", owner, nil, 200, &me)
		if me.UserID != ownerID || me.Username != "alice-owner" {
			t.Errorf("me = %+v", me)
		}
	})

	var suite suiteJSON
	api.call("POST", "/suites", owner, map[string]any{
		"suite_name": "Checkout flow", "suite_description": "Cart to payment",
	}, 201, &suite)
	if suite.SuiteID == 0 || suite.OwnerID != int(ownerID) {
		t.Fatalf("created suite = %+v", suite)
	}
	suitePath := fmt.Sprintf("/suites/%d", suite.SuiteID)

	t.Run("list, get and update suite", func(t *testing.T) {
		var list struct {
			OwnedSuites  []suiteJSON
			SharedSuites []suiteJSON
		}
		api.call("GET", "/suites", owner, nil, 200, &list)
		if len(list.OwnedSuites) != 1 || list.OwnedSuites[0].SuiteName != "Checkout flow" {
			t.Errorf("owned suites = %+v", list.OwnedSuites)
		}

		var updated suiteJSON
		api.call("PATCH", suitePath, owner, map[string]any{"suite_description": "Cart, payment, receipt"}, 200, &updated)
		if updated.SuiteDescription != "Cart, payment, receipt" || updated.SuiteName != "Checkout flow" {
			t.Errorf("updated suite = %+v", updated)
		}

		var got suiteJSON
		api.call("GET", suitePath, owner, nil, 200, &got)
		if got.SuiteDescription != "Cart, payment, receipt" {
			t.Errorf("fetched suite = %+v", got)
		}
	})

	var row rowJSON
	api.call("POST", "/tests/write-test", owner, map[string]any{
		"parent_suite":             suite.SuiteID,
		"test_name":                "Pay with saved card",
		"test_description":         "Returning customer pays in one click",
		"execution_steps":          "Open checkout\nPick saved card\nPay",
		"expected_output":          `{"status":"paid"}`,
		"expected_response_status": 201,
	}, 201, &row)
	if row.TestRowID == 0 || row.Status != "untested" {
		t.Fatalf("created row = %+v", row)
	}
	rowPath := fmt.Sprintf("/tests/%d", row.TestRowID)

	t.Run("bulk import and list tests", func(t *testing.T) {
		var res struct {
			Inserted int `json:"inserted"`
		}
		api.call("POST", "/tests/import-bulk", owner, map[string]any{
			"parent_suite_id": suite.SuiteID,
			"test_rows": []map[string]any{
				{"test_name": "Expired coupon", "test_description": "", "expected_output": "", "expected_response_status": 422},
				{"test_name": "Guest checkout", "test_description": "", "expected_output": "", "expected_response_status": 200},
			},
		}, 201, &res)
		if res.Inserted != 2 {
			t.Errorf("inserted = %d, want 2", res.Inserted)
		}

		var list struct{ Tests []rowJSON }
		api.call("GET", fmt.Sprintf("/tests/%d", suite.SuiteID), owner, nil, 200, &list)
		if len(list.Tests) != 3 {
			t.Errorf("tests in suite = %d, want 3", len(list.Tests))
		}
	})

	t.Run("update test status", func(t *testing.T) {
		var updated rowJSON
		api.call("PATCH", rowPath, owner, map[string]any{"status": "passed"}, 200, &updated)
		if updated.Status != "passed" || updated.TestName != "Pay with saved card" {
			t.Errorf("updated row = %+v", updated)
		}
	})

	t.Run("search users", func(t *testing.T) {
		var res struct {
			Results []struct {
				UserID   int64  `json:"user_id"`
				Username string `json:"username"`
			} `json:"results"`
		}
		api.call("GET", "/access/search-users?query=BOB", owner, nil, 200, &res)
		if len(res.Results) != 1 || res.Results[0].UserID != bobID {
			t.Errorf("search results = %+v", res.Results)
		}
	})

	t.Run("share suite and collaborate", func(t *testing.T) {
		api.call("POST", "/access/provide", owner, map[string]any{
			"user_id": bobID, "suite_id": suite.SuiteID, "access_scope": "write",
		}, 201, nil)

		var bobList struct {
			OwnedSuites  []suiteJSON
			SharedSuites []suiteJSON
		}
		api.call("GET", "/suites", bob, nil, 200, &bobList)
		if len(bobList.SharedSuites) != 1 {
			t.Fatalf("bob's shared suites = %+v", bobList.SharedSuites)
		}
		shared := bobList.SharedSuites[0]
		if shared.SuiteID != suite.SuiteID || shared.OwnerUsername != "alice-owner" || shared.AccessScope != "write" {
			t.Errorf("shared suite = %+v", shared)
		}

		// Write access lets bob record a result.
		api.call("PATCH", rowPath, bob, map[string]any{"status": "failed"}, 200, nil)

		var people struct {
			Users []struct {
				UserID      int64  `json:"user_id"`
				Username    string `json:"username"`
				AccessScope string `json:"access_scope"`
			}
		}
		api.call("GET", fmt.Sprintf("/access/list-users/%d", suite.SuiteID), owner, nil, 200, &people)
		if len(people.Users) != 1 || people.Users[0].Username != "bob-builder" {
			t.Errorf("collaborators = %+v", people.Users)
		}

		api.call("PATCH", "/access/update-access", owner, map[string]any{
			"user_id": bobID, "suite_id": suite.SuiteID, "access_scope": "read",
		}, 200, nil)
		api.call("DELETE", "/access/remove-user", owner, map[string]any{
			"user_id": bobID, "suite_id": suite.SuiteID,
		}, 200, nil)
		api.call("GET", suitePath, bob, nil, 404, nil)
	})

	t.Run("delete test and suite", func(t *testing.T) {
		api.call("DELETE", rowPath, owner, nil, 200, nil)
		api.call("DELETE", suitePath, owner, nil, 200, nil)
		api.call("GET", suitePath, owner, nil, 404, nil)
	})
}
