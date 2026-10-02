package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const userIDKey contextKey = "user_id"

// RequireAuth accepts either an `Authorization: Bearer` token (API and MCP
// clients) or the HttpOnly session cookie (the browser app).
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr, fromCookie := tokenFromRequest(r)
		if tokenStr == "" {
			http.Error(w, "missing or invalid Authorization header", http.StatusUnauthorized)
			return
		}

		claims, err := ParseToken(tokenStr)
		if err != nil {
			http.Error(w, "invalid or expired token", http.StatusUnauthorized)
			return
		}

		if fromCookie && !isSafeMethod(r.Method) && r.Header.Get(CSRFHeader) == "" {
			http.Error(w, "missing "+CSRFHeader+" header", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func tokenFromRequest(r *http.Request) (token string, fromCookie bool) {
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		if strings.HasPrefix(authHeader, "Bearer ") {
			return strings.TrimPrefix(authHeader, "Bearer "), false
		}
		return "", false
	}
	if cookie, err := r.Cookie(SessionCookieName); err == nil {
		return cookie.Value, true
	}
	return "", false
}

func isSafeMethod(method string) bool {
	return method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions
}

func UserIDFromContext(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(userIDKey).(int64)
	return id, ok
}
