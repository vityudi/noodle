package api

import (
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

// devAutoLogin is only mounted when DEV_MODE=true.
// It ensures an admin user exists and returns a JWT — no password required.
func (h *setupHandler) devAutoLogin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var userID string
	err := h.db.QueryRow(ctx, `SELECT id FROM users ORDER BY created_at LIMIT 1`).Scan(&userID)

	if err != nil {
		// No user yet — create the dev admin.
		hash, _ := bcrypt.GenerateFromPassword([]byte("devpassword"), bcrypt.MinCost)
		err = h.db.QueryRow(ctx,
			`INSERT INTO users (email, password) VALUES ('dev@noodle.local', $1) RETURNING id`,
			string(hash),
		).Scan(&userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create dev user")
			return
		}
		h.db.Exec(ctx,
			`INSERT INTO workspaces (name, owner_id) VALUES ('Dev Workspace', $1)`, userID)
	}

	token, err := h.issueToken(ctx, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}
