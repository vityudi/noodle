package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type logsHandler struct{ db *pgxpool.Pool }

func (h *logsHandler) ownsProject(r *http.Request, projectID string) bool {
	userID := userIDFromCtx(r.Context())
	var count int
	_ = h.db.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM mcp_projects p
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE p.id = $1 AND w.owner_id = $2`, projectID, userID).Scan(&count)
	return count > 0
}

func (h *logsHandler) list(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	rows, err := h.db.Query(r.Context(), `
		SELECT te.id, te.flow_id, f.name, te.input, te.output, te.error, te.duration_ms, te.executed_at
		FROM tool_executions te
		JOIN flows f ON f.id = te.flow_id
		WHERE f.project_id = $1
		ORDER BY te.executed_at DESC
		LIMIT 100`, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	type logRow struct {
		ID         string      `json:"id"`
		FlowID     string      `json:"flow_id"`
		FlowName   string      `json:"flow_name"`
		Input      interface{} `json:"input"`
		Output     interface{} `json:"output"`
		Error      *string     `json:"error"`
		DurationMS *int        `json:"duration_ms"`
		ExecutedAt time.Time   `json:"executed_at"`
	}

	logs := []logRow{}
	for rows.Next() {
		var l logRow
		var inputJSON, outputJSON []byte
		if err := rows.Scan(&l.ID, &l.FlowID, &l.FlowName, &inputJSON, &outputJSON, &l.Error, &l.DurationMS, &l.ExecutedAt); err != nil {
			continue
		}
		l.Input = rawJSON(inputJSON)
		l.Output = rawJSON(outputJSON)
		logs = append(logs, l)
	}
	writeJSON(w, http.StatusOK, logs)
}

func rawJSON(b []byte) interface{} {
	if b == nil {
		return nil
	}
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return string(b)
	}
	return v
}
