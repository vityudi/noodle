package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type envHandler struct{ db *pgxpool.Pool }

type EnvVariable struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	Key       string    `json:"key"`
	IsSecret  bool      `json:"is_secret"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *envHandler) ownsProject(r *http.Request, projectID string) bool {
	userID := userIDFromCtx(r.Context())
	var count int
	_ = h.db.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM mcp_projects p
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE p.id = $1 AND w.owner_id = $2`, projectID, userID).Scan(&count)
	return count > 0
}

func (h *envHandler) list(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, project_id, key, is_secret, created_at
		 FROM env_variables WHERE project_id = $1 ORDER BY key ASC`,
		projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	vars := []EnvVariable{}
	for rows.Next() {
		var v EnvVariable
		if err := rows.Scan(&v.ID, &v.ProjectID, &v.Key, &v.IsSecret, &v.CreatedAt); err == nil {
			vars = append(vars, v)
		}
	}
	writeJSON(w, http.StatusOK, vars)
}

type createEnvRequest struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	IsSecret bool   `json:"is_secret"`
}

func (h *envHandler) create(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req createEnvRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Key == "" || req.Value == "" {
		writeError(w, http.StatusBadRequest, "key and value are required")
		return
	}

	setup := &setupHandler{db: h.db}
	secretKey, err := setup.getOrCreateSecretKey(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "secret key unavailable")
		return
	}

	encValue, err := encrypt([]byte(req.Value), secretKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "encryption failed")
		return
	}

	var v EnvVariable
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO env_variables (project_id, key, value_enc, is_secret)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, project_id, key, is_secret, created_at`,
		projectID, req.Key, []byte(encValue), req.IsSecret,
	).Scan(&v.ID, &v.ProjectID, &v.Key, &v.IsSecret, &v.CreatedAt)
	if err != nil {
		writeError(w, http.StatusConflict, "key already exists in this project")
		return
	}
	writeJSON(w, http.StatusCreated, v)
}

func (h *envHandler) delete(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	varID := chi.URLParam(r, "varID")
	_, err := h.db.Exec(r.Context(),
		`DELETE FROM env_variables WHERE id = $1 AND project_id = $2`,
		varID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *envHandler) reveal(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	varID := chi.URLParam(r, "varID")
	var encValue []byte
	err := h.db.QueryRow(r.Context(),
		`SELECT value_enc FROM env_variables WHERE id = $1 AND project_id = $2`,
		varID, projectID,
	).Scan(&encValue)
	if err != nil {
		writeError(w, http.StatusNotFound, "variable not found")
		return
	}

	setup := &setupHandler{db: h.db}
	secretKey, err := setup.getOrCreateSecretKey(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "secret key unavailable")
		return
	}

	plaintext, err := decrypt(encValue, secretKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "decryption failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"value": string(plaintext)})
}
