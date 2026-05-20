package credentials

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"sort"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Introspect connects to a database and returns a compact schema string.
// connType must be "postgres", "mysql", or "mongodb".
func Introspect(ctx context.Context, connType, connStr string) (string, error) {
	switch connType {
	case "postgres":
		return introspectPostgres(ctx, connStr)
	case "mysql":
		return introspectMySQL(ctx, connStr)
	case "mongodb":
		return introspectMongoDB(ctx, connStr)
	default:
		return "", fmt.Errorf("unsupported connection type: %s", connType)
	}
}

// DetectConnType guesses the DB type from the connection string format.
func DetectConnType(connStr string) string {
	s := strings.ToLower(strings.TrimPrefix(connStr, "jdbc:"))
	switch {
	case strings.HasPrefix(s, "postgres://"), strings.HasPrefix(s, "postgresql://"):
		return "postgres"
	case strings.HasPrefix(s, "mongodb://"), strings.HasPrefix(s, "mongodb+srv://"):
		return "mongodb"
	default:
		return "mysql"
	}
}

// ExtractConnStr finds the connection string value from a credential data map.
// Tries common field names: connection_string, url, uri.
func ExtractConnStr(data map[string]interface{}) string {
	for _, key := range []string{"connection_string", "url", "uri"} {
		if v, ok := data[key]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}

func introspectPostgres(ctx context.Context, connStr string) (string, error) {
	connStr = strings.TrimPrefix(connStr, "jdbc:")
	connStr = strings.Replace(connStr, "postgresql://", "postgres://", 1)

	conn, err := pgx.Connect(ctx, connStr)
	if err != nil {
		return "", fmt.Errorf("postgres: connect: %w", err)
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, `
		SELECT table_name, column_name, data_type
		FROM information_schema.columns
		WHERE table_schema = 'public'
		ORDER BY table_name, ordinal_position
	`)
	if err != nil {
		return "", fmt.Errorf("postgres: query schema: %w", err)
	}
	defer rows.Close()

	tableMap := make(map[string][]colEntry)
	var order []string

	for rows.Next() {
		var table, column, dataType string
		if err := rows.Scan(&table, &column, &dataType); err != nil {
			continue
		}
		if _, seen := tableMap[table]; !seen {
			order = append(order, table)
		}
		tableMap[table] = append(tableMap[table], colEntry{column, abbreviateType(dataType)})
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("postgres: rows: %w", err)
	}

	return formatTables(order, func(t string) []colEntry { return tableMap[t] }), nil
}

func introspectMySQL(ctx context.Context, connStr string) (string, error) {
	db, err := sql.Open("mysql", connStr)
	if err != nil {
		return "", fmt.Errorf("mysql: open: %w", err)
	}
	defer db.Close()

	rows, err := db.QueryContext(ctx, `
		SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		ORDER BY TABLE_NAME, ORDINAL_POSITION
	`)
	if err != nil {
		return "", fmt.Errorf("mysql: query schema: %w", err)
	}
	defer rows.Close()

	tableMap := make(map[string][]colEntry)
	var order []string

	for rows.Next() {
		var table, column, dataType string
		if err := rows.Scan(&table, &column, &dataType); err != nil {
			continue
		}
		if _, seen := tableMap[table]; !seen {
			order = append(order, table)
		}
		tableMap[table] = append(tableMap[table], colEntry{column, dataType})
	}
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("mysql: rows: %w", err)
	}

	return formatTables(order, func(t string) []colEntry { return tableMap[t] }), nil
}

func introspectMongoDB(ctx context.Context, connStr string) (string, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(connStr))
	if err != nil {
		return "", fmt.Errorf("mongodb: connect: %w", err)
	}
	defer client.Disconnect(ctx) //nolint:errcheck

	dbName := extractMongoDatabase(connStr)
	if dbName == "" {
		return "", nil
	}

	mdb := client.Database(dbName)
	collNames, err := mdb.ListCollectionNames(ctx, bson.D{})
	if err != nil {
		return "", fmt.Errorf("mongodb: list collections: %w", err)
	}
	if len(collNames) == 0 {
		return "", nil
	}
	sort.Strings(collNames)

	var lines []string
	for _, name := range collNames {
		var doc bson.M
		err := mdb.Collection(name).FindOne(ctx, bson.D{}, options.FindOne()).Decode(&doc)
		if err != nil {
			lines = append(lines, name+"()")
			continue
		}
		fields := make([]string, 0, len(doc))
		for k := range doc {
			fields = append(fields, k)
		}
		sort.Strings(fields)
		lines = append(lines, fmt.Sprintf("%s(%s)", name, strings.Join(fields, ", ")))
	}
	return strings.Join(lines, "\n"), nil
}

func extractMongoDatabase(connStr string) string {
	u, err := url.Parse(connStr)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(strings.SplitN(u.Path, "?", 2)[0], "/")
}

func abbreviateType(t string) string {
	switch t {
	case "character varying":
		return "varchar"
	case "timestamp with time zone":
		return "timestamptz"
	case "timestamp without time zone":
		return "timestamp"
	case "double precision":
		return "float8"
	case "integer":
		return "int"
	default:
		return t
	}
}

type colEntry struct{ name, typ string }

func formatTables(order []string, cols func(string) []colEntry) string {
	if len(order) == 0 {
		return ""
	}
	lines := make([]string, 0, len(order))
	for _, table := range order {
		entries := cols(table)
		parts := make([]string, len(entries))
		for i, c := range entries {
			parts[i] = c.name + ":" + c.typ
		}
		lines = append(lines, fmt.Sprintf("%s(%s)", table, strings.Join(parts, ", ")))
	}
	return strings.Join(lines, "\n")
}
