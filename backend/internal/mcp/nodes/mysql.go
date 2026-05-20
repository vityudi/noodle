package nodes

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"
)

// MySQLNode executes a SQL query against a MySQL / MariaDB database.
//
// Config keys:
//
//	connection_string  string   — MySQL DSN (user:pass@tcp(host:3306)/dbname)
//	query              string   — SQL query to execute
//	params             []any    — ordered query parameters (?, ?, …)
//
// Outputs (SELECT):
//
//	rows       []object  — result rows as objects
//	row_count  number    — number of rows returned
//
// Outputs (INSERT/UPDATE/DELETE):
//
//	rows_affected   number  — number of rows affected
//	last_insert_id  number  — auto-increment ID of last insert (0 if N/A)
type MySQLNode struct{}

func (n *MySQLNode) Execute(ctx context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	connStr, _ := config["connection_string"].(string)
	if connStr == "" {
		return nil, fmt.Errorf("mysql: connection_string is required")
	}
	query, _ := config["query"].(string)
	if query == "" {
		return nil, fmt.Errorf("mysql: query is required")
	}

	params := extractParams(config)

	db, err := sql.Open("mysql", connStr)
	if err != nil {
		return nil, fmt.Errorf("mysql: open: %w", err)
	}
	defer db.Close()

	if !isReadQuery(query) {
		result, err := db.ExecContext(ctx, query, params...)
		if err != nil {
			return nil, fmt.Errorf("mysql: exec: %w", err)
		}
		affected, _ := result.RowsAffected()
		lastID, _ := result.LastInsertId()
		return map[string]interface{}{
			"rows_affected":  affected,
			"last_insert_id": lastID,
		}, nil
	}

	rows, err := db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, fmt.Errorf("mysql: query: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("mysql: columns: %w", err)
	}

	var result []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, fmt.Errorf("mysql: scan: %w", err)
		}
		row := make(map[string]interface{}, len(columns))
		for i, col := range columns {
			// MySQL returns []byte for string columns — convert to string.
			if b, ok := values[i].([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = values[i]
			}
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("mysql: rows: %w", err)
	}

	if result == nil {
		result = []map[string]interface{}{}
	}

	return map[string]interface{}{
		"rows":      result,
		"row_count": len(result),
	}, nil
}
