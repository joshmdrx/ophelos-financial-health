"""End-to-end tests through the FastAPI routes.

Convention:
- Tests about the *create contract* (validation, shape of POST /statements)
  build their payload inline — that's the thing under test.
- Tests about *behaviour after a statement exists* use the ``seed_statement``
  factory to plant a row directly in the DB, then exercise the API.
"""
import time
from datetime import date


def _create_body(
    *,
    period_start: str = "2026-04-01",
    period_end: str = "2026-04-30",
    note: str | None = None,
    currency: str = "GBP",
    country_code: str = "GB",
    line_items: list[dict] | None = None,
) -> dict:
    if line_items is None:
        line_items = [
            {"type": "income", "category": "salary", "amount_minor": 280_000},
            {"type": "expense", "category": "housing", "amount_minor": 50_000},
        ]
    return {
        "period_start": period_start,
        "period_end": period_end,
        "note": note,
        "currency": currency,
        "country_code": country_code,
        "line_items": line_items,
    }


# ---------- create contract ----------


class TestCreateStatement:
    def test_creates_statement_with_assessment_inline(self, client):
        res = client.post("/api/statements", json=_create_body())
        assert res.status_code == 201
        body = res.json()
        assert body["period_start"] == "2026-04-01"
        assert body["currency"] == "GBP"
        assert body["country_code"] == "GB"
        assert body["assessment"]["band"] == "healthy"
        assert body["assessment"]["template_key"] == "healthy_default"
        assert body["assessment"]["currency"] == "GBP"
        assert body["assessment"]["numbers"]["surplus_minor"] == 230_000
        assert len(body["line_items"]) == 2

    def test_rejects_period_end_before_period_start(self, client):
        res = client.post(
            "/api/statements",
            json=_create_body(period_start="2026-04-30", period_end="2026-04-01"),
        )
        assert res.status_code == 422

    def test_rejects_negative_amount(self, client):
        res = client.post(
            "/api/statements",
            json=_create_body(
                line_items=[{"type": "income", "category": "salary", "amount_minor": -1}],
            ),
        )
        assert res.status_code == 422

    def test_rejects_category_not_valid_for_type(self, client):
        res = client.post(
            "/api/statements",
            json=_create_body(
                line_items=[{"type": "income", "category": "housing", "amount_minor": 1000}],
            ),
        )
        assert res.status_code == 422

    def test_rejects_currency_outside_allowlist(self, client):
        res = client.post("/api/statements", json=_create_body(currency="JPY"))
        assert res.status_code == 422

    def test_rejects_country_outside_allowlist(self, client):
        res = client.post("/api/statements", json=_create_body(country_code="JP"))
        assert res.status_code == 422

    def test_accepts_non_gbp_currency_from_allowlist(self, client):
        res = client.post(
            "/api/statements",
            json=_create_body(currency="EUR", country_code="IE"),
        )
        assert res.status_code == 201
        assert res.json()["currency"] == "EUR"
        assert res.json()["assessment"]["currency"] == "EUR"

    def test_empty_statement_is_insufficient_data(self, client):
        res = client.post("/api/statements", json=_create_body(line_items=[]))
        assert res.status_code == 201
        body = res.json()
        assert body["assessment"]["band"] == "insufficient_data"
        assert body["assessment"]["template_key"] == "insufficient_data_default"


# ---------- currency / country immutability ----------


class TestImmutability:
    def test_patch_rejects_currency_change(self, client, seed_statement):
        stmt = seed_statement()
        res = client.patch(
            f"/api/statements/{stmt.id}",
            json={"currency": "EUR"},
        )
        # Pydantic ``extra='forbid'`` on StatementUpdate produces a 422.
        assert res.status_code == 422

    def test_patch_rejects_country_code_change(self, client, seed_statement):
        stmt = seed_statement()
        res = client.patch(
            f"/api/statements/{stmt.id}",
            json={"country_code": "IE"},
        )
        assert res.status_code == 422

    def test_patch_still_allows_period_changes(self, client, seed_statement):
        stmt = seed_statement()
        res = client.patch(
            f"/api/statements/{stmt.id}",
            json={"period_end": "2026-05-15"},
        )
        assert res.status_code == 200
        assert res.json()["period_end"] == "2026-05-15"
        assert res.json()["currency"] == "GBP"  # unchanged


