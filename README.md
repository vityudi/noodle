<div align="center">

<br />

# 🍜 Noodle

**Build and expose MCP servers visually — no code required.**

Noodle is an open-source, self-hosted platform that lets anyone connect APIs, databases, and internal tools and expose them as MCP servers ready for any AI agent to consume.

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-zinc.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go)](https://go.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docs.docker.com/compose)

<br />

```bash
git clone https://github.com/vityudi/noodle && cd noodle && docker compose up
```

Open **http://localhost:3000** — that's it.

</div>

---

## Why Noodle?

AI agents are only as powerful as the tools they can access. Exposing those tools today means writing boilerplate servers, managing auth, handling schemas, and maintaining infra — before you even get to the actual logic.

Noodle removes all of that. You draw the flow, Noodle runs it.

---

## How it works

```
┌─────────────────────────────────────────────────────┐
│                    Flow Builder                      │
│                                                      │
│  [API Key] ──▶ [HTTP Request] ──▶ [JSON Transform]  │
│                                                      │
└────────────────────────┬────────────────────────────┘
                         │ saves flow JSON
                         ▼
                   ┌──────────┐
                   │ Postgres │
                   └────┬─────┘
                        │ loads on demand
                        ▼
                 ┌─────────────┐
                 │ MCP Runtime │  ◀──── Claude / GPT / any agent
                 └─────────────┘
                        │
             http://localhost:8080/mcp/my-project
```

Each MCP project gets its own endpoint. Point any agent at it and your flows become tools.

---

## Features

### Visual Flow Builder
Drag, connect, configure. No code needed for most use cases. Every node has a form-based config panel — inputs, outputs, and credentials all managed in the UI.

### Built-in Nodes
| Category | Nodes |
|---|---|
| Connectivity | HTTP Request, GraphQL, WebSocket, gRPC |
| Databases | PostgreSQL, MySQL, MongoDB, Redis, SQLite |
| Auth | API Key, OAuth 2.0, JWT, Basic Auth |
| Transform | JSON Transform, Template, Script (JS/Python), Condition, Loop |
| Messaging | Webhook, Kafka, RabbitMQ, Email |
| Utilities | Delay, Log, Variable, Merge |

### AI Assistant _(optional — bring your own LLM)_
Describe what you want in plain language. The assistant generates the flow JSON directly, not free text — it appears immediately in the builder, ready to adjust.

> _"Create a tool that fetches a customer by email from my REST API and returns their name and plan"_

Supports Anthropic, OpenAI, and Ollama (local). Fully functional without any AI configured.

### Credentials & Secrets
API keys, OAuth tokens, and environment variables are configured through the UI and encrypted at rest. No `.env` editing after the initial clone.

### MCP-Ready Endpoints
Every project exposes a standard MCP endpoint with auto-generated tool schemas. Drop the URL into any agent and your tools are available immediately.

---

## Quickstart

**Prerequisites:** Docker and Docker Compose.

```bash
# 1. Clone
git clone https://github.com/vityudi/noodle
cd noodle

# 2. Start
docker compose up

# 3. Open
# http://localhost:3000 → setup wizard → done
```

No `.env` file needed. The setup wizard handles everything on first visit.

### Advanced / self-hosting

For custom database URLs, ports, or external Postgres/Redis instances, create a `.env` file based on the example:

```bash
cp .env.example .env
# edit .env
docker compose up
```

Values in `.env` override the built-in defaults. The application works correctly either way.

---

## Development

```bash
docker compose -f docker-compose.dev.yml up
```

Both services have hot-reload enabled — Vite HMR for the frontend, Air for Go.

Services exposed locally:

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Stack

| Layer | Tech | Reason |
|---|---|---|
| Frontend | Vite + React 19 + React Flow | Fast build, visual graph editor |
| UI | shadcn/ui + Tailwind CSS | Unstyled primitives, full control |
| State | Zustand + TanStack Query | Flow state + server cache |
| Backend | Go + Chi | Single binary, low overhead |
| Database | PostgreSQL 16 + sqlc | Type-safe queries, no ORM |
| Migrations | golang-migrate | Embedded, runs on boot |
| Infra | Docker Compose | One-command setup |

---

## Contributing

```bash
git clone https://github.com/vityudi/noodle
cd noodle
docker compose -f docker-compose.dev.yml up
```

That's the full dev environment. Pick an issue, open a PR.

---

## License

MIT — free forever, no lock-in. You own your data and your instance.
