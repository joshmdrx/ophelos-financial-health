.PHONY: help install install-backend install-frontend setup dev dev-api dev-web test test-backend test-frontend migrate seed db-reset openapi generate-client

BACKEND  := backend
FRONTEND := frontend
UV       := uv

help:
	@echo "Setup"
	@echo "  install           install backend + frontend dependencies"
	@echo "  setup             install + migrate + seed (first-time bootstrap)"
	@echo ""
	@echo "Run"
	@echo "  dev               run API + web together (foreground, Ctrl-C stops both)"
	@echo "  dev-api           run the API in reload mode"
	@echo "  dev-web           run the Vite dev server"
	@echo ""
	@echo "Test"
	@echo "  test              run backend + frontend tests"
	@echo "  test-backend      run backend tests only"
	@echo "  test-frontend     run frontend tests only"
	@echo ""
	@echo "Database"
	@echo "  migrate           apply alembic migrations"
	@echo "  seed              seed the dev database"
	@echo "  db-reset          drop the dev sqlite file, migrate, seed"
	@echo ""
	@echo "Codegen"
	@echo "  openapi           dump the OpenAPI schema to backend/openapi.json"
	@echo "  generate-client   regenerate the typed TS client from openapi.json"

install: install-backend install-frontend

install-backend:
	cd $(BACKEND) && $(UV) venv --python 3.12
	cd $(BACKEND) && $(UV) pip install -e ".[dev]"

install-frontend:
	cd $(FRONTEND) && npm install

# One-shot bootstrap for a fresh clone: deps + DB schema + seed data.
setup: install migrate seed

dev:
	@echo "Starting API on :8000 and web on :5173. Ctrl-C to stop both."
	@trap 'kill 0' INT TERM; \
	  (cd $(BACKEND) && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) & \
	  (cd $(FRONTEND) && npm run dev) & \
	  wait

dev-api:
	cd $(BACKEND) && .venv/bin/uvicorn app.main:app --reload --host $${API_HOST:-127.0.0.1} --port $${API_PORT:-8000}

dev-web:
	cd $(FRONTEND) && npm run dev

test: test-backend test-frontend

test-backend:
	cd $(BACKEND) && .venv/bin/pytest

test-frontend:
	cd $(FRONTEND) && npm test

migrate:
	cd $(BACKEND) && .venv/bin/alembic upgrade head

seed:
	cd $(BACKEND) && .venv/bin/python scripts/seed.py

db-reset:
	rm -f $(BACKEND)/financial_health.db
	$(MAKE) migrate
	$(MAKE) seed

openapi:
	cd $(BACKEND) && .venv/bin/python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json
	@echo "Wrote $(BACKEND)/openapi.json"

# Regenerates the typed TS client. Runs openapi first so the schema is fresh.
generate-client: openapi
	cd $(FRONTEND) && npm run generate-client