# ---------- list / get / soft delete ----------


class TestListAndGet:
    def test_empty_list_returns_empty_array_not_error(self, client):
        assert client.get("/api/statements").json() == []

    def test_get_missing_statement_returns_404(self, client):
        assert client.get("/api/statements/does-not-exist").status_code == 404

    def test_list_is_ordered_newest_period_first(self, client, seed_statement):
        seed_statement(period_start=date(2026, 1, 1), period_end=date(2026, 1, 31))
        seed_statement(period_start=date(2026, 3, 1), period_end=date(2026, 3, 31))
        seed_statement(period_start=date(2026, 2, 1), period_end=date(2026, 2, 28))

        periods = [s["period_end"] for s in client.get("/api/statements").json()]
        assert periods == ["2026-03-31", "2026-02-28", "2026-01-31"]

    def test_list_can_be_filtered_by_date_range(self, client, seed_statement):
        seed_statement(period_start=date(2026, 1, 1), period_end=date(2026, 1, 31))
        seed_statement(period_start=date(2026, 2, 1), period_end=date(2026, 2, 28))
        seed_statement(period_start=date(2026, 3, 1), period_end=date(2026, 3, 31))

        res = client.get("/api/statements", params={"from": "2026-02-01", "to": "2026-02-28"})
        assert [s["period_start"] for s in res.json()] == ["2026-02-01"]

    def test_currency_and_country_appear_on_summary_and_detail(self, client, seed_statement):
        stmt = seed_statement(currency="EUR", country_code="IE")
        summary = client.get("/api/statements").json()[0]
        assert summary["currency"] == "EUR"
        assert summary["country_code"] == "IE"
        detail = client.get(f"/api/statements/{stmt.id}").json()
        assert detail["currency"] == "EUR"
        assert detail["country_code"] == "IE"


class TestSoftDelete:
    def test_deleted_statement_disappears_from_list_and_get(self, client, seed_statement):
        stmt = seed_statement()
        assert client.delete(f"/api/statements/{stmt.id}").status_code == 204
        assert client.get("/api/statements").json() == []
        assert client.get(f"/api/statements/{stmt.id}").status_code == 404


# ---------- line-item mutations ----------


class TestLineItemMutations:
    def test_add_line_item_returns_recalculated_assessment(self, client, seed_statement):
        stmt = seed_statement(items=[("income", "salary", None, 200_000)])
        res = client.post(
            f"/api/statements/{stmt.id}/line-items",
            json={"type": "expense", "category": "housing", "amount_minor": 250_000},
        )
        assert res.status_code == 201
        assert res.json()["assessment"]["band"] == "deficit"
        assert res.json()["assessment"]["numbers"]["surplus_minor"] == -50_000

    def test_soft_delete_line_item_recalculates(self, client, seed_statement):
        stmt = seed_statement()
        item_id = stmt.line_items[1].id  # one of the expenses

        body = client.delete(f"/api/statements/{stmt.id}/line-items/{item_id}").json()
        assert all(li["id"] != item_id for li in body["line_items"])
        assert body["assessment"]["numbers"]["expenditure_minor"] == 50_000

    def test_update_amount_flips_band(self, client, seed_statement):
        stmt = seed_statement()
        item_id = stmt.line_items[1].id

        before = client.get(f"/api/statements/{stmt.id}").json()
        assert before["assessment"]["band"] == "healthy"

        res = client.patch(
            f"/api/statements/{stmt.id}/line-items/{item_id}",
            json={"amount_minor": 300_000},
        )
        assert res.status_code == 200
        assert res.json()["assessment"]["band"] == "deficit"

    def test_partial_patch_rejects_incompatible_category_against_stored_type(
        self, client, seed_statement
    ):
        stmt = seed_statement(items=[("income", "salary", None, 200_000)])
        item_id = stmt.line_items[0].id

        res = client.patch(
            f"/api/statements/{stmt.id}/line-items/{item_id}",
            json={"category": "housing"},
        )
        assert res.status_code == 422

    def test_partial_patch_rejects_incompatible_type_against_stored_category(
        self, client, seed_statement
    ):
        stmt = seed_statement(items=[("expense", "housing", "Rent", 50_000)])
        item_id = stmt.line_items[0].id

        res = client.patch(
            f"/api/statements/{stmt.id}/line-items/{item_id}",
            json={"type": "income"},
        )
        assert res.status_code == 422


