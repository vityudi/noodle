package api

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vityudi/noodle/backend/internal/mcp/schema"
	"github.com/vityudi/noodle/backend/internal/mcp/templates"
	"github.com/vityudi/noodle/backend/internal/mcp/transport"
)

func NewRouter(db *pgxpool.Pool, devMode bool) http.Handler {
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

	if devMode {
		r.Post("/api/dev/auto-login", setup.devAutoLogin)
	}

	auth := &authHandler{db: db}
	r.Post("/api/auth/login", auth.login)

	r.Group(func(r chi.Router) {
		r.Use(jwtMiddleware(db))

		projects := &projectsHandler{db: db}
		r.Route("/api/projects", func(r chi.Router) {
			r.Get("/", projects.list)
			r.Post("/", projects.create)
			r.Get("/{projectID}", projects.get)
			r.Put("/{projectID}", projects.update)
			r.Delete("/{projectID}", projects.delete)
		})

		flows := &flowsHandler{db: db}
		r.Route("/api/projects/{projectID}/flows", func(r chi.Router) {
			r.Get("/", flows.list)
			r.Post("/", flows.create)
			r.Get("/{flowID}", flows.get)
			r.Put("/{flowID}", flows.update)
			r.Delete("/{flowID}", flows.delete)
		})

		creds := &credentialsHandler{db: db}
		r.Route("/api/projects/{projectID}/credentials", func(r chi.Router) {
			r.Get("/", creds.list)
			r.Post("/", creds.create)
			r.Delete("/{credID}", creds.delete)
			r.Get("/{credID}/reveal", creds.reveal)
		})

		logs := &logsHandler{db: db}
		r.Get("/api/projects/{projectID}/logs", logs.list)

		aiFlow := &aiFlowHandler{db: db}
		r.Post("/api/projects/{projectID}/ai/generate", aiFlow.generate)

		sett := settingsHandlerFor(db)
		r.Route("/api/settings", func(r chi.Router) {
			r.Get("/ai", sett.getAI)
			r.Put("/ai", sett.updateAI)
		})
	})

	// Public endpoints — no auth required.
	r.Get("/schema/flow.json", schema.Handler)
	r.Get("/api/templates", templates.ListHandler)

	// MCP endpoints — public (no JWT required), accessed by external agents.
	mcpHandler := transport.NewHandler(db)
	mcpHandler.Routes(r)

	return r
}
