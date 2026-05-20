package credentials

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)


// LoadDecrypted loads all credentials for a project and returns a map of
// credential name → decrypted data fields, ready for template resolution.
//
// The returned map is keyed by credential name so {{credentials.my_api.token}}
// resolves to the "token" field of the credential named "my_api".
func LoadDecrypted(ctx context.Context, db *pgxpool.Pool, projectID string) (map[string]map[string]interface{}, error) {
	secretKey, err := loadSecretKey(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("credentials: load secret key: %w", err)
	}

	rows, err := db.Query(ctx,
		`SELECT name, data_enc FROM credentials WHERE project_id = $1`, projectID)
	if err != nil {
		return nil, fmt.Errorf("credentials: query: %w", err)
	}
	defer rows.Close()

	out := make(map[string]map[string]interface{})
	for rows.Next() {
		var name string
		var encData []byte
		if err := rows.Scan(&name, &encData); err != nil {
			continue
		}
		plaintext, err := Decrypt(encData, secretKey)
		if err != nil {
			continue
		}
		var data map[string]interface{}
		if err := json.Unmarshal(plaintext, &data); err != nil {
			continue
		}
		out[name] = data
	}
	return out, rows.Err()
}

// LoadEnvVars loads all env_variables for a project and returns a map of
// key → plaintext value, ready for {{env.KEY}} template resolution.
func LoadEnvVars(ctx context.Context, db *pgxpool.Pool, projectID string) (map[string]string, error) {
	secretKey, err := loadSecretKey(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("env: load secret key: %w", err)
	}

	rows, err := db.Query(ctx,
		`SELECT key, value_enc FROM env_variables WHERE project_id = $1`, projectID)
	if err != nil {
		return nil, fmt.Errorf("env: query: %w", err)
	}
	defer rows.Close()

	out := make(map[string]string)
	for rows.Next() {
		var key string
		var encValue []byte
		if err := rows.Scan(&key, &encValue); err != nil {
			continue
		}
		plaintext, err := Decrypt(encValue, secretKey)
		if err != nil {
			continue
		}
		out[key] = string(plaintext)
	}
	return out, rows.Err()
}

// loadSecretKey reads the secret key from the settings table and returns the raw bytes.
func loadSecretKey(ctx context.Context, db *pgxpool.Pool) ([]byte, error) {
	var hexVal string
	err := db.QueryRow(ctx,
		`SELECT value FROM settings WHERE key = 'secret_key'`).Scan(&hexVal)
	if err != nil {
		return nil, err
	}
	return hex.DecodeString(hexVal)
}
