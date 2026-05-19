package api

import (
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// setupGuard blocks all non-setup routes until the wizard is complete.
func setupGuard(db *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Always allow setup and health endpoints.
			if strings.HasPrefix(r.URL.Path, "/api/setup") || r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			var count int
			_ = db.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&count)
			if count == 0 {
				writeJSON(w, http.StatusServiceUnavailable, map[string]any{
					"setup_required": true,
					"message":        "complete setup at /setup",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
