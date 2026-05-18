"""Trend endpoint tests.

The trend drives the over-time chart in the UI. Three things matter:
1. Ordering — chronological, oldest first (so the chart reads left→right).
2. Inclusion — soft-deleted statements never appear.
3. Per-point band correctness, including insufficient-data points (a customer
   with an empty month should see a visible gap, not have the point silently
   omitted).
"""
from datetime import date


def test_trend_empty_when_no_statements(client):
    assert client.get("/api/trend").json() == []


def test_trend_is_chronological_regardless_of_creation_order(client, seed_statement):
    seed_statement(period_start=date(2026, 3, 1), period_end=date(2026, 3, 31))
    seed_statement(period_start=date(2026, 1, 1), period_end=date(2026, 1, 31))
    seed_statement(period_start=date(2026, 2, 1), period_end=date(2026, 2, 28))

    res = client.get("/api/trend").json()
    assert [p["period_end"] for p in res] == ["2026-01-31", "2026-02-28", "2026-03-31"]


def test_trend_returns_mixed_bands_correctly(client, seed_statement):
    # Three statements covering each non-trivial band.
    seed_statement(
        period_start=date(2026, 1, 1),
        period_end=date(2026, 1, 31),
        items=[
            ("income", "salary", None, 200_000),
            ("expense", "housing", None, 100_000),
        ],
    )  # healthy
    seed_statement(
        period_start=date(2026, 2, 1),
        period_end=date(2026, 2, 28),
        items=[
            ("income", "salary", None, 200_000),
            ("expense", "housing", None, 195_000),
        ],
    )  # tight
    seed_statement(
        period_start=date(2026, 3, 1),
        period_end=date(2026, 3, 31),
        items=[
            ("income", "salary", None, 200_000),
            ("expense", "housing", None, 250_000),
        ],
    )  # deficit

    bands = [p["band"] for p in client.get("/api/trend").json()]
    assert bands == ["healthy", "tight", "deficit"]


def test_trend_includes_insufficient_data_points(client, seed_statement):
    # An empty month is meaningful — it should appear in the series so the UI
    # can render a gap, not silently disappear.
    seed_statement(
        period_start=date(2026, 1, 1),
        period_end=date(2026, 1, 31),
        items=[
            ("income", "salary", None, 200_000),
            ("expense", "housing", None, 50_000),
        ],
    )
    seed_statement(
        period_start=date(2026, 2, 1),
        period_end=date(2026, 2, 28),
        items=[],
    )

    points = client.get("/api/trend").json()
    assert len(points) == 2
    assert points[1]["band"] == "insufficient_data"
    assert points[1]["total_income_pence"] == 0
    assert points[1]["total_expenditure_pence"] == 0


def test_trend_excludes_soft_deleted_statements(client, seed_statement):
    keep = seed_statement(period_start=date(2026, 1, 1), period_end=date(2026, 1, 31))
    drop = seed_statement(period_start=date(2026, 2, 1), period_end=date(2026, 2, 28))
    client.delete(f"/api/statements/{drop.id}")

    points = client.get("/api/trend").json()
    assert [p["statement_id"] for p in points] == [keep.id]


def test_trend_reflects_soft_deleted_line_items_in_band(client, seed_statement):
    # Statement starts in deficit; soft-deleting the big expense flips it to healthy.
    stmt = seed_statement(
        items=[
            ("income", "salary", None, 200_000),
            ("expense", "debt_repayments", None, 250_000),
        ],
    )
    assert client.get("/api/trend").json()[0]["band"] == "deficit"

    big = next(li for li in stmt.line_items if li.category == "debt_repayments")
    client.delete(f"/api/statements/{stmt.id}/line-items/{big.id}")

    assert client.get("/api/trend").json()[0]["band"] == "healthy"


def test_trend_period_dates_are_iso_formatted(client, seed_statement):
    seed_statement(period_start=date(2026, 1, 1), period_end=date(2026, 1, 31))
    point = client.get("/api/trend").json()[0]
    # Pin the wire format — UI date parsing depends on this.
    assert point["period_start"] == "2026-01-01"
    assert point["period_end"] == "2026-01-31"
