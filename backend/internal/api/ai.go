package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type aiFlowHandler struct{ db *pgxpool.Pool }

const systemPrompt = `You are a flow builder assistant for Noodle, a visual MCP server builder.
Your job is to generate a valid Noodle flow JSON based on the user's description.

RESPOND WITH ONLY THE RAW JSON OBJECT. No markdown, no code blocks, no explanation.

Flow schema (schema_version "1.0"):
{
  "schema_version": "1.0",
  "name": "snake_case_tool_name",
  "description": "What this tool does for an agent",
  "input_schema": {
    "param_name": {"type": "string|number|boolean|object|array", "required": true, "description": "..."}
  },
  "nodes": [
    {
      "id": "meaningful_id",
      "type": "http_request|json_transform|condition",
      "config": { ...node config... },
      "outputs": {"field": {"type": "any|string|number|boolean|object|array"}}
    }
  ],
  "edges": [{"from": "node_id", "to": "node_id"}],
  "output": "{{nodes.last_node_id.outputs.field}}"
}

Available node types:
- http_request: config={url, method (GET/POST/PUT/DELETE/PATCH), headers (object), params (object), body (any)}
  outputs: {status (number), body (any), headers (object)}

- json_transform: config={mapping: {"output_key": "value or {{template}}"}}
  outputs: {result (object)}

- condition: config={left, operator (eq/ne/gt/lt/gte/lte/contains), right}
  outputs: {result (boolean)}

Template expressions (use inside any config string value):
- {{input.field}}                    — input parameter
- {{nodes.id.outputs.field.subfield}} — dot-path into another node's output
- {{env.VAR_NAME}}                   — environment variable
- {{credentials.cred_name}}          — stored credential (decrypted at runtime)

Rules:
- Use snake_case for "name" (it becomes the MCP tool name)
- Use meaningful IDs for nodes (e.g. "fetch_user", "check_status", "format_result")
- Always include an "output" expression pointing to the terminal node's main output
- Keep it minimal — only include nodes needed for the task`

type generateRequest struct {
	Message     string      `json:"message"`
	CurrentFlow interface{} `json:"current_flow"`
}

func (h *aiFlowHandler) generate(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")

	// Ownership check.
	userID := userIDFromCtx(r.Context())
	var count int
	_ = h.db.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM mcp_projects p
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE p.id = $1 AND w.owner_id = $2`, projectID, userID).Scan(&count)
	if count == 0 {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req generateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	// Load AI settings.
	setup := &setupHandler{db: h.db}
	secretKey, err := setup.getOrCreateSecretKey(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "secret key error")
		return
	}

	var provider, model, apiKeyEnc string
	_ = h.db.QueryRow(r.Context(), `SELECT value FROM settings WHERE key = 'ai_provider'`).Scan(&provider)
	_ = h.db.QueryRow(r.Context(), `SELECT value FROM settings WHERE key = 'ai_model'`).Scan(&model)
	_ = h.db.QueryRow(r.Context(), `SELECT value FROM settings WHERE key = 'ai_api_key_enc'`).Scan(&apiKeyEnc)

	if provider == "" {
		writeError(w, http.StatusUnprocessableEntity, "AI provider not configured — go to Settings first")
		return
	}

	var apiKey string
	if apiKeyEnc != "" {
		plain, err := decrypt([]byte(apiKeyEnc), secretKey)
		if err == nil {
			apiKey = string(plain)
		}
	}

	// Build user message.
	userMsg := req.Message
	if req.CurrentFlow != nil {
		currentJSON, _ := json.MarshalIndent(req.CurrentFlow, "", "  ")
		userMsg = fmt.Sprintf("%s\n\nCurrent flow (modify or replace as needed):\n%s", req.Message, string(currentJSON))
	}

	// Call the AI.
	flowJSON, err := callAI(provider, model, apiKey, userMsg)
	if err != nil {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("AI error: %s", err.Error()))
		return
	}

	// Validate it's JSON.
	var parsed interface{}
	if err := json.Unmarshal([]byte(flowJSON), &parsed); err != nil {
		writeError(w, http.StatusBadGateway, "AI returned invalid JSON")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"flow": parsed})
}

func callAI(provider, model, apiKey, userMessage string) (string, error) {
	switch provider {
	case "anthropic":
		return callAnthropic(model, apiKey, userMessage)
	case "openai":
		return callOpenAI(model, apiKey, userMessage)
	case "ollama":
		return callOllama(model, userMessage)
	default:
		return "", fmt.Errorf("unknown provider: %s", provider)
	}
}

// --- Anthropic ---

func callAnthropic(model, apiKey, userMessage string) (string, error) {
	if model == "" {
		model = "claude-sonnet-4-6"
	}
	body, _ := json.Marshal(map[string]interface{}{
		"model":      model,
		"max_tokens": 4096,
		"system":     systemPrompt,
		"messages":   []map[string]string{{"role": "user", "content": userMessage}},
	})

	req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic %d: %s", resp.StatusCode, raw)
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(raw, &result); err != nil || len(result.Content) == 0 {
		return "", fmt.Errorf("unexpected response format")
	}
	return extractJSON(result.Content[0].Text), nil
}

// --- OpenAI ---

func callOpenAI(model, apiKey, userMessage string) (string, error) {
	if model == "" {
		model = "gpt-4o"
	}
	body, _ := json.Marshal(map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMessage},
		},
	})

	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai %d: %s", resp.StatusCode, raw)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &result); err != nil || len(result.Choices) == 0 {
		return "", fmt.Errorf("unexpected response format")
	}
	return extractJSON(result.Choices[0].Message.Content), nil
}

// --- Ollama ---

func callOllama(model, userMessage string) (string, error) {
	if model == "" {
		model = "llama3"
	}
	body, _ := json.Marshal(map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMessage},
		},
		"stream": false,
	})

	resp, err := http.Post("http://ollama:11434/api/chat", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("ollama unreachable: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", fmt.Errorf("unexpected response format")
	}
	return extractJSON(result.Message.Content), nil
}

// extractJSON strips markdown code fences and extracts the first JSON object.
var jsonRe = regexp.MustCompile(`(?s)\{.*\}`)

func extractJSON(text string) string {
	text = strings.TrimSpace(text)
	// Strip ```json ... ``` or ``` ... ```
	text = regexp.MustCompile("(?s)```(?:json)?\\s*").ReplaceAllString(text, "")
	text = strings.ReplaceAll(text, "```", "")
	text = strings.TrimSpace(text)
	if match := jsonRe.FindString(text); match != "" {
		return match
	}
	return text
}