# ---------- parent updated_at bumps ----------


class TestParentUpdatedAtBump:
    """Editing a line item must move the parent statement's updated_at forward."""

    def _updated_at(self, client, statement_id: str) -> str:
        return client.get(f"/api/statements/{statement_id}").json()["updated_at"]

    def test_add_line_item_bumps_parent(self, client, seed_statement):
        stmt = seed_statement()
        before = self._updated_at(client, stmt.id)
        time.sleep(0.01)

        client.post(
            f"/api/statements/{stmt.id}/line-items",
            json={"type": "expense", "category": "food", "amount_minor": 1000},
        )
        after = self._updated_at(client, stmt.id)
        assert after > before

    def test_update_line_item_bumps_parent(self, client, seed_statement):
        stmt = seed_statement()
        item_id = stmt.line_items[0].id
        before = self._updated_at(client, stmt.id)
        time.sleep(0.01)

        client.patch(
            f"/api/statements/{stmt.id}/line-items/{item_id}",
            json={"amount_minor": 999_999},
        )
        after = self._updated_at(client, stmt.id)
        assert after > before

    def test_delete_line_item_bumps_parent(self, client, seed_statement):
        stmt = seed_statement()
        item_id = stmt.line_items[0].id
        before = self._updated_at(client, stmt.id)
        time.sleep(0.01)

        client.delete(f"/api/statements/{stmt.id}/line-items/{item_id}")
        after = self._updated_at(client, stmt.id)
        assert after > before


# ---------- multi-step flows ----------


class TestUserFlows:
    """The shape of real customer journeys, end-to-end through the API."""

    def test_create_then_iteratively_edit_to_completeness(self, client):
        created = client.post(
            "/api/statements",
            json=_create_body(
                line_items=[
                    {"type": "income", "category": "salary", "amount_minor": 200_000},
                ],
            ),
        ).json()
        sid = created["id"]
        assert created["assessment"]["band"] == "healthy"

        r = client.post(
            f"/api/statements/{sid}/line-items",
            json={"type": "expense", "category": "housing", "amount_minor": 50_000},
        )
        assert r.json()["assessment"]["band"] == "healthy"

        r = client.post(
            f"/api/statements/{sid}/line-items",
            json={"type": "expense", "category": "debt_repayments", "amount_minor": 200_000},
        )
        assert r.json()["assessment"]["band"] == "deficit"

        debt_item = next(
            li for li in r.json()["line_items"] if li["category"] == "debt_repayments"
        )
        r = client.patch(
            f"/api/statements/{sid}/line-items/{debt_item['id']}",
            json={"amount_minor": 80_000},
        )
        assert r.json()["assessment"]["band"] == "healthy"

    def test_band_transitions_via_line_item_lifecycle(self, client, seed_statement):
        stmt = seed_statement(
            items=[
                ("income", "salary", None, 200_000),
                ("expense", "housing", None, 50_000),
            ]
        )
        assert client.get(f"/api/statements/{stmt.id}").json()["assessment"]["band"] == "healthy"

        r = client.post(
            f"/api/statements/{stmt.id}/line-items",
            json={"type": "expense", "category": "debt_repayments", "amount_minor": 200_000},
        )
        big_id = r.json()["line_items"][-1]["id"]
        assert r.json()["assessment"]["band"] == "deficit"

        r = client.patch(
            f"/api/statements/{stmt.id}/line-items/{big_id}",
            json={"amount_minor": 145_000},
        )
        assert r.json()["assessment"]["band"] == "tight"

        r = client.delete(f"/api/statements/{stmt.id}/line-items/{big_id}")
        assert r.json()["assessment"]["band"] == "healthy"
