package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "unit-test-secret"

func signToken(t *testing.T, method jwt.SigningMethod, secret string, userID int64) string {
	t.Helper()
	token := jwt.NewWithClaims(method, Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	s, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestParseToken(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)

	claims, err := ParseToken(signToken(t, jwt.SigningMethodHS256, testSecret, 9))
	if err != nil {
		t.Fatalf("valid token rejected: %v", err)
	}
	if claims.UserID != 9 {
		t.Errorf("UserID = %d, want 9", claims.UserID)
	}

	if _, err := ParseToken(signToken(t, jwt.SigningMethodHS256, "other-secret", 9)); err == nil {
		t.Error("token signed with another secret was accepted")
	}
	if _, err := ParseToken(signToken(t, jwt.SigningMethodHS512, testSecret, 9)); err == nil {
		t.Error("only HS256 should be accepted")
	}
}

func TestRequireBearerToken(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)
	t.Setenv("MCP_SELF_URL", "http://mcp.local")
	token := signToken(t, jwt.SigningMethodHS256, testSecret, 3)

	var forwarded string
	handler := RequireBearerToken(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		forwarded, _ = TokenFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("valid token reaches the handler", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodPost, "/mcp", nil)
		r.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, r)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if forwarded != token {
			t.Error("token was not stored in the request context")
		}
	})

	t.Run("missing token gets an OAuth challenge", func(t *testing.T) {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/mcp", nil))

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
		want := `resource_metadata="http://mcp.local/.well-known/oauth-protected-resource"`
		if h := rec.Header().Get("WWW-Authenticate"); !strings.Contains(h, want) {
			t.Errorf("WWW-Authenticate = %q, want it to contain %s", h, want)
		}
	})
}

func TestProtectedResourceMetadata(t *testing.T) {
	t.Setenv("MCP_SELF_URL", "http://mcp.local")
	t.Setenv("TESTLAB_BACKEND_URL", "http://backend.local")

	rec := httptest.NewRecorder()
	ProtectedResourceMetadata(rec, httptest.NewRequest(http.MethodGet, "/.well-known/oauth-protected-resource", nil))

	var m ProtectedResourceMetadataResponse
	if err := json.NewDecoder(rec.Body).Decode(&m); err != nil {
		t.Fatal(err)
	}
	if m.Resource != "http://mcp.local" || len(m.AuthorizationServers) != 1 || m.AuthorizationServers[0] != "http://backend.local" {
		t.Errorf("metadata = %+v", m)
	}
}
