package api

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type credentialsHandler struct{ db *pgxpool.Pool }

type Credential struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h *credentialsHandler) workspaceID(r *http.Request) (string, error) {
	userID := userIDFromCtx(r.Context())
	var wsID string
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1`, userID,
	).Scan(&wsID)
	return wsID, err
}

func (h *credentialsHandler) list(w http.ResponseWriter, r *http.Request) {
	wsID, err := h.workspaceID(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, workspace_id, name, type, created_at FROM credentials WHERE workspace_id = $1 ORDER BY created_at DESC`,
		wsID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	creds := []Credential{}
	for rows.Next() {
		var c Credential
		if err := rows.Scan(&c.ID, &c.WorkspaceID, &c.Name, &c.Type, &c.CreatedAt); err == nil {
			creds = append(creds, c)
		}
	}
	writeJSON(w, http.StatusOK, creds)
}

type createCredentialRequest struct {
	Name string                 `json:"name"`
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

func (h *credentialsHandler) create(w http.ResponseWriter, r *http.Request) {
	wsID, err := h.workspaceID(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}

	var req createCredentialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Type == "" {
		writeError(w, http.StatusBadRequest, "name and type are required")
		return
	}

	setup := &setupHandler{db: h.db}
	secretKey, err := setup.getOrCreateSecretKey(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "secret key unavailable")
		return
	}

	dataJSON, err := json.Marshal(req.Data)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid data")
		return
	}

	encData, err := encrypt(dataJSON, secretKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "encryption failed")
		return
	}

	var c Credential
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO credentials (workspace_id, name, type, data_enc)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, workspace_id, name, type, created_at`,
		wsID, req.Name, req.Type, []byte(encData),
	).Scan(&c.ID, &c.WorkspaceID, &c.Name, &c.Type, &c.CreatedAt)
	if err != nil {
		writeError(w, http.StatusConflict, "credential name already exists")
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *credentialsHandler) delete(w http.ResponseWriter, r *http.Request) {
	wsID, err := h.workspaceID(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}

	credID := chi.URLParam(r, "credID")
	_, err = h.db.Exec(r.Context(),
		`DELETE FROM credentials WHERE id = $1 AND workspace_id = $2`,
		credID, wsID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// reveal returns the decrypted data for a credential.
func (h *credentialsHandler) reveal(w http.ResponseWriter, r *http.Request) {
	wsID, err := h.workspaceID(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "workspace not found")
		return
	}

	credID := chi.URLParam(r, "credID")
	var encData []byte
	err = h.db.QueryRow(r.Context(),
		`SELECT data_enc FROM credentials WHERE id = $1 AND workspace_id = $2`,
		credID, wsID,
	).Scan(&encData)
	if err != nil {
		writeError(w, http.StatusNotFound, "credential not found")
		return
	}

	setup := &setupHandler{db: h.db}
	secretKey, err := setup.getOrCreateSecretKey(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "secret key unavailable")
		return
	}

	plaintext, err := decrypt(encData, secretKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "decryption failed")
		return
	}

	var data map[string]interface{}
	if err := json.Unmarshal(plaintext, &data); err != nil {
		writeError(w, http.StatusInternalServerError, "invalid stored data")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"data": data})
}

func decrypt(encHex []byte, key []byte) ([]byte, error) {
	ciphertext, err := hex.DecodeString(string(encHex))
	if err != nil {
		return nil, fmt.Errorf("hex decode: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce := ciphertext[:gcm.NonceSize()]
	ciphertext = ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}
