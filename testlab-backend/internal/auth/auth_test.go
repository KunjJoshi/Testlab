package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testSecret = "unit-test-secret"

func TestIssueAndParseToken(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)

	token, err := IssueToken(42)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}

	claims, err := ParseToken(token)
	if err != nil {
		t.Fatalf("ParseToken: %v", err)
	}
	if claims.UserID != 42 {
		t.Errorf("UserID = %d, want 42", claims.UserID)
	}
	if ttl := time.Until(claims.ExpiresAt.Time); ttl < TokenTTL-time.Minute || ttl > TokenTTL {
		t.Errorf("token expires in %v, want about %v", ttl, TokenTTL)
	}
}

func TestParseTokenRejectsWrongSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)
	token, err := IssueToken(1)
	if err != nil {
		t.Fatal(err)
	}

	t.Setenv("JWT_SECRET", "a-different-secret")
	if _, err := ParseToken(token); err == nil {
		t.Fatal("expected a token signed with another secret to be rejected")
	}
}

func TestVerifyPKCE(t *testing.T) {
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	if !VerifyPKCE(verifier, challenge) {
		t.Error("matching verifier was rejected")
	}
	if VerifyPKCE("wrong-verifier", challenge) {
		t.Error("non-matching verifier was accepted")
	}
}

func TestGenerateState(t *testing.T) {
	a, err := GenerateState()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := GenerateState()
	if a == "" || a == b {
		t.Errorf("states should be non-empty and unique, got %q and %q", a, b)
	}
	if raw, err := base64.URLEncoding.DecodeString(a); err != nil || len(raw) != 32 {
		t.Errorf("state should be 32 random bytes, base64url encoded (len=%d, err=%v)", len(raw), err)
	}
}

func TestRequireAuth(t *testing.T) {
	t.Setenv("JWT_SECRET", testSecret)
	token, err := IssueToken(7)
	if err != nil {
		t.Fatal(err)
	}

	var gotUserID int64
	handler := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUserID, _ = UserIDFromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	cookie := &http.Cookie{Name: SessionCookieName, Value: token}
	cases := []struct {
		name   string
		build  func() *http.Request
		status int
	}{
		{"bearer token", func() *http.Request {
			r := httptest.NewRequest(http.MethodPost, "/suites", nil)
			r.Header.Set("Authorization", "Bearer "+token)
			return r
		}, http.StatusNoContent},
		{"session cookie on a read", func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/suites", nil)
			r.AddCookie(cookie)
			return r
		}, http.StatusNoContent},
		{"session cookie on a write with CSRF header", func() *http.Request {
			r := httptest.NewRequest(http.MethodPost, "/suites", nil)
			r.AddCookie(cookie)
			r.Header.Set(CSRFHeader, "testlab")
			return r
		}, http.StatusNoContent},
		{"session cookie on a write without CSRF header", func() *http.Request {
			r := httptest.NewRequest(http.MethodPost, "/suites", nil)
			r.AddCookie(cookie)
			return r
		}, http.StatusForbidden},
		{"no credentials", func() *http.Request {
			return httptest.NewRequest(http.MethodGet, "/suites", nil)
		}, http.StatusUnauthorized},
		{"invalid token", func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/suites", nil)
			r.Header.Set("Authorization", "Bearer not-a-jwt")
			return r
		}, http.StatusUnauthorized},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotUserID = 0
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, tc.build())

			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tc.status, rec.Body.String())
			}
			if tc.status == http.StatusNoContent && gotUserID != 7 {
				t.Errorf("user ID in context = %d, want 7", gotUserID)
			}
		})
	}
}

func TestSessionCookie(t *testing.T) {
	t.Run("local http frontend", func(t *testing.T) {
		t.Setenv("FRONTEND_URL", "http://localhost:5173")
		t.Setenv("COOKIE_SECURE", "")

		rec := httptest.NewRecorder()
		SetSessionCookie(rec, "jwt-value")
		c := rec.Result().Cookies()[0]

		if c.Name != SessionCookieName || c.Value != "jwt-value" {
			t.Errorf("cookie = %s=%s", c.Name, c.Value)
		}
		if !c.HttpOnly || c.Secure || c.SameSite != http.SameSiteLaxMode || c.Path != "/" {
			t.Errorf("unexpected attributes: HttpOnly=%v Secure=%v SameSite=%v Path=%q",
				c.HttpOnly, c.Secure, c.SameSite, c.Path)
		}
		if c.MaxAge != int(TokenTTL.Seconds()) {
			t.Errorf("MaxAge = %d, want %d", c.MaxAge, int(TokenTTL.Seconds()))
		}
	})

	t.Run("https frontend", func(t *testing.T) {
		t.Setenv("FRONTEND_URL", "https://app.example.com/")
		t.Setenv("COOKIE_SECURE", "")

		rec := httptest.NewRecorder()
		SetSessionCookie(rec, "jwt-value")
		c := rec.Result().Cookies()[0]

		if !c.Secure || c.SameSite != http.SameSiteNoneMode {
			t.Errorf("Secure=%v SameSite=%v, want Secure and SameSite=None", c.Secure, c.SameSite)
		}
		if got := FrontendURL(); got != "https://app.example.com" {
			t.Errorf("FrontendURL() = %q, want trailing slash trimmed", got)
		}
	})

	t.Run("clear", func(t *testing.T) {
		rec := httptest.NewRecorder()
		ClearSessionCookie(rec)
		c := rec.Result().Cookies()[0]
		if c.Name != SessionCookieName || c.Value != "" || c.MaxAge >= 0 {
			t.Errorf("cookie not cleared: %+v", c)
		}
	})
}

func TestFrontendURLDefault(t *testing.T) {
	t.Setenv("FRONTEND_URL", "")
	if got := FrontendURL(); got != "http://localhost:5173" {
		t.Errorf("FrontendURL() = %q, want default", got)
	}
}

func TestIsRedirectURIAllowed(t *testing.T) {
	metadata := &ClientMetadata{RedirectURIs: []string{
		"https://claude.ai/api/mcp/auth_callback",
		"http://localhost/callback",
	}}

	allowed := []string{
		"https://claude.ai/api/mcp/auth_callback",
		"http://localhost:53682/callback", // loopback redirects may use any port
	}
	for _, uri := range allowed {
		if !IsRedirectURIAllowed(metadata, uri) {
			t.Errorf("%s should be allowed", uri)
		}
	}

	denied := []string{
		"https://evil.example.com/api/mcp/auth_callback",
		"http://localhost:53682/other",
	}
	for _, uri := range denied {
		if IsRedirectURIAllowed(metadata, uri) {
			t.Errorf("%s should be rejected", uri)
		}
	}
}

func TestValidateClientIDURL(t *testing.T) {
	if err := validateClientIDURL("https://claude.ai/oauth/client-metadata.json"); err != nil {
		t.Errorf("https client_id rejected: %v", err)
	}
	if err := validateClientIDURL("http://claude.ai/oauth/client-metadata.json"); err == nil {
		t.Error("http client_id should be rejected")
	}
}
