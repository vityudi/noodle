package api

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type settingsHandler struct{ db *pgxpool.Pool }

func (h *settingsHandler) getSetting(r *http.Request, key string) string {
	var val string
	_ = h.db.QueryRow(r.Context(), `SELECT value FROM settings WHERE key = $1`, key).Scan(&val)
	return val
}

func (h *settingsHandler) getAI(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"provider": h.getSetting(r, "ai_provider"),
		"model":    h.getSetting(r, "ai_model"),
	})
}

type updateAIRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key"`
	Model    string `json:"model"`
}

func (h *settingsHandler) updateAI(w http.ResponseWriter, r *http.Request) {
	var req updateAIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	setup := &setupHandler{db: h.db}

	upsert := `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`

	if req.Provider != "" {
		h.db.Exec(r.Context(), upsert, "ai_provider", req.Provider)
	}
	if req.Model != "" {
		h.db.Exec(r.Context(), upsert, "ai_model", req.Model)
	}
	if req.APIKey != "" {
		secretKey, err := setup.getOrCreateSecretKey(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "secret key unavailable")
			return
		}
		enc, err := encrypt([]byte(req.APIKey), secretKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "encryption failed")
			return
		}
		h.db.Exec(r.Context(), upsert, "ai_api_key_enc", enc)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func settingsHandlerFor(db *pgxpool.Pool) *settingsHandler {
	return &settingsHandler{db: db}
}
