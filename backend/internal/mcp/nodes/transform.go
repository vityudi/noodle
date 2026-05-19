package nodes

import (
	"context"
	"fmt"
)

// JSONTransformNode remaps fields from resolved config into a new object.
//
// Config keys:
//   mapping  map[string]any  — output field → value (already template-resolved by runner)
//
// Outputs:
//   result  map  — the remapped object
type JSONTransformNode struct{}

func (n *JSONTransformNode) Execute(_ context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	raw, ok := config["mapping"]
	if !ok {
		return nil, fmt.Errorf("json_transform: mapping is required")
	}
	mapping, ok := raw.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("json_transform: mapping must be an object")
	}
	// Config values are already resolved by the runner — return them directly.
	result := make(map[string]interface{}, len(mapping))
	for k, v := range mapping {
		result[k] = v
	}
	return map[string]interface{}{"result": result}, nil
}
