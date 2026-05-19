package api

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type setupHandler struct {
	db *pgxpool.Pool
}

// SetupStatus reports whether the first-run wizard has been completed.
type SetupStatus struct {
	Complete bool `json:"complete"`
	HasAI    bool `json:"has_ai"`
}

func (h *setupHandler) status(w http.ResponseWriter, r *http.Request) {
	var userCount int
	_ = h.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&userCount)

	var aiProvider string
	_ = h.db.QueryRow(r.Context(), `SELECT value FROM settings WHERE key = 'ai_provider'`).Scan(&aiProvider)

	writeJSON(w, http.StatusOK, SetupStatus{
		Complete: userCount > 0,
		HasAI:    aiProvider != "",
	})
}

type adminRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *setupHandler) createAdmin(w http.ResponseWriter, r *http.Request) {
	var req adminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	// Only allow during first-run (no users yet).
	var count int
	_ = h.db.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&count)
	if count > 0 {
		writeError(w, http.StatusConflict, "setup already complete")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}

	var userID string
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id`,
		req.Email, string(hash),
	).Scan(&userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	// Create a default workspace for the admin.
	_, _ = h.db.Exec(r.Context(),
		`INSERT INTO workspaces (name, owner_id) VALUES ($1, $2)`,
		"My Workspace", userID,
	)

	token, err := h.issueToken(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue token")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"token": token})
}

type aiRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key"`
	Model    string `json:"model"`
}

func (h *setupHandler) configureAI(w http.ResponseWriter, r *http.Request) {
	var req aiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Provider == "" || req.APIKey == "" {
		writeError(w, http.StatusBadRequest, "provider and api_key are required")
		return
	}

	secretKey, err := h.getOrCreateSecretKey(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "secret key unavailable")
		return
	}

	encKey, err := encrypt([]byte(req.APIKey), secretKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "encryption failed")
		return
	}

	model := req.Model
	if model == "" {
		model = defaultModel(req.Provider)
	}

	upsert := `
		INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
	h.db.Exec(r.Context(), upsert, "ai_provider", req.Provider)
	h.db.Exec(r.Context(), upsert, "ai_model", model)
	h.db.Exec(r.Context(), upsert, "ai_api_key_enc", encKey)

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *setupHandler) skipAI(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// issueToken signs a JWT with the instance secret key.
func (h *setupHandler) issueToken(ctx context.Context, userID string) (string, error) {
	secretKey, err := h.getOrCreateSecretKey(ctx)
	if err != nil {
		return "", err
	}
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secretKey)
}

func (h *setupHandler) getOrCreateSecretKey(ctx context.Context) ([]byte, error) {
	var stored string
	err := h.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'secret_key'`).Scan(&stored)
	if err == nil {
		return hex.DecodeString(stored)
	}

	// First boot: generate and persist.
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, err
	}
	encoded := hex.EncodeToString(raw)
	_, err = h.db.Exec(ctx,
		`INSERT INTO settings (key, value) VALUES ('secret_key', $1) ON CONFLICT DO NOTHING`,
		encoded,
	)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

// encrypt encrypts plaintext with AES-GCM using key.
func encrypt(plaintext, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return hex.EncodeToString(ciphertext), nil
}

func defaultModel(provider string) string {
	switch provider {
	case "anthropic":
		return "claude-sonnet-4-6"
	case "openai":
		return "gpt-4o"
	case "ollama":
		return "llama3"
	default:
		return ""
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
