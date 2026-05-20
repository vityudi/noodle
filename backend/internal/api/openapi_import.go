package api

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gopkg.in/yaml.v3"
)

type openAPIImportHandler struct{ db *pgxpool.Pool }

// SuggestedFlow is a flow generated from an OpenAPI endpoint, ready to be saved.
type SuggestedFlow struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Method      string          `json:"method"`
	Path        string          `json:"path"`
	FlowJSON    json.RawMessage `json:"flow_json"`
}

type importPreviewRequest struct {
	URL  string `json:"url"`
	Spec string `json:"spec"`
}

type importPreviewResponse struct {
	Title     string          `json:"title"`
	BaseURL   string          `json:"base_url"`
	Endpoints []SuggestedFlow `json:"endpoints"`
}

// ── Minimal OpenAPI 3.x / Swagger 2.x types ─────────────────────────────────

type oasSpec struct {
	Swagger string `yaml:"swagger"`
	OpenAPI string `yaml:"openapi"`
	Info    struct {
		Title string `yaml:"title"`
	} `yaml:"info"`
	Servers  []struct{ URL string `yaml:"url"` } `yaml:"servers"`
	Host     string                              `yaml:"host"`
	BasePath string                              `yaml:"basePath"`
	Schemes  []string                            `yaml:"schemes"`
	Paths    map[string]map[string]*oasOperation `yaml:"paths"`
}

type oasOperation struct {
	Summary     string         `yaml:"summary"`
	Description string         `yaml:"description"`
	OperationID string         `yaml:"operationId"`
	Parameters  []oasParameter `yaml:"parameters"`
	RequestBody *struct {
		Content map[string]struct {
			Schema *oasSchema `yaml:"schema"`
		} `yaml:"content"`
	} `yaml:"requestBody"`
}

type oasParameter struct {
	Name        string     `yaml:"name"`
	In          string     `yaml:"in"`
	Description string     `yaml:"description"`
	Required    bool       `yaml:"required"`
	Schema      *oasSchema `yaml:"schema"`
	Type        string     `yaml:"type"` // Swagger 2.x inline
}

type oasSchema struct {
	Type       string                `yaml:"type"`
	Properties map[string]*oasSchema `yaml:"properties"`
	Required   []string              `yaml:"required"`
}

// ── Handler ──────────────────────────────────────────────────────────────────

