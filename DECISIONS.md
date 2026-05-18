# DECISIONS

## What I chose to build

A vertical slice end-to-end: a typed API (FastAPI + SQLAlchemy + SQLite), a React UI with a generated client, and an assessment engine pinned by tests. The user can log a month of income and outgoings, see an honest assessment with the numbers behind it, edit past months freely, and watch their position over time. Four bands: `healthy`, `tight`, `deficit` (framed as "Stretched" in the UI), and `insufficient_data`.

## Key choices

- **FastAPI + React.** A web app seemed an intuitive way to build the features outlined, with FastAPI and React being common modern frameworks I'm familar with and could get running quickly.
- **Generated TypeScript client from OpenAPI.** I added this at the start because I thought it might make development quicker, expecting the LLM to be able to quickly scaffold this and then use the API types and avoid any code smells that can appear in API calls. (In reality it's maybe heavier than necessary, but seems to have worked well).
- **Assessments are computed on the fly** Past statements are editable: storing the assessment would mean either denormalising and drifting, or recomputing on write. This is fine for a demo, but in a production system this is more complicated, and I'd prefer a precompute approach and stored assessments.
- **Money as integer minor units.** Floats and money are known to be problematic. I initially went with Claude's suggested `amount_pence`, and refactored to `amount_minor` for the multi-currency build.
- **Data Model including created, updated, deleted fields.** Have rued not adding soft delete to a model at the start more than once, presumably useful for FCA auditing.

## What I left out

- **Auth and multi-user.** Simpler for this demo, really should have user_ids etc. Considered a user switcher to see different profiles, but thought single user was enough.
- **Persisted assessment history.** Would expect this in a prod system, but seemed a useful feature to be able to edit past statements and correct your trends. Would want edit + recompute triggers perhaps ideally.
- **Handling multi-currency in the same graph.** It seems more likely a user might be stuck to a particular currency, rather than use multiple over many statements. For time I've handled a migration that adds currency options to statements, but not currency conversions for currencies in a single chart
- **Handling complex currencies.** I added an allowed list of currencies that fit the minor unit model, so Japanese Yen isn't allowed for example. Again for demo simplicity.



## What I'd tackle next

- **Statement periods.** It feels a bit loose that statements that be many custom periods. Safer would be enforcing a set unit, I'd want to add that with FE + BE validation.
- **Handling multi-currency in the same graph.** Makes the trends lines less useful.