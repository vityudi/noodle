package schema

import (
	_ "embed"
	"net/http"
)

//go:embed flow.schema.json
var flowSchema []byte

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/schema+json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	w.Write(flowSchema)
}