// preview parses an OpenAPI spec and returns suggested flows without saving anything.
func (h *openAPIImportHandler) preview(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r.Context())
	projectID := chi.URLParam(r, "projectID")

	var count int
	_ = h.db.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM mcp_projects p
		JOIN workspaces ws ON ws.id = p.workspace_id
		WHERE p.id = $1 AND ws.owner_id = $2`, projectID, userID).Scan(&count)
	if count == 0 {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req importPreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	var raw []byte

	switch {
	case req.URL != "":
		resp, err := http.Get(req.URL) //nolint:gosec
		if err != nil {
			writeError(w, http.StatusBadRequest, "could not fetch spec: "+err.Error())
			return
		}
		defer resp.Body.Close()
		raw, err = io.ReadAll(io.LimitReader(resp.Body, 5<<20))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read spec")
			return
		}
	case req.Spec != "":
		raw = []byte(req.Spec)
	default:
		writeError(w, http.StatusBadRequest, "url or spec required")
		return
	}

	var spec oasSpec
	if err := yaml.Unmarshal(raw, &spec); err != nil {
		writeError(w, http.StatusBadRequest, "could not parse spec: "+err.Error())
		return
	}
	if len(spec.Paths) == 0 {
		writeError(w, http.StatusBadRequest, "no paths found in spec")
		return
	}

	baseURL := resolveBaseURL(&spec)
	endpoints := buildSuggestedFlows(&spec, baseURL)

	writeJSON(w, http.StatusOK, importPreviewResponse{
		Title:     spec.Info.Title,
		BaseURL:   baseURL,
		Endpoints: endpoints,
	})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func resolveBaseURL(spec *oasSpec) string {
	if len(spec.Servers) > 0 && spec.Servers[0].URL != "" {
		return strings.TrimRight(spec.Servers[0].URL, "/")
	}
	if spec.Host != "" {
		scheme := "https"
		if len(spec.Schemes) > 0 {
			scheme = spec.Schemes[0]
		}
		base := scheme + "://" + spec.Host
		if spec.BasePath != "" && spec.BasePath != "/" {
			base += spec.BasePath
		}
		return base
	}
	return ""
}

var skipMethods = map[string]bool{"head": true, "options": true, "trace": true, "parameters": true}

func buildSuggestedFlows(spec *oasSpec, baseURL string) []SuggestedFlow {
	var flows []SuggestedFlow
	for path, methods := range spec.Paths {
		for method, op := range methods {
			if op == nil || skipMethods[strings.ToLower(method)] {
				continue
			}
			flows = append(flows, buildFlow(baseURL, method, path, op))
		}
	}
	sort.Slice(flows, func(i, j int) bool {
		if flows[i].Path != flows[j].Path {
			return flows[i].Path < flows[j].Path
		}
		return flows[i].Method < flows[j].Method
	})
	return flows
}

func buildFlow(baseURL, method, path string, op *oasOperation) SuggestedFlow {
	name := flowName(op, method, path)
	desc := op.Summary
	if desc == "" {
		desc = op.Description
	}

	inputSchema := map[string]interface{}{}
	paramsConfig := map[string]interface{}{}
	bodyConfig := map[string]interface{}{}
	urlPath := path

	for _, p := range op.Parameters {
		if p.Name == "" || p.In == "header" || p.In == "cookie" {
			continue
		}
		t := resolveParamType(p)
		switch p.In {
		case "path":
			inputSchema[p.Name] = map[string]interface{}{"type": t, "description": p.Description, "required": true}
			urlPath = strings.ReplaceAll(urlPath, "{"+p.Name+"}", "{{input."+p.Name+"}}")
		case "query":
			inputSchema[p.Name] = map[string]interface{}{"type": t, "description": p.Description, "required": p.Required}
			paramsConfig[p.Name] = "{{input." + p.Name + "}}"
		case "body": // Swagger 2.x
			if p.Schema != nil {
				addSchemaToInput(p.Schema, inputSchema, bodyConfig)
			}
		}
	}

	// OAS3 requestBody
	if op.RequestBody != nil {
		if content, ok := op.RequestBody.Content["application/json"]; ok && content.Schema != nil {
			addSchemaToInput(content.Schema, inputSchema, bodyConfig)
		}
	}

	nodeConfig := map[string]interface{}{
		"url":    baseURL + urlPath,
		"method": strings.ToUpper(method),
	}
	if len(paramsConfig) > 0 {
		nodeConfig["params"] = paramsConfig
	}
	if len(bodyConfig) > 0 {
		nodeConfig["body"] = bodyConfig
	}

	flowDef := map[string]interface{}{
		"schema_version": "1.0",
		"name":           name,
		"description":    desc,
		"input_schema":   inputSchema,
		"nodes": []map[string]interface{}{
			{
				"id":   "request",
				"type": "http_request",
				"config": nodeConfig,
				"outputs": map[string]interface{}{
					"status":  map[string]string{"type": "number"},
					"body":    map[string]string{"type": "any"},
					"headers": map[string]string{"type": "object"},
				},
			},
		},
		"edges":  []interface{}{},
		"output": "{{nodes.request.outputs.body}}",
	}
	flowJSON, _ := json.Marshal(flowDef)

	return SuggestedFlow{
		Name:        name,
		Description: desc,
		Method:      strings.ToUpper(method),
		Path:        path,
		FlowJSON:    flowJSON,
	}
}

func addSchemaToInput(schema *oasSchema, inputSchema, bodyConfig map[string]interface{}) {
	for propName, propSchema := range schema.Properties {
		t := "string"
		if propSchema != nil && propSchema.Type != "" {
			t = propSchema.Type
		}
		required := oasContains(schema.Required, propName)
		inputSchema[propName] = map[string]interface{}{"type": t, "required": required}
		bodyConfig[propName] = "{{input." + propName + "}}"
	}
}

func flowName(op *oasOperation, method, path string) string {
	if op.OperationID != "" {
		return camelToSnake(op.OperationID)
	}
	return strings.ToLower(method) + "_" + pathToSnake(path)
}

var (
	rePathParam  = regexp.MustCompile(`\{([^}]+)\}`)
	reNonAlnum   = regexp.MustCompile(`[^a-z0-9]+`)
)

func pathToSnake(path string) string {
	s := rePathParam.ReplaceAllString(path, "_by_$1")
	s = reNonAlnum.ReplaceAllString(strings.ToLower(s), "_")
	return strings.Trim(s, "_")
}

func camelToSnake(s string) string {
	var b strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) && i > 0 {
			b.WriteRune('_')
		}
		b.WriteRune(unicode.ToLower(r))
	}
	// Replace any non-alnum (hyphens, spaces) with underscore
	return reNonAlnum.ReplaceAllString(b.String(), "_")
}

func resolveParamType(p oasParameter) string {
	if p.Schema != nil && p.Schema.Type != "" {
		return p.Schema.Type
	}
	if p.Type != "" {
		return p.Type
	}
	return "string"
}

func oasContains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}
