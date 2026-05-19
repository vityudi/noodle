package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/vityudi/noodle/backend/internal/api"
	"github.com/vityudi/noodle/backend/internal/config"
	"github.com/vityudi/noodle/backend/internal/db"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	log.Println("running database migrations...")
	if err := db.Migrate(cfg.DatabaseURL); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if cfg.DevMode {
		log.Println("⚠️  DEV_MODE enabled — /api/dev/auto-login is active")
	}
	router := api.NewRouter(pool, cfg.DevMode)

	log.Printf("noodle listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatal(err)
	}
}
