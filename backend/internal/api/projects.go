package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type projectsHandler struct{ db *pgxpool.Pool }

type Project struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h *projectsHandler) workspaceID(ctx context.Context, userID string) (string, error) {
	var id string
	err := h.db.QueryRow(ctx, `SELECT id FROM workspaces WHERE owner_id = $1`, userID).Scan(&id)
	return id, err
}

func (h *projectsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	wsID, err := h.workspaceID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, workspace_id, name, slug, COALESCE(description,''), created_at FROM mcp_projects WHERE workspace_id = $1 ORDER BY created_at DESC`,
		wsID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Slug, &p.Description, &p.CreatedAt); err != nil {
			continue
		}
		projects = append(projects, p)
	}
	writeJSON(w, http.StatusOK, projects)
}

type projectRequest struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
}

func (h *projectsHandler) create(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	wsID, err := h.workspaceID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}

	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Slug == "" {
		writeError(w, http.StatusBadRequest, "name and slug required")
		return
	}
	req.Slug = strings.ToLower(strings.ReplaceAll(req.Slug, " ", "-"))

	var p Project
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO mcp_projects (workspace_id, name, slug, description) VALUES ($1, $2, $3, $4) RETURNING id, workspace_id, name, slug, COALESCE(description,''), created_at`,
		wsID, req.Name, req.Slug, req.Description,
	).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Slug, &p.Description, &p.CreatedAt)
	if err != nil {
		writeError(w, http.StatusConflict, "slug already taken")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *projectsHandler) get(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	wsID, err := h.workspaceID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}
	projectID := chi.URLParam(r, "projectID")

	var p Project
	err = h.db.QueryRow(r.Context(),
		`SELECT id, workspace_id, name, slug, COALESCE(description,''), created_at FROM mcp_projects WHERE id = $1 AND workspace_id = $2`,
		projectID, wsID,
	).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Slug, &p.Description, &p.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *projectsHandler) update(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	wsID, err := h.workspaceID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}
	projectID := chi.URLParam(r, "projectID")

	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	var p Project
	err = h.db.QueryRow(r.Context(),
		`UPDATE mcp_projects SET name = COALESCE(NULLIF($1,''), name), description = $2 WHERE id = $3 AND workspace_id = $4 RETURNING id, workspace_id, name, slug, COALESCE(description,''), created_at`,
		req.Name, req.Description, projectID, wsID,
	).Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Slug, &p.Description, &p.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *projectsHandler) delete(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	wsID, err := h.workspaceID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}
	projectID := chi.URLParam(r, "projectID")

	_, err = h.db.Exec(r.Context(),
		`DELETE FROM mcp_projects WHERE id = $1 AND workspace_id = $2`,
		projectID, wsID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
