package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type testConnHandler struct{ db *pgxpool.Pool }

type testConnRequest struct {
	Type             string `json:"type"`
	ConnectionString string `json:"connection_string"`
}

func (h *testConnHandler) ownsProject(r *http.Request, projectID string) bool {
	ch := &credentialsHandler{db: h.db}
	return ch.ownsProject(r, projectID)
}

func (h *testConnHandler) test(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectID")
	if !h.ownsProject(r, projectID) {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req testConnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Type == "" || req.ConnectionString == "" {
		writeError(w, http.StatusBadRequest, "type and connection_string are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	start := time.Now()
	var connErr error

	switch req.Type {
	case "postgres":
		connStr := normalizePgConnStr(req.ConnectionString)
		var conn *pgx.Conn
		conn, connErr = pgx.Connect(ctx, connStr)
		if connErr == nil {
			connErr = conn.Ping(ctx)
			conn.Close(ctx) //nolint:errcheck
		}

	case "mysql":
		var db *sql.DB
		db, connErr = sql.Open("mysql", req.ConnectionString)
		if connErr == nil {
			connErr = db.PingContext(ctx)
			db.Close() //nolint:errcheck
		}

	case "mongodb":
		var client *mongo.Client
		client, connErr = mongo.Connect(ctx, options.Client().ApplyURI(req.ConnectionString))
		if connErr == nil {
			connErr = client.Ping(ctx, nil)
			client.Disconnect(ctx) //nolint:errcheck
		}

	default:
		writeError(w, http.StatusBadRequest, "unsupported type: "+req.Type)
		return
	}

	if connErr != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok":    false,
			"error": connErr.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":         true,
		"latency_ms": int(time.Since(start).Milliseconds()),
	})
}

func normalizePgConnStr(s string) string {
	s = strings.TrimPrefix(s, "jdbc:")
	s = strings.Replace(s, "postgresql://", "postgres://", 1)
	return s
}
