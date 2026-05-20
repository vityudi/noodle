package nodes

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// PostgreSQLNode executes a SQL query against a PostgreSQL database.
//
// Config keys:
//
//	connection_string  string   — PostgreSQL DSN (e.g. postgres://user:pass@host/db)
//	query              string   — SQL query to execute
//	params             []any    — ordered query parameters ($1, $2, …)
//
// Outputs (SELECT/WITH):
//
//	rows       []object  — result rows as objects
//	row_count  number    — number of rows returned
//
// Outputs (INSERT/UPDATE/DELETE):
//
//	rows_affected  number  — number of rows affected
type PostgreSQLNode struct{}

// normalizeConnStr converts JDBC-style URLs (jdbc:postgresql://...) to the
// pgx-native format (postgres://...) so users can paste either form.
func normalizeConnStr(s string) string {
	s = strings.TrimPrefix(s, "jdbc:")
	s = strings.Replace(s, "postgresql://", "postgres://", 1)
	return s
}

func (n *PostgreSQLNode) Execute(ctx context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	connStr, _ := config["connection_string"].(string)
	if connStr == "" {
		return nil, fmt.Errorf("postgres: connection_string is required")
	}
	connStr = normalizeConnStr(connStr)
	query, _ := config["query"].(string)
	if query == "" {
		return nil, fmt.Errorf("postgres: query is required")
	}

	params := extractParams(config)

	conn, err := pgx.Connect(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("postgres: connect: %w", err)
	}
	defer conn.Close(ctx)

	if !isReadQuery(query) {
		tag, err := conn.Exec(ctx, query, params...)
		if err != nil {
			return nil, fmt.Errorf("postgres: exec: %w", err)
		}
		return map[string]interface{}{
			"rows":          []map[string]interface{}{},
			"row_count":     int64(0),
			"rows_affected": tag.RowsAffected(),
		}, nil
	}

	rows, err := conn.Query(ctx, query, params...)
	if err != nil {
		return nil, fmt.Errorf("postgres: query: %w", err)
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	var result []map[string]interface{}

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("postgres: read row: %w", err)
		}
		row := make(map[string]interface{}, len(fields))
		for i, fd := range fields {
			row[string(fd.Name)] = values[i]
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres: rows: %w", err)
	}

	if result == nil {
		result = []map[string]interface{}{}
	}

	return map[string]interface{}{
		"rows":          result,
		"row_count":     len(result),
		"rows_affected": int64(0),
	}, nil
}

// isReadQuery returns true for queries that return rows (SELECT, WITH, SHOW, EXPLAIN).
func isReadQuery(query string) bool {
	upper := strings.TrimSpace(strings.ToUpper(query))
	for _, prefix := range []string{"SELECT", "WITH", "SHOW", "EXPLAIN", "TABLE"} {
		if strings.HasPrefix(upper, prefix) {
			return true
		}
	}
	return false
}

// extractParams reads the "params" key from config and returns it as []interface{}.
func extractParams(config map[string]interface{}) []interface{} {
	if raw, ok := config["params"]; ok {
		if arr, ok := raw.([]interface{}); ok {
			return arr
		}
	}
	return nil
}
