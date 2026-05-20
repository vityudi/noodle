package templates

import (
	"embed"
	"encoding/json"
	"net/http"
	"strings"
)

//go:embed *.json
var fs embed.FS

type TemplateInput struct {
	Key             string `json:"key"`
	Label           string `json:"label"`
	Description     string `json:"description"`
	Type            string `json:"type"`             // "string" | "url" | "secret"
	Target          string `json:"target"`            // "env" | "credential"
	CredentialField string `json:"credential_field,omitempty"`
	ConnectionType  string `json:"connection_type,omitempty"` // "postgres" | "mysql" | "mongodb"
	Placeholder     string `json:"placeholder,omitempty"`
	Required        bool   `json:"required"`
}

type Template struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Category    string          `json:"category"`
	Inputs      []TemplateInput `json:"inputs"`
	Flow        json.RawMessage `json:"flow"`
}

func load() ([]Template, error) {
	entries, err := fs.ReadDir(".")
	if err != nil {
		return nil, err
	}
	var out []Template
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		b, err := fs.ReadFile(e.Name())
		if err != nil {
			continue
		}
		var t Template
		if err := json.Unmarshal(b, &t); err != nil {
			continue
		}
		out = append(out, t)
	}
	return out, nil
}

func ListHandler(w http.ResponseWriter, r *http.Request) {
	templates, err := load()
	if err != nil {
		http.Error(w, `{"error":"could not load templates"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}
