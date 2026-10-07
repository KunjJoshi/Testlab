package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/KunjJoshi/testlab-backend/internal/auth"
)

func TestDiscoveryMetadata(t *testing.T) {
	h := &DiscoveryHandler{IssuerURL: "https://api.testlab.dev"}
	rec := httptest.NewRecorder()
	h.GetAuthServerMetadata(rec, httptest.NewRequest(http.MethodGet, "/.well-known/oauth-authorization-server", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var m AuthServerMetadata
	if err := json.NewDecoder(rec.Body).Decode(&m); err != nil {
		t.Fatal(err)
	}
	if m.Issuer != "https://api.testlab.dev" ||
		m.AuthEndpoint != "https://api.testlab.dev/authorize" ||
		m.TokenEndpoint != "https://api.testlab.dev/token" ||
		!m.ClientIDMetadataDocumentSupported {
		t.Errorf("unexpected metadata: %+v", m)
	}
}

func TestValidateAuthorizeParams(t *testing.T) {
	if err := validateAuthorizeParams("code", "https://client.example/meta.json",
		"http://localhost/callback", "challenge", "S256"); err != nil {
		t.Errorf("valid params rejected: %v", err)
	}
	if err := validateAuthorizeParams("code", "https://client.example/meta.json",
		"http://localhost/callback", "challenge", "plain"); err == nil {
		t.Error("non-S256 challenge method should be rejected")
	}
}

func TestBuildClientRedirectURL(t *testing.T) {
	got, err := buildClientRedirectURL("http://localhost:3000/callback?x=1", "the-code", "the-state")
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(got)
	q := u.Query()
	if q.Get("code") != "the-code" || q.Get("state") != "the-state" || q.Get("x") != "1" {
		t.Errorf("redirect URL = %s", got)
	}
}

func TestLogoutClearsSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	(&AuthHandler{}).Logout(rec, httptest.NewRequest(http.MethodPost, "/auth/logout", nil))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != auth.SessionCookieName || cookies[0].MaxAge >= 0 {
		t.Errorf("session cookie not cleared: %+v", cookies)
	}
}

func TestValidators(t *testing.T) {
	for _, code := range []int{100, 200, 404, 599} {
		if !isValidHTTPStatus(code) {
			t.Errorf("%d should be valid", code)
		}
	}
	for _, code := range []int{0, 99, 600} {
		if isValidHTTPStatus(code) {
			t.Errorf("%d should be invalid", code)
		}
	}
	if !isBlank("  \t") || isBlank(" x ") {
		t.Error("isBlank misclassified input")
	}
	if !validTestStatuses["in_progress"] || validTestStatuses["done"] {
		t.Error("validTestStatuses wrong")
	}
	if !validAccessScopes["admin"] || validAccessScopes["owner"] {
		t.Error("validAccessScopes wrong")
	}
}
