package runtime

import (
	"context"
	"fmt"

	"github.com/vityudi/noodle/backend/internal/mcp"
	"github.com/vityudi/noodle/backend/internal/mcp/nodes"
)

// Run executes a FlowDef with the given input and returns the resolved output.
// credentials is an optional map of credential name → decrypted data fields
// (used to resolve {{credentials.name.field}} template expressions).
func Run(ctx context.Context, flow *mcp.FlowDef, input map[string]interface{}, credentials map[string]map[string]interface{}) (interface{}, error) {
	order, err := topoSort(flow)
	if err != nil {
		return nil, err
	}

	nodeOutputs := make(map[string]map[string]interface{})

	nodeMap := make(map[string]mcp.NodeDef, len(flow.Nodes))
	for _, n := range flow.Nodes {
		nodeMap[n.ID] = n
	}

	for _, nodeID := range order {
		nodeDef := nodeMap[nodeID]

		// Resolve all config values before passing to the node executor.
		resolvedConfig := make(map[string]interface{}, len(nodeDef.Config))
		for k, v := range nodeDef.Config {
			resolvedConfig[k] = resolve(v, input, nodeOutputs, credentials)
		}

		handler, ok := nodes.Registry[nodeDef.Type]
		if !ok {
			return nil, fmt.Errorf("unknown node type: %s", nodeDef.Type)
		}

		outputs, err := handler.Execute(ctx, resolvedConfig)
		if err != nil {
			return nil, fmt.Errorf("node %q (%s) failed: %w", nodeID, nodeDef.Type, err)
		}
		nodeOutputs[nodeID] = outputs
	}

	// Resolve the flow's output expression.
	if flow.Output == "" {
		return nodeOutputs, nil
	}
	return resolve(flow.Output, input, nodeOutputs, credentials), nil
}

// topoSort returns node IDs in topological (execution) order via Kahn's algorithm.
func topoSort(flow *mcp.FlowDef) ([]string, error) {
	inDegree := make(map[string]int)
	adj := make(map[string][]string)

	for _, n := range flow.Nodes {
		if _, ok := inDegree[n.ID]; !ok {
			inDegree[n.ID] = 0
		}
	}
	for _, e := range flow.Edges {
		adj[e.From] = append(adj[e.From], e.To)
		inDegree[e.To]++
	}

	queue := []string{}
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	order := make([]string, 0, len(flow.Nodes))
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		order = append(order, cur)
		for _, next := range adj[cur] {
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}

	if len(order) != len(flow.Nodes) {
		return nil, fmt.Errorf("flow contains a cycle")
	}
	return order, nil
}
