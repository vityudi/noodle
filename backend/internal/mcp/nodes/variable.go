package nodes

import "context"

// VariableNode stores and returns a value, optionally merging multiple inputs.
//
// Config keys:
//
//	value  any  — the value to store (already resolved by the template engine)
//
// Outputs:
//
//	value  any  — the resolved value
type VariableNode struct{}

func (n *VariableNode) Execute(_ context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	return map[string]interface{}{"value": config["value"]}, nil
}
