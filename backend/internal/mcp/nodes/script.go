package nodes

import (
	"context"
	"fmt"

	"github.com/dop251/goja"
)

// ScriptNode executes arbitrary JavaScript code inside an isolated Goja VM.
//
// Config keys:
//
//	code   string  — JavaScript source (can use `return` at top-level)
//	input  any     — exposed as `input` variable inside the script
//
// Any additional config key is also exposed as a top-level variable.
//
// Outputs:
//
//	result  any  — the value returned by the script, or the last evaluated expression
//
// Example config:
//
//	{
//	  "code":  "return input.price * 1.1",
//	  "input": "{{nodes.fetch.outputs.body}}"
//	}
type ScriptNode struct{}

func (n *ScriptNode) Execute(_ context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	code, _ := config["code"].(string)
	if code == "" {
		return map[string]interface{}{"result": nil}, nil
	}

	vm := goja.New()

	// Expose every config field (except "code") as a top-level variable.
	for k, v := range config {
		if k == "code" {
			continue
		}
		if err := vm.Set(k, v); err != nil {
			return nil, fmt.Errorf("script: set %q: %w", k, err)
		}
	}

	// Wrap in an IIFE so bare `return` statements work at the top level.
	wrapped := fmt.Sprintf("(function(){\n%s\n})()", code)
	val, err := vm.RunString(wrapped)
	if err != nil {
		return nil, fmt.Errorf("script: %w", err)
	}

	return map[string]interface{}{"result": val.Export()}, nil
}
