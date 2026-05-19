package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	LogLevel    string
}

func Load() Config {
	return Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://noodle:noodle@postgres:5432/noodle?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://redis:6379"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
