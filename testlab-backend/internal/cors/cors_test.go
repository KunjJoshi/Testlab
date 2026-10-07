package cors

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestParseOrigins(t *testing.T) {
	got := ParseOrigins(" https://a.example.com/, https://b.example.com ,*,", "http://localhost:5173")
	want := []string{"https://a.example.com", "https://b.example.com"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ParseOrigins = %v, want %v", got, want)
	}

	if got := ParseOrigins("", "http://localhost:5173"); !reflect.DeepEqual(got, []string{"http://localhost:5173"}) {
		t.Errorf("empty value should fall back to the frontend URL, got %v", got)
	}
}

func TestMiddleware(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	handler := Middleware([]string{"http://localhost:5173"})(next)

	t.Run("preflight from allowed origin", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodOptions, "/suites", nil)
		r.Header.Set("Origin", "http://localhost:5173")
		r.Header.Set("Access-Control-Request-Method", http.MethodPatch)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, r)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want 204", rec.Code)
		}
		h := rec.Header()
		if h.Get("Access-Control-Allow-Origin") != "http://localhost:5173" ||
			h.Get("Access-Control-Allow-Credentials") != "true" ||
			h.Get("Access-Control-Allow-Methods") == "" {
			t.Errorf("missing CORS headers: %v", h)
		}
	})

	t.Run("simple request from allowed origin", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/suites", nil)
		r.Header.Set("Origin", "http://localhost:5173")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, r)

		if rec.Code != http.StatusTeapot {
			t.Errorf("request should reach the next handler, got %d", rec.Code)
		}
		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
			t.Error("allowed origin should be echoed")
		}
	})

	t.Run("other origin", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/suites", nil)
		r.Header.Set("Origin", "https://evil.example.com")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, r)

		if rec.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Error("disallowed origin must not get CORS headers")
		}
	})
}
