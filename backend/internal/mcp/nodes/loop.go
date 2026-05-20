package nodes

import (
	"context"
	"fmt"
)

// LoopNode iterates over an array and collects each element as output.
// For more complex per-item processing, use the Script node.
//
// Config keys:
//
//	items  []any  — array to iterate (already resolved)
//	field  string — optional dot-path within each item to extract (e.g. "name")
//
// Outputs:
//
//	items   []any  — all items (or extracted fields)
//	count   float64 — length of the input array
type LoopNode struct{}

func (n *LoopNode) Execute(_ context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	raw, ok := config["items"]
	if !ok {
		return map[string]interface{}{"items": []interface{}{}, "count": float64(0)}, nil
	}

	items, ok := raw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("loop: items must be an array, got %T", raw)
	}

	field, _ := config["field"].(string)

	out := make([]interface{}, 0, len(items))
	for _, item := range items {
		if field == "" {
			out = append(out, item)
			continue
		}
		// Extract a field from each map item.
		if m, ok := item.(map[string]interface{}); ok {
			if v, exists := m[field]; exists {
				out = append(out, v)
				continue
			}
		}
		out = append(out, nil)
	}

	return map[string]interface{}{
		"items": out,
		"count": float64(len(items)),
	}, nil
}
