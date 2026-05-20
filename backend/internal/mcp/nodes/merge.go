package nodes

import "context"

// MergeNode joins multiple resolved values into a single object.
//
// Config keys:
//
//	Any key/value pairs to merge — all config entries are returned as outputs.
//
// Outputs:
//
//	All config keys and their resolved values.
type MergeNode struct{}

func (n *MergeNode) Execute(_ context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	out := make(map[string]interface{}, len(config))
	for k, v := range config {
		out[k] = v
	}
	return out, nil
}
