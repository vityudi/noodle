dev:
	docker compose -f docker-compose.dev.yml up --build

up:
	docker compose -f docker-compose.dev.yml up

down:
	docker compose -f docker-compose.dev.yml down

logs:
	docker compose -f docker-compose.dev.yml logs -f

reset:
	docker compose -f docker-compose.dev.yml down -v

.PHONY: dev up down logs reset
