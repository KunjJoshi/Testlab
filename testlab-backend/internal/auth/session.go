package auth

import (
	"net/http"
	"os"
	"strings"
)

// SessionCookieName holds the browser session JWT. It is HttpOnly, so page
// scripts can never read it; API clients such as the MCP server keep using the
// Authorization header instead.
const SessionCookieName = "testlab_session"

// CSRFHeader must accompany state-changing requests authenticated by the
// session cookie. Cross-site forms cannot set custom headers, and cross-origin
// scripts can only do so after a CORS preflight the server would refuse.
const CSRFHeader = "X-Requested-With"

// FrontendURL is where the browser is sent after GitHub login. It comes only
// from configuration, never from the request, so it cannot become an open redirect.
func FrontendURL() string {
	if u := os.Getenv("FRONTEND_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:5173"
}

// cookieSecure defaults to true whenever the frontend is served over HTTPS.
// COOKIE_SECURE=true|false overrides it.
func cookieSecure() bool {
	switch os.Getenv("COOKIE_SECURE") {
	case "true":
		return true
	case "false":
		return false
	}
	return strings.HasPrefix(FrontendURL(), "https://")
}

func SetSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(TokenTTL.Seconds()),
		HttpOnly: true,
		Secure:   cookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   cookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}
