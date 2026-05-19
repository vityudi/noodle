package mcp

// FlowDef is the root schema for a Noodle flow (schema_version 1.0).
type FlowDef struct {
	SchemaVersion string                     `json:"schema_version"`
	Name          string                     `json:"name"`
	Description   string                     `json:"description"`
	InputSchema   map[string]InputFieldDef   `json:"input_schema"`
	Nodes         []NodeDef                  `json:"nodes"`
	Edges         []Edge                     `json:"edges"`
	Output        string                     `json:"output"`
}

type InputFieldDef struct {
	Type        string `json:"type"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

type NodeDef struct {
	ID      string                 `json:"id"`
	Type    string                 `json:"type"`
	Config  map[string]interface{} `json:"config"`
	Outputs map[string]OutputDef   `json:"outputs"`
}

type OutputDef struct {
	Type string `json:"type"`
}

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
}
