package transport

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vityudi/noodle/backend/internal/credentials"
	"github.com/vityudi/noodle/backend/internal/mcp"
	"github.com/vityudi/noodle/backend/internal/mcp/runtime"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

// Routes mounts MCP endpoints on r.
//
//   GET  /mcp/{slug}              — list tools (discovery)
//   POST /mcp/{slug}/tools/call   — execute a tool
func (h *Handler) Routes(r chi.Router) {
	r.Get("/mcp/{slug}", h.listTools)
	r.Post("/mcp/{slug}/tools/call", h.callTool)
}

// ToolDef is the MCP tool descriptor returned by the discovery endpoint.
type ToolDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

type projectMeta struct {
	id   string
	name string
}

func (h *Handler) projectBySlug(ctx context.Context, slug string) (*projectMeta, error) {
	var p projectMeta
	err := h.db.QueryRow(ctx,
		`SELECT id, name FROM mcp_projects WHERE slug = $1`, slug,
	).Scan(&p.id, &p.name)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

type flowRow struct {
	id       string
	name     string
	flowJSON []byte
}

func (h *Handler) flowsForProject(ctx context.Context, projectID string) ([]flowRow, error) {
	rows, err := h.db.Query(ctx,
		`SELECT id, name, flow_json FROM flows WHERE project_id = $1`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []flowRow
	for rows.Next() {
		var f flowRow
		if err := rows.Scan(&f.id, &f.name, &f.flowJSON); err == nil {
			out = append(out, f)
		}
	}
	return out, nil
}

func (h *Handler) listTools(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	proj, err := h.projectBySlug(r.Context(), slug)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	flowRows, err := h.flowsForProject(r.Context(), proj.id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	tools := make([]ToolDef, 0, len(flowRows))
	for _, f := range flowRows {
		var def mcp.FlowDef
		if err := json.Unmarshal(f.flowJSON, &def); err != nil {
			continue
		}
		tools = append(tools, ToolDef{
			Name:        f.name,
			Description: def.Description,
			InputSchema: buildInputSchema(def.InputSchema),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"name":    proj.name,
		"version": "1.0",
		"tools":   tools,
	})
}

type callRequest struct {
	Tool  string                 `json:"tool"`
	Input map[string]interface{} `json:"input"`
}

func (h *Handler) callTool(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var req callRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Tool == "" {
		writeError(w, http.StatusBadRequest, "tool name required")
		return
	}

	proj, err := h.projectBySlug(r.Context(), slug)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	flowRows, err := h.flowsForProject(r.Context(), proj.id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	var matched *flowRow
	for i, f := range flowRows {
		if f.name == req.Tool {
			matched = &flowRows[i]
			break
		}
	}
	if matched == nil {
		writeError(w, http.StatusNotFound, "tool not found")
		return
	}

	var def mcp.FlowDef
	if err := json.Unmarshal(matched.flowJSON, &def); err != nil {
		writeError(w, http.StatusInternalServerError, "invalid flow definition")
		return
	}

	input := req.Input
	if input == nil {
		input = map[string]interface{}{}
	}

	// Load project credentials so flows can use {{credentials.name.field}}.
	creds, err := credentials.LoadDecrypted(r.Context(), h.db, proj.id)
	if err != nil {
		// Non-fatal: proceed without credentials — runtime will leave unresolved refs as-is.
		creds = nil
	}

	start := time.Now()
	result, execErr := runtime.Run(r.Context(), &def, input, creds)
	durationMS := int(time.Since(start).Milliseconds())

	// Persist execution log.
	go h.logExecution(matched.id, input, result, execErr, durationMS)

	if execErr != nil {
		writeError(w, http.StatusUnprocessableEntity, execErr.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"output": result})
}

func (h *Handler) logExecution(flowID string, input, output interface{}, execErr error, durationMS int) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	inputJSON, _ := json.Marshal(input)
	outputJSON, _ := json.Marshal(output)

	var errStr *string
	if execErr != nil {
		s := execErr.Error()
		errStr = &s
	}

	h.db.Exec(ctx,
		`INSERT INTO tool_executions (flow_id, input, output, error, duration_ms) VALUES ($1, $2, $3, $4, $5)`,
		flowID, inputJSON, outputJSON, errStr, durationMS)
}

func buildInputSchema(schema map[string]mcp.InputFieldDef) map[string]interface{} {
	props := make(map[string]interface{}, len(schema))
	required := []string{}

	for name, f := range schema {
		prop := map[string]interface{}{"type": f.Type}
		if f.Description != "" {
			prop["description"] = f.Description
		}
		props[name] = prop
		if f.Required {
			required = append(required, name)
		}
	}

	out := map[string]interface{}{
		"type":       "object",
		"properties": props,
	}
	if len(required) > 0 {
		out["required"] = required
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
