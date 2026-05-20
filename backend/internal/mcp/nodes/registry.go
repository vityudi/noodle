package nodes

import "context"

// Node executes a single flow node given its resolved config.
type Node interface {
	Execute(ctx context.Context, config map[string]interface{}) (map[string]interface{}, error)
}

// Registry maps node type strings to their implementations.
var Registry = map[string]Node{
	"http_request":   &HTTPRequestNode{},
	"json_transform": &JSONTransformNode{},
	"condition":      &ConditionNode{},
	"variable":       &VariableNode{},
	"loop":           &LoopNode{},
	"merge":          &MergeNode{},
}
