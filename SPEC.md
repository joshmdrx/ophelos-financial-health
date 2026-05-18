# Ophelos Financial Health — Spec

A customer-facing tool that turns logged income/expenditure into an affordability assessment, tracks it over time, and surfaces the reasoning behind each result. Scoped as a single-user demo (no auth).

## Principles

- **Warm, non-alarming UI.** No red/failure language. Always pair an assessment with an encouraging next step.
- **Explainability.** Every assessment shows the numbers behind it (income, expenditure, surplus) and the rule that produced the band.
- **Edge cases as first-class states.** Zero income, deficit, no data, single statement — each has a deliberate response in API and UI.
- **Tests protect the rules.** Assessment thresholds and edge-case behaviour are the primary thing covered by tests, not CRUD plumbing.

## Repo structure

```
.
├── Makefile                    # run, test, seed, migrate, generate-client
├── SPEC.md
├── DECISIONS.md
├── README.md
│
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── app/
│   │   ├── main.py             # FastAPI app, router mounting, CORS
│   │   ├── config.py           # env-driven settings
│   │   ├── db.py               # engine + session
│   │   ├── enums.py            # LineItemType, IncomeCategory, ExpenseCategory, AssessmentBand
│   │   ├── models/             # SQLAlchemy ORM (DB shape)
│   │   │   ├── statement.py
│   │   │   └── line_item.py
│   │   ├── schemas/            # Pydantic (API shape)
│   │   │   ├── statement.py
│   │   │   ├── line_item.py
│   │   │   └── assessment.py
│   │   ├── routers/            # HTTP layer only — no logic
│   │   │   ├── health.py
│   │   │   └── statements.py
│   │   ├── services/           # I/O — DB reads/writes, orchestration
│   │   │   └── statements.py
│   │   └── core/               # Pure business logic — no I/O, easy to test
│   │       └── assessment.py
│   ├── migrations/             # alembic
│   ├── scripts/
│   │   └── seed.py             # idempotent seed for dev
│   └── tests/
│       ├── core/               # assessment rules, edge cases
│       ├── services/           # DB-backed behaviour
│       └── routers/            # endpoint contracts
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── openapi-ts.config.ts    # client generation config
    └── src/
        ├── main.tsx
        ├── App.tsx             # router
        ├── api/                # generated OpenAPI client (do not edit)
        ├── components/
        │   ├── Layout.tsx      # sidebar + content slot
        │   ├── Sidebar.tsx
        │   ├── AssessmentCard.tsx
        │   ├── TrendChart.tsx  # recharts
        │   └── states/         # Loading, Error, Empty
        ├── pages/
        │   ├── Dashboard.tsx   # current assessment + explanation
        │   ├── Statements.tsx  # list + edit
        │   └── Trend.tsx       # over-time view
        ├── hooks/
        └── lib/
```

### Layering rules

- `routers/` → `services/` → `core/` and `models/`. Routers don't touch the DB directly; `core/` doesn't import SQLAlchemy or FastAPI.
- `core/assessment.py` takes plain values (income, expenditure) and returns a result. This is the unit covered most thoroughly by tests.
- `services/` is where transactions, soft-deletes, and recalculation-on-read live.

## Data model

Money is stored as **integer pence** to avoid float drift. All tables have `created_at`, `updated_at`, `is_deleted` (soft delete).

### `statements`

A period of recorded income and expenditure. Past statements are editable; assessments are recalculated on read.

| column         | type         | notes                                          |
|----------------|--------------|------------------------------------------------|
| id             | uuid (pk)    |                                                |
| period_start   | date         | inclusive                                      |
| period_end     | date         | inclusive; must be >= period_start             |
| note           | text, null   | optional free-text from the customer           |
| created_at     | datetime     |                                                |
| updated_at     | datetime     |                                                |
| is_deleted     | bool         | soft delete                                    |

Constraints:
- `period_end >= period_start`
- No overlap check enforced at DB level (UI guides this); service layer warns but allows it.

### `line_items`

| column         | type         | notes                                          |
|----------------|--------------|------------------------------------------------|
| id             | uuid (pk)    |                                                |
| statement_id   | uuid (fk)    | → statements.id                                |
| type           | enum         | `income` \| `expense`                          |
| category       | enum         | depends on `type` (see below)                  |
| label          | text, null   | e.g. "Salary — Acme Ltd"                       |
| amount_pence   | integer      | non-negative; sign is implied by `type`        |
| created_at     | datetime     |                                                |
| updated_at     | datetime     |                                                |
| is_deleted     | bool         |                                                |

