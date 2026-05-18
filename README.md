# Ophelos Financial Health

A small full-stack app that turns a customer's logged income and outgoings into
a meaningful affordability assessment, explains the result in plain language,
and tracks how their position changes over time.

Designed for the FCA-regulated, vulnerable-customer context that Ophelos
operates in: warm copy, no alarming language, always paired with a
forward-looking next step. See [SPEC.md](./SPEC.md) for the full spec and
[DECISIONS.md](./DECISIONS.md) for the choices made along the way.

## Stack

- **Backend** — Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2,
  SQLite (dev), pytest. Layered as `routers → services → core` so the
  affordability rules live in a pure module that's trivial to test.
- **Frontend** — React 18 + TypeScript, Vite, TanStack Query, React Router,
  Recharts. The API client is generated from the live OpenAPI schema via
  `@hey-api/openapi-ts`, so the types are always in sync.
- **Tests** — pytest (backend, 41 tests), Vitest + Testing Library + MSW
  (frontend, 64 tests). MSW intercepts real fetches from the generated client,
  so the test runs exercise the same path production does.

## Layout

```
.
├── Makefile                # all the commands you need (see `make help`)
├── SPEC.md                 # what's being built and why
├── DECISIONS.md            # design choices + tradeoffs
├── .env.example            # copy to .env to override defaults
│
├── backend/
│   ├── app/
│   │   ├── core/           # pure business logic (assessment rules)
│   │   ├── services/       # DB I/O, transactions
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── models/         # SQLAlchemy ORM
│   │   ├── schemas/        # Pydantic request/response shapes
│   │   └── main.py         # app factory, CORS, router mounting
│   ├── migrations/         # Alembic
│   ├── scripts/seed.py     # dev fixture data
│   └── tests/              # core, services, routers
│
└── frontend/
    ├── src/
    │   ├── api/            # generated OpenAPI client (do not edit)
    │   ├── components/     # Layout, AssessmentCard, ConfirmDialog, forms…
    │   ├── pages/          # Dashboard, Statements, Trend
    │   ├── hooks/          # TanStack Query wrappers
    │   ├── lib/            # client config, formatters, band metadata
    │   ├── test/           # MSW server, fixtures, factories, wrappers
    │   └── styles/         # design tokens + app CSS
    └── openapi-ts.config.ts
```

## Prerequisites

- **Python 3.12** (the venv is created against this exact minor)
- **Node 18+** (Node 22 used during development)
- **uv** — the Python package manager
  ([install](https://docs.astral.sh/uv/getting-started/installation/))

That's it. No global Python packages or system services to set up; the dev DB
is SQLite and lives inside `backend/`.

## Quick start

```bash
# One-time bootstrap: installs deps, runs migrations, seeds the dev DB.
make setup

# Run the API on :8000 and the web app on :5173 (Ctrl-C stops both).
make dev
```

Then visit <http://localhost:5173>. The API docs are at
<http://localhost:8000/docs>.

If you'd rather do it in two steps:

```bash
make install          # deps only
make db-reset         # drop + migrate + seed
make dev
```

### Running pieces separately

```bash
make dev-api          # just the API in reload mode
make dev-web          # just the Vite dev server
```

## Tests

```bash
make test             # backend + frontend
make test-backend     # pytest only
make test-frontend    # vitest only
```

Both suites run cold in a couple of seconds and have no external
dependencies — the frontend uses MSW to intercept HTTP, the backend uses an
in-memory SQLite for each test.

## Codegen

The TypeScript API client is generated from the backend's OpenAPI schema. If
you change a router or schema, regenerate:

```bash
make generate-client
```

This dumps `backend/openapi.json` and regenerates `frontend/src/api/`. Both
are gitignored — the source of truth is the FastAPI app.

## Configuration

Everything has sensible defaults. To override (custom port, custom DB path,
etc.) copy `.env.example` to `.env`. Settings:

| Variable             | Default                                | Used by   |
|----------------------|----------------------------------------|-----------|
| `DATABASE_URL`       | `sqlite:///backend/financial_health.db` | backend   |
| `CORS_ORIGINS`       | `http://localhost:5173`                | backend   |
| `API_HOST`/`API_PORT`| `127.0.0.1` / `8000`                   | backend   |
| `LOG_LEVEL`          | `info`                                 | backend   |
| `VITE_API_BASE_URL`  | `http://localhost:8000`                | frontend  |

## Make targets

`make help` lists everything. The headline ones:

| Target              | Purpose                                                       |
|---------------------|---------------------------------------------------------------|
| `setup`             | First-time bootstrap (install + migrate + seed)               |
| `install`           | Install backend + frontend deps                               |
| `dev`               | Run API + web together                                        |
| `test`              | Run both test suites                                          |
| `db-reset`          | Drop the dev SQLite file, migrate, seed                       |
| `generate-client`   | Regenerate the typed TS client from the live OpenAPI schema   |
