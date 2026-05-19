package api

import (
	"context"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func setupGuard(db *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

func jwtMiddleware(db *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeError(w, http.StatusUnauthorized, "missing token")
				return
			}
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

			var keyHex string
			if err := db.QueryRow(r.Context(), `SELECT value FROM settings WHERE key = 'secret_key'`).Scan(&keyHex); err != nil {
				writeError(w, http.StatusUnauthorized, "invalid token")
				return
			}
			key, err := hex.DecodeString(keyHex)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid token")
				return
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method")
				}
				return key, nil
			})
			if err != nil || !token.Valid {
				writeError(w, http.StatusUnauthorized, "invalid token")
				return
			}

			claims, _ := token.Claims.(jwt.MapClaims)
			userID, _ := claims["sub"].(string)
			ctx := context.WithValue(r.Context(), ctxUserID, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
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