### Enums

```
LineItemType      = income | expense

IncomeCategory    = salary | benefits | pension | other
ExpenseCategory   = housing | utilities | food | transport
                  | debt_repayments | childcare | insurance | other

AssessmentBand    = healthy | tight | deficit | insufficient_data
```

Validation: a line item's `category` must belong to the set matching its `type`.

### Assessment (computed, not stored)

Assessments are derived from a statement's non-deleted line items at read time. Not persisted — this keeps editing past statements simple and avoids drift.

Default thresholds (configurable in `core/assessment.py`):

| band                 | rule                                                  |
|----------------------|-------------------------------------------------------|
| `insufficient_data`  | no line items, or total income == 0                   |
| `healthy`            | surplus / income ≥ 0.10                               |
| `tight`              | 0 ≤ surplus / income < 0.10                           |
| `deficit`            | surplus < 0                                           |

Assessment response carries the inputs so the UI can explain itself:

```
{
  "band": "tight",
  "total_income_pence": 280000,
  "total_expenditure_pence": 265000,
  "surplus_pence": 15000,
  "surplus_ratio": 0.0536,
  "explanation": "Your income just covers your outgoings, with a small amount left over."
}
```

## API

Base path: `/api`. JSON only. All money fields named `*_pence` (integer) at the wire layer; the frontend formats for display.

### Health

`GET /api/health`
→ `200 { "status": "ok" }`

Used by Make targets and the frontend startup check.

### Statements

`GET /api/statements?from=YYYY-MM-DD&to=YYYY-MM-DD`
List non-deleted statements, newest first. Date filters optional. Each item includes its assessment summary (band + totals) so the trend view doesn't need N+1 calls.

`POST /api/statements`
Create a statement with its initial line items in one call.
```
{
  "period_start": "2026-04-01",
  "period_end":   "2026-04-30",
  "note": null,
  "line_items": [
    { "type": "income",  "category": "salary",  "label": "Salary",   "amount_pence": 280000 },
    { "type": "expense", "category": "housing", "label": "Rent",     "amount_pence":  50000 }
  ]
}
```
→ `201` with the created statement + assessment.

`GET /api/statements/{id}`
Full statement: line items + assessment.

`PATCH /api/statements/{id}`
Update period/note. Line items have their own endpoints.

`DELETE /api/statements/{id}`
Soft delete (`is_deleted = true`).

### Line items (nested)

`POST /api/statements/{id}/line-items` — add
`PATCH /api/statements/{id}/line-items/{item_id}` — edit
`DELETE /api/statements/{id}/line-items/{item_id}` — soft delete

Any mutation to line items causes the parent statement's `updated_at` to bump.

### Trend

`GET /api/trend`
A chronological series of `{ period_end, band, total_income_pence, total_expenditure_pence, surplus_pence }` across all non-deleted statements. Drives the over-time chart. Returns `[]` if no statements — the frontend renders an empty state, not an error.

## Edge cases (explicit contract)

| situation                                     | API behaviour                                  | UI behaviour                                       |
|-----------------------------------------------|------------------------------------------------|----------------------------------------------------|
| No statements yet                             | endpoints return `[]` / 404 on `/{id}`         | onboarding-style empty state with a clear CTA      |
| Statement with no line items                  | assessment band = `insufficient_data`          | prompt to add income/outgoings                     |
| Total income = 0                              | band = `insufficient_data` (not `deficit`)     | neutral copy — don't tell a user with no recorded income they're failing |
| Expenditure > income                          | band = `deficit`, negative `surplus_pence`     | warm framing, concrete next steps, no red          |
| Surplus exactly 0                             | band = `tight`                                 | encouraging tone                                   |
| Negative `amount_pence` submitted             | 422 validation error                           | inline form error                                  |
| Category not valid for type                   | 422 validation error                           | inline form error                                  |

## Out of scope (intentionally)

- Auth / multi-user. Single implicit user.
- Statement immutability and audit trail. Edits to past statements recompute on the fly.
- Persisted assessment history. Derived on read.
- Encryption at rest, PII handling beyond what SQLite gives us. Noted in DECISIONS.md as something a production build would address.
