package nodes

import (
	"context"
	"fmt"
	"strings"
)

// ConditionNode evaluates a binary comparison and outputs a boolean result.
//
// Config keys:
//   left      any     — left operand (already resolved)
//   operator  string  — eq | ne | gt | lt | gte | lte | contains
//   right     any     — right operand (already resolved)
//
// Outputs:
//   result  bool  — true if condition is satisfied
type ConditionNode struct{}

func (n *ConditionNode) Execute(_ context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	left := config["left"]
	right := config["right"]
	op, _ := config["operator"].(string)
	if op == "" {
		return nil, fmt.Errorf("condition: operator is required")
	}

	result, err := compare(left, op, right)
	if err != nil {
		return nil, fmt.Errorf("condition: %w", err)
	}
	return map[string]interface{}{"result": result}, nil
}

func compare(left interface{}, op string, right interface{}) (bool, error) {
	ls := fmt.Sprintf("%v", left)
	rs := fmt.Sprintf("%v", right)

	switch strings.ToLower(op) {
	case "eq":
		return ls == rs, nil
	case "ne":
		return ls != rs, nil
	case "contains":
		return strings.Contains(ls, rs), nil
	case "gt", "lt", "gte", "lte":
		lf, lok := toFloat(left)
		rf, rok := toFloat(right)
		if !lok || !rok {
			return false, fmt.Errorf("operator %q requires numeric operands", op)
		}
		switch op {
		case "gt":
			return lf > rf, nil
		case "lt":
			return lf < rf, nil
		case "gte":
			return lf >= rf, nil
		case "lte":
			return lf <= rf, nil
		}
	}
	return false, fmt.Errorf("unknown operator: %q", op)
}

func toFloat(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		var f float64
		_, err := fmt.Sscanf(fmt.Sprintf("%v", v), "%f", &f)
		return f, err == nil
	}
}
