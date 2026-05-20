package nodes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/vityudi/noodle/backend/internal/mcp/runtime"
)

// HTTPRequestNode performs an HTTP request.
//
// Config keys:
//   url     string   — target URL (required)
//   method  string   — GET | POST | PUT | DELETE | PATCH (default: GET)
//   headers map      — request headers
//   params  map      — query string parameters
//   body    any      — request body (JSON-encoded)
//
// Outputs:
//   status  float64  — HTTP status code
//   body    any      — parsed JSON body, or raw string
//   headers map      — response headers
type HTTPRequestNode struct{}

func (n *HTTPRequestNode) Execute(ctx context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	rawURL, _ := config["url"].(string)
	if rawURL == "" {
		return nil, fmt.Errorf("http_request: url is required")
	}

	method := strings.ToUpper(stringOr(config["method"], "GET"))
	if method != "GET" && runtime.IsReadOnly(ctx) {
		return nil, fmt.Errorf("project is read-only: only GET requests are allowed (got %s)", method)
	}

	// Query params.
	if params, ok := config["params"].(map[string]interface{}); ok && len(params) > 0 {
		u, err := url.Parse(rawURL)
		if err != nil {
			return nil, fmt.Errorf("http_request: invalid url: %w", err)
		}
		q := u.Query()
		for k, v := range params {
			q.Set(k, fmt.Sprintf("%v", v))
		}
		u.RawQuery = q.Encode()
		rawURL = u.String()
	}

	// Request body.
	var bodyReader io.Reader
	if bodyVal, ok := config["body"]; ok && bodyVal != nil {
		b, err := json.Marshal(bodyVal)
		if err != nil {
			return nil, fmt.Errorf("http_request: cannot encode body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, rawURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("http_request: build request: %w", err)
	}

	if bodyReader != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	// Request headers.
	if headers, ok := config["headers"].(map[string]interface{}); ok {
		for k, v := range headers {
			req.Header.Set(k, fmt.Sprintf("%v", v))
		}
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http_request: do request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("http_request: read body: %w", err)
	}

	respHeaders := make(map[string]interface{}, len(resp.Header))
	for k, vs := range resp.Header {
		if len(vs) == 1 {
			respHeaders[k] = vs[0]
		} else {
			iface := make([]interface{}, len(vs))
			for i, v := range vs {
				iface[i] = v
			}
			respHeaders[k] = iface
		}
	}

	var parsed interface{}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		parsed = string(raw)
	}

	return map[string]interface{}{
		"status":  float64(resp.StatusCode),
		"body":    parsed,
		"headers": respHeaders,
	}, nil
}

func stringOr(v interface{}, def string) string {
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return def
}
