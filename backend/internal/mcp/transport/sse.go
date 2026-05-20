package transport

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/vityudi/noodle/backend/internal/credentials"
	"github.com/vityudi/noodle/backend/internal/mcp"
	"github.com/vityudi/noodle/backend/internal/mcp/runtime"
)

// session holds the outbound SSE channel for a connected MCP client.
type session struct {
	ch   chan string // JSON-encoded SSE data lines
	slug string
}

var (
	sessionsMu sync.Mutex
	sessions   = map[string]*session{}
)

func newSession(slug string) (id string, s *session) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp if crypto/rand fails (should never happen).
		id = fmt.Sprintf("%d", time.Now().UnixNano())
	} else {
		id = hex.EncodeToString(b)
	}
	s = &session{ch: make(chan string, 32), slug: slug}
	sessionsMu.Lock()
	sessions[id] = s
	sessionsMu.Unlock()
	return
}

func getSession(id string) (*session, bool) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	s, ok := sessions[id]
	return s, ok
}

func removeSession(id string) {
	sessionsMu.Lock()
	delete(sessions, id)
	sessionsMu.Unlock()
}

// sseConnect handles GET /mcp/{slug}/sse.
// It establishes the SSE stream and sends the `endpoint` event per the MCP spec.
func (h *Handler) sseConnect(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	// Verify the project exists before opening the stream.
	if _, err := h.projectBySlug(r.Context(), slug); err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	sessionID, sess := newSession(slug)
	defer removeSession(sessionID)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)

	// Send the endpoint event so the client knows where to POST messages.
	fmt.Fprintf(w, "event: endpoint\ndata: /mcp/%s/message?sessionId=%s\n\n", slug, sessionID)
	flusher.Flush()

	// Stream responses until client disconnects.
	for {
		select {
		case <-r.Context().Done():
			return
		case data, ok := <-sess.ch:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// sseMessage handles POST /mcp/{slug}/message.
// Receives JSON-RPC 2.0 requests and routes them to the appropriate handler,
// sending the response back via the client's SSE session channel.
func (h *Handler) sseMessage(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	sess, ok := getSession(sessionID)
	if !ok {
		writeError(w, http.StatusBadRequest, "unknown session")
		return
	}

	var req jsonRPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	go h.handleRPC(r.Context(), sess, req)
	w.WriteHeader(http.StatusAccepted)
}

// JSON-RPC 2.0 types ──────────────────────────────────────────────────────────

type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type jsonRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *rpcError   `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (h *Handler) sendRPC(sess *session, id interface{}, result interface{}, err *rpcError) {
	resp := jsonRPCResponse{JSONRPC: "2.0", ID: id, Result: result, Error: err}
	b, _ := json.Marshal(resp)
	select {
	case sess.ch <- string(b):
	default:
	}
}

func rpcErr(code int, msg string) *rpcError { return &rpcError{Code: code, Message: msg} }

// handleRPC dispatches a JSON-RPC method.
func (h *Handler) handleRPC(ctx context.Context, sess *session, req jsonRPCRequest) {
	switch req.Method {
	case "initialize":
		h.sendRPC(sess, req.ID, map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"serverInfo":      map[string]string{"name": "noodle", "version": "1.0"},
			"capabilities": map[string]interface{}{
				"tools":     map[string]bool{"listChanged": false},
				"resources": map[string]bool{"listChanged": false, "subscribe": false},
			},
		}, nil)

	case "notifications/initialized":
		// Acknowledgement from client — no response needed.

	case "tools/list":
		proj, err := h.projectBySlug(ctx, sess.slug)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "project not found"))
			return
		}
		flowRows, err := h.flowsForProject(ctx, proj.id)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "db error"))
			return
		}
		tools := make([]map[string]interface{}, 0)
		for _, f := range flowRows {
			if f.flowType != "tool" {
				continue
			}
			var def mcp.FlowDef
			if err := json.Unmarshal(f.flowJSON, &def); err != nil {
				continue
			}
			tools = append(tools, map[string]interface{}{
				"name":        f.name,
				"description": def.Description,
				"inputSchema": buildInputSchema(def.InputSchema),
			})
		}
		h.sendRPC(sess, req.ID, map[string]interface{}{"tools": tools}, nil)

	case "resources/list":
		proj, err := h.projectBySlug(ctx, sess.slug)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "project not found"))
			return
		}
		flowRows, err := h.flowsForProject(ctx, proj.id)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "db error"))
			return
		}
		resources := make([]map[string]interface{}, 0)
		for _, f := range flowRows {
			if f.flowType != "resource" || f.resourceURI == "" {
				continue
			}
			var def mcp.FlowDef
			if err := json.Unmarshal(f.flowJSON, &def); err != nil {
				continue
			}
			resources = append(resources, map[string]interface{}{
				"uri":         f.resourceURI,
				"name":        f.name,
				"description": def.Description,
				"mimeType":    "application/json",
			})
		}
		h.sendRPC(sess, req.ID, map[string]interface{}{"resources": resources}, nil)

	case "resources/read":
		var params struct {
			URI string `json:"uri"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil || params.URI == "" {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32602, "invalid params"))
			return
		}
		proj, err := h.projectBySlug(ctx, sess.slug)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "project not found"))
			return
		}
		flowRows, err := h.flowsForProject(ctx, proj.id)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "db error"))
			return
		}
		var matched *flowRow
		for i, f := range flowRows {
			if f.flowType == "resource" && f.resourceURI == params.URI {
				matched = &flowRows[i]
				break
			}
		}
		if matched == nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32602, "resource not found: "+params.URI))
			return
		}
		var def mcp.FlowDef
		if err := json.Unmarshal(matched.flowJSON, &def); err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "invalid flow definition"))
			return
		}
		creds, _ := credentials.LoadDecrypted(ctx, h.db, proj.id)
		envVars, _ := credentials.LoadEnvVars(ctx, h.db, proj.id)
		result, execErr := runtime.Run(ctx, &def, map[string]interface{}{}, creds, envVars)
		if execErr != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, execErr.Error()))
			return
		}
		h.sendRPC(sess, req.ID, map[string]interface{}{
			"contents": []map[string]interface{}{
				{"uri": params.URI, "mimeType": "application/json", "text": toText(result)},
			},
		}, nil)

	case "tools/call":
		var params struct {
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil || params.Name == "" {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32602, "invalid params"))
			return
		}

		proj, err := h.projectBySlug(ctx, sess.slug)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "project not found"))
			return
		}
		flowRows, err := h.flowsForProject(ctx, proj.id)
		if err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "db error"))
			return
		}

		var matched *flowRow
		for i, f := range flowRows {
			if f.name == params.Name {
				matched = &flowRows[i]
				break
			}
		}
		if matched == nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32602, "tool not found: "+params.Name))
			return
		}

		var def mcp.FlowDef
		if err := json.Unmarshal(matched.flowJSON, &def); err != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, "invalid flow definition"))
			return
		}

		input := params.Arguments
		if input == nil {
			input = map[string]interface{}{}
		}

		creds, _ := credentials.LoadDecrypted(ctx, h.db, proj.id)
		envVars, _ := credentials.LoadEnvVars(ctx, h.db, proj.id)

		start := time.Now()
		result, execErr := runtime.Run(ctx, &def, input, creds, envVars)
		durationMS := int(time.Since(start).Milliseconds())
		go h.logExecution(matched.id, input, result, execErr, durationMS)

		if execErr != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32603, execErr.Error()))
			return
		}

		// MCP tools/call result format.
		h.sendRPC(sess, req.ID, map[string]interface{}{
			"content": []map[string]interface{}{
				{"type": "text", "text": toText(result)},
			},
		}, nil)

	default:
		if req.ID != nil {
			h.sendRPC(sess, req.ID, nil, rpcErr(-32601, "method not found: "+req.Method))
		}
	}
}

func toText(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(b)
}

