package transport

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vityudi/noodle/backend/internal/credentials"
	"github.com/vityudi/noodle/backend/internal/mcp"
	"github.com/vityudi/noodle/backend/internal/mcp/runtime"
)

var credRefRe = regexp.MustCompile(`\{\{credentials\.([^.}]+)\.`)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

// Routes mounts MCP endpoints on r.
//
//   GET  /mcp/{slug}                  — list tools (REST discovery)
//   POST /mcp/{slug}/tools/call       — execute a tool (REST)
//   GET  /mcp/{slug}/resources        — list resources (REST)
//   POST /mcp/{slug}/resources/read   — read a resource (REST)
//   GET  /mcp/{slug}/sse              — SSE stream (MCP protocol transport)
//   POST /mcp/{slug}/message          — JSON-RPC messages from MCP client
func (h *Handler) Routes(r chi.Router) {
	r.Get("/mcp/{slug}", h.listTools)
	r.Get("/mcp/{slug}/status", h.status)
	r.Post("/mcp/{slug}/tools/call", h.callTool)
	r.Get("/mcp/{slug}/resources", h.listResources)
	r.Post("/mcp/{slug}/resources/read", h.readResource)
	r.Get("/mcp/{slug}/sse", h.sseConnect)
	r.Post("/mcp/{slug}/message", h.sseMessage)
}

// ToolDef is the MCP tool descriptor returned by the discovery endpoint.
type ToolDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

type projectMeta struct {
	id       string
	name     string
	readOnly bool
}

func (h *Handler) projectBySlug(ctx context.Context, slug string) (*projectMeta, error) {
	var p projectMeta
	err := h.db.QueryRow(ctx,
		`SELECT id, name, read_only FROM mcp_projects WHERE slug = $1`, slug,
	).Scan(&p.id, &p.name, &p.readOnly)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

type flowRow struct {
	id          string
	name        string
	flowJSON    []byte
	flowType    string
	resourceURI string
}

func (h *Handler) flowsForProject(ctx context.Context, projectID string) ([]flowRow, error) {
	rows, err := h.db.Query(ctx,
		`SELECT id, name, flow_json, COALESCE(flow_type,'tool'), COALESCE(resource_uri,'') FROM flows WHERE project_id = $1`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []flowRow
	for rows.Next() {
		var f flowRow
		if err := rows.Scan(&f.id, &f.name, &f.flowJSON, &f.flowType, &f.resourceURI); err == nil {
			out = append(out, f)
		}
	}
	return out, nil
}

// status returns whether any MCP client is currently connected via SSE.
func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if _, err := h.projectBySlug(r.Context(), slug); err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	n := activeSessionCount(slug)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"connected": n > 0,
		"sessions":  n,
	})
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

	// Load schema caches for all credentials in this project once.
	schemaCaches, _ := h.loadSchemaCaches(r.Context(), proj.id)

	tools := make([]ToolDef, 0)
	for _, f := range flowRows {
		if f.flowType != "tool" {
			continue
		}
		var def mcp.FlowDef
		if err := json.Unmarshal(f.flowJSON, &def); err != nil {
			continue
		}
		desc := def.Description
		if schema := h.buildSchemaContext(&def, schemaCaches); schema != "" {
			desc += "\n\nDatabase schema:\n" + schema
		}
		tools = append(tools, ToolDef{
			Name:        f.name,
			Description: desc,
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
		creds = nil
	}

	// Load project env vars so flows can use {{env.KEY}}.
	envVars, err := credentials.LoadEnvVars(r.Context(), h.db, proj.id)
	if err != nil {
		envVars = nil
	}

	start := time.Now()
	result, execErr := runtime.Run(r.Context(), &def, input, creds, envVars, proj.readOnly)
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

// ResourceDef is the MCP resource descriptor returned by the resources endpoint.
type ResourceDef struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType"`
}

func (h *Handler) listResources(w http.ResponseWriter, r *http.Request) {
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

	resources := make([]ResourceDef, 0)
	for _, f := range flowRows {
		if f.flowType != "resource" || f.resourceURI == "" {
			continue
		}
		var def mcp.FlowDef
		if err := json.Unmarshal(f.flowJSON, &def); err != nil {
			continue
		}
		resources = append(resources, ResourceDef{
			URI:         f.resourceURI,
			Name:        f.name,
			Description: def.Description,
			MimeType:    "application/json",
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"resources": resources})
}

type readRequest struct {
	URI string `json:"uri"`
}

func (h *Handler) readResource(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var req readRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.URI == "" {
		writeError(w, http.StatusBadRequest, "uri required")
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
		if f.flowType == "resource" && f.resourceURI == req.URI {
			matched = &flowRows[i]
			break
		}
	}
	if matched == nil {
		writeError(w, http.StatusNotFound, "resource not found")
		return
	}

	var def mcp.FlowDef
	if err := json.Unmarshal(matched.flowJSON, &def); err != nil {
		writeError(w, http.StatusInternalServerError, "invalid flow definition")
		return
	}

	creds, _ := credentials.LoadDecrypted(r.Context(), h.db, proj.id)
	envVars, _ := credentials.LoadEnvVars(r.Context(), h.db, proj.id)

	start := time.Now()
	result, execErr := runtime.Run(r.Context(), &def, map[string]interface{}{}, creds, envVars, proj.readOnly)
	durationMS := int(time.Since(start).Milliseconds())
	go h.logExecution(matched.id, map[string]interface{}{"uri": req.URI}, result, execErr, durationMS)

	if execErr != nil {
		writeError(w, http.StatusUnprocessableEntity, execErr.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"contents": []map[string]interface{}{
			{"uri": req.URI, "mimeType": "application/json", "text": toText(result)},
		},
	})
}

// loadSchemaCaches returns a map of credential name → schema_cache for a project.
func (h *Handler) loadSchemaCaches(ctx context.Context, projectID string) (map[string]string, error) {
	rows, err := h.db.Query(ctx,
		`SELECT name, schema_cache FROM credentials WHERE project_id = $1 AND schema_cache IS NOT NULL AND schema_cache != ''`,
		projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]string)
	for rows.Next() {
		var name, schema string
		if err := rows.Scan(&name, &schema); err == nil {
			out[name] = schema
		}
	}
	return out, rows.Err()
}

// buildSchemaContext finds all {{credentials.NAME.*}} references in the flow and
// returns the combined schema string for those credentials (if cached).
func (h *Handler) buildSchemaContext(def *mcp.FlowDef, schemaCaches map[string]string) string {
	if len(schemaCaches) == 0 {
		return ""
	}

	seen := make(map[string]bool)
	var parts []string

	var walkValue func(v interface{})
	walkValue = func(v interface{}) {
		switch val := v.(type) {
		case string:
			for _, m := range credRefRe.FindAllStringSubmatch(val, -1) {
				name := m[1]
				if !seen[name] {
					seen[name] = true
					if schema, ok := schemaCaches[name]; ok {
						parts = append(parts, schema)
					}
				}
			}
		case map[string]interface{}:
			for _, v := range val {
				walkValue(v)
			}
		case []interface{}:
			for _, v := range val {
				walkValue(v)
			}
		}
	}

	for _, node := range def.Nodes {
		walkValue(node.Config)
	}

	if len(parts) == 0 {
		return ""
	}
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += "\n"
		}
		result += p
	}
	return result
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
