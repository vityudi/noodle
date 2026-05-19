package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type flowsHandler struct{ db *pgxpool.Pool }

type Flow struct {
	ID          string          `json:"id"`
	ProjectID   string          `json:"project_id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	FlowJSON    json.RawMessage `json:"flow_json"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func (h *flowsHandler) ownsProject(ctx context.Context, userID, projectID string) bool {
	var count int
	_ = h.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM mcp_projects p
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE p.id = $1 AND w.owner_id = $2`, projectID, userID).Scan(&count)
	return count > 0
}

func (h *flowsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r.Context(), userID, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, project_id, name, COALESCE(description,''), flow_json, created_at, updated_at FROM flows WHERE project_id = $1 ORDER BY created_at DESC`,
		projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	flows := []Flow{}
	for rows.Next() {
		var f Flow
		if err := rows.Scan(&f.ID, &f.ProjectID, &f.Name, &f.Description, &f.FlowJSON, &f.CreatedAt, &f.UpdatedAt); err != nil {
			continue
		}
		flows = append(flows, f)
	}
	writeJSON(w, http.StatusOK, flows)
}

type flowRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	FlowJSON    json.RawMessage `json:"flow_json"`
}

func (h *flowsHandler) create(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r.Context(), userID, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req flowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, http.StatusBadRequest, "name required")
		return
	}
	if req.FlowJSON == nil {
		req.FlowJSON = json.RawMessage(`{}`)
	}

	var f Flow
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO flows (project_id, name, description, flow_json) VALUES ($1, $2, $3, $4) RETURNING id, project_id, name, COALESCE(description,''), flow_json, created_at, updated_at`,
		projectID, req.Name, req.Description, req.FlowJSON,
	).Scan(&f.ID, &f.ProjectID, &f.Name, &f.Description, &f.FlowJSON, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create flow")
		return
	}
	writeJSON(w, http.StatusCreated, f)
}

func (h *flowsHandler) get(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	projectID := chi.URLParam(r, "projectID")
	flowID := chi.URLParam(r, "flowID")
	if !h.ownsProject(r.Context(), userID, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var f Flow
	err := h.db.QueryRow(r.Context(),
		`SELECT id, project_id, name, COALESCE(description,''), flow_json, created_at, updated_at FROM flows WHERE id = $1 AND project_id = $2`,
		flowID, projectID,
	).Scan(&f.ID, &f.ProjectID, &f.Name, &f.Description, &f.FlowJSON, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "flow not found")
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h *flowsHandler) update(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	projectID := chi.URLParam(r, "projectID")
	flowID := chi.URLParam(r, "flowID")
	if !h.ownsProject(r.Context(), userID, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req flowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	var f Flow
	err := h.db.QueryRow(r.Context(),
		`UPDATE flows SET name = COALESCE(NULLIF($1,''), name), description = $2, flow_json = COALESCE($3, flow_json), updated_at = NOW() WHERE id = $4 AND project_id = $5 RETURNING id, project_id, name, COALESCE(description,''), flow_json, created_at, updated_at`,
		req.Name, req.Description, req.FlowJSON, flowID, projectID,
	).Scan(&f.ID, &f.ProjectID, &f.Name, &f.Description, &f.FlowJSON, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "flow not found")
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h *flowsHandler) delete(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	projectID := chi.URLParam(r, "projectID")
	flowID := chi.URLParam(r, "flowID")
	if !h.ownsProject(r.Context(), userID, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	_, err := h.db.Exec(r.Context(),
		`DELETE FROM flows WHERE id = $1 AND project_id = $2`,
		flowID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
