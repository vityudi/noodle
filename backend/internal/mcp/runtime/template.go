package runtime

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

var templateRe = regexp.MustCompile(`\{\{([^}]+)\}\}`)

// resolve resolves all {{expr}} references in val.
//
// If val is a string that is exactly one {{expr}}, the typed value is returned.
// If val is a string with embedded {{expr}}, all references are string-interpolated.
// If val is a map or slice, it is walked recursively.
func resolve(val interface{}, input map[string]interface{}, nodeOutputs map[string]map[string]interface{}) interface{} {
	switch v := val.(type) {
	case string:
		return resolveString(v, input, nodeOutputs)
	case map[string]interface{}:
		out := make(map[string]interface{}, len(v))
		for k, vv := range v {
			out[k] = resolve(vv, input, nodeOutputs)
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(v))
		for i, vv := range v {
			out[i] = resolve(vv, input, nodeOutputs)
		}
		return out
	default:
		return v
	}
}

func resolveString(s string, input map[string]interface{}, nodeOutputs map[string]map[string]interface{}) interface{} {
	trimmed := strings.TrimSpace(s)
	// Whole value is a single expression — return typed value.
	if strings.HasPrefix(trimmed, "{{") && strings.HasSuffix(trimmed, "}}") && strings.Count(trimmed, "{{") == 1 {
		expr := trimmed[2 : len(trimmed)-2]
		if v, ok := evalExpr(expr, input, nodeOutputs); ok {
			return v
		}
	}
	// String interpolation — replace each {{expr}} with its string form.
	return templateRe.ReplaceAllStringFunc(s, func(match string) string {
		expr := match[2 : len(match)-2]
		if v, ok := evalExpr(expr, input, nodeOutputs); ok {
			return fmt.Sprintf("%v", v)
		}
		return match
	})
}

// evalExpr evaluates a dot-path expression like:
//   input.email
//   nodes.fetch.outputs.body.data.name
//   env.API_URL
func evalExpr(expr string, input map[string]interface{}, nodeOutputs map[string]map[string]interface{}) (interface{}, bool) {
	parts := strings.Split(strings.TrimSpace(expr), ".")
	if len(parts) == 0 {
		return nil, false
	}
	switch parts[0] {
	case "input":
		return dotGet(input, parts[1:])
	case "env":
		if len(parts) < 2 {
			return nil, false
		}
		v := os.Getenv(parts[1])
		return v, true
	case "nodes":
		// nodes.<id>.outputs.<field>...
		if len(parts) < 4 || parts[2] != "outputs" {
			return nil, false
		}
		nodeID := parts[1]
		outputs, ok := nodeOutputs[nodeID]
		if !ok {
			return nil, false
		}
		return dotGet(outputs, parts[3:])
	}
	return nil, false
}

func dotGet(obj map[string]interface{}, path []string) (interface{}, bool) {
	if len(path) == 0 {
		return obj, true
	}
	v, ok := obj[path[0]]
	if !ok {
		return nil, false
	}
	if len(path) == 1 {
		return v, true
	}
	switch next := v.(type) {
	case map[string]interface{}:
		return dotGet(next, path[1:])
	default:
		return nil, false
	}
}
