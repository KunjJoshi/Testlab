// Package cors lets a browser app on another origin call the API with the
// session cookie. Same-origin deployments (frontend and API behind one reverse
// proxy) don't need it, but it is harmless there.
package cors

import (
	"net/http"
	"strings"
)

const (
	allowedMethods = "GET, POST, PATCH, DELETE, OPTIONS"
	allowedHeaders = "Content-Type, Authorization, X-Requested-With"
)

// ParseOrigins reads a comma-separated ALLOWED_ORIGINS value, falling back to
// the frontend URL. A wildcard is never allowed: credentialed requests require
// an exact origin.
func ParseOrigins(raw, fallback string) []string {
	var origins []string
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o != "" && o != "*" {
			origins = append(origins, o)
		}
	}
	if len(origins) == 0 && fallback != "" {
		origins = []string{fallback}
	}
	return origins
}

func Middleware(origins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(origins))
	for _, o := range origins {
		allowed[o] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			w.Header().Add("Vary", "Origin")

			if origin != "" && allowed[origin] {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")

				if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
					h.Set("Access-Control-Allow-Methods", allowedMethods)
					h.Set("Access-Control-Allow-Headers", allowedHeaders)
					h.Set("Access-Control-Max-Age", "600")
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
