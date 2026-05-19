# 🍜 Noodle

> Open-source, self-hosted platform for creating and managing MCP servers through a visual interface.

## Quickstart

```bash
git clone https://github.com/vityudi/noodle
cd noodle
cp .env.example .env   # add your AI provider key
docker compose up
```

Open [http://localhost:3000](http://localhost:3000) and follow the setup wizard.

## Development

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up
```

Hot-reload is enabled for both frontend (Vite HMR) and backend (Air).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 19 + React Flow + shadcn/ui + Tailwind |
| Backend | Go + Chi + sqlc + golang-migrate |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |

## License

MIT
