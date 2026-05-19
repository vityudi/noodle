package api

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewRouter(db *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(corsMiddleware)
	r.Use(setupGuard(db))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	setup := &setupHandler{db: db}
	r.Route("/api/setup", func(r chi.Router) {
		r.Get("/status", setup.status)
		r.Post("/admin", setup.createAdmin)
		r.Post("/ai", setup.configureAI)
		r.Post("/skip-ai", setup.skipAI)
	})

	return r
}
