// internal/auth/middleware.go
package auth

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
)

type contextKey string

const bearerTokenKey contextKey = "bearer_token"

func RequireBearerToken(next http.Handler) http.Handler {
	return http.HandlerFunc(newBearerMiddlewareHandler(next))
}

func newBearerMiddlewareHandler(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			writeUnauthorized(w)
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		if _, err := ParseToken(tokenStr); err != nil {
			writeUnauthorized(w)
			return
		}

		ctx := context.WithValue(r.Context(), bearerTokenKey, tokenStr)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func writeUnauthorized(w http.ResponseWriter) {
	resourceURL := fmt.Sprintf("%s/.well-known/oauth-protected-resource", os.Getenv("MCP_SELF_URL"))
	w.Header().Set("WWW-Authenticate", fmt.Sprintf(`Bearer resource_metadata="%s"`, resourceURL))
	w.WriteHeader(http.StatusUnauthorized)
}

func TokenFromContext(ctx context.Context) (string, bool) {
	token, ok := ctx.Value(bearerTokenKey).(string)
	return token, ok
}
