"""End-to-end tests through the FastAPI routes.

Convention:
- Tests about the *create contract* (validation, shape of POST /statements)
  build their payload inline — that's the thing under test.
- Tests about *behaviour after a statement exists* use the ``seed_statement``
  factory to plant a row directly in the DB, then exercise the API.
"""
import time
from datetime import date


# ---------- create contract ----------


class TestCreateStatement:
    def test_creates_statement_with_assessment_inline(self, client):
        res = client.post(
            "/api/statements",
            json={
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "line_items": [
                    {"type": "income", "category": "salary", "amount_pence": 280_000},
                    {"type": "expense", "category": "housing", "amount_pence": 50_000},
                ],
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["period_start"] == "2026-04-01"
        assert body["assessment"]["band"] == "healthy"
        assert body["assessment"]["surplus_pence"] == 230_000
        assert len(body["line_items"]) == 2

    def test_rejects_period_end_before_period_start(self, client):
        res = client.post(
            "/api/statements",
            json={
                "period_start": "2026-04-30",
                "period_end": "2026-04-01",
                "line_items": [],
            },
        )
        assert res.status_code == 422

    def test_rejects_negative_amount(self, client):
        res = client.post(
            "/api/statements",
            json={
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "line_items": [
                    {"type": "income", "category": "salary", "amount_pence": -1}
                ],
            },
        )
        assert res.status_code == 422

    def test_rejects_category_not_valid_for_type(self, client):
        res = client.post(
            "/api/statements",
            json={
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "line_items": [
                    {"type": "income", "category": "housing", "amount_pence": 1000}
                ],
            },
        )
        assert res.status_code == 422

    def test_empty_statement_is_insufficient_data(self, client):
        res = client.post(
            "/api/statements",
            json={
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "line_items": [],
            },
        )
        assert res.status_code == 201
        assert res.json()["assessment"]["band"] == "insufficient_data"


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


class TestSoftDelete:
    def test_deleted_statement_disappears_from_list_and_get(self, client, seed_statement):
        stmt = seed_statement()
        assert client.delete(f"/api/statements/{stmt.id}").status_code == 204
        assert client.get("/api/statements").json() == []
        assert client.get(f"/api/statements/{stmt.id}").status_code == 404


# ---------- line-item mutations ----------


class TestLineItemMutations:
    def test_add_line_item_returns_recalculated_assessment(self, client, seed_statement):
        stmt = seed_statement(items=[("income", "salary", None, 200_000)])  # healthy/empty exp
        res = client.post(
            f"/api/statements/{stmt.id}/line-items",
            json={"type": "expense", "category": "housing", "amount_pence": 250_000},
        )
        assert res.status_code == 201
        assert res.json()["assessment"]["band"] == "deficit"

    def test_soft_delete_line_item_recalculates(self, client, seed_statement):
        stmt = seed_statement()
        item_id = stmt.line_items[1].id  # one of the expenses

        body = client.delete(f"/api/statements/{stmt.id}/line-items/{item_id}").json()
        # Soft-deleted items don't appear in the read model.
        assert all(li["id"] != item_id for li in body["line_items"])
        assert body["assessment"]["total_expenditure_pence"] == 50_000

    def test_update_amount_flips_band(self, client, seed_statement):
        stmt = seed_statement()
        item_id = stmt.line_items[1].id  # £500 housing

        before = client.get(f"/api/statements/{stmt.id}").json()
        assert before["assessment"]["band"] == "healthy"

        res = client.patch(
            f"/api/statements/{stmt.id}/line-items/{item_id}",
            json={"amount_pence": 300_000},
        )
        assert res.status_code == 200
        assert res.json()["assessment"]["band"] == "deficit"

    def test_partial_patch_rejects_incompatible_category_against_stored_type(
        self, client, seed_statement
    ):
        # Regression: previously a PATCH containing only `category` skipped
        # validation, letting a caller pair an expense-only category with an
        # income line item (or vice versa).
        stmt = seed_statement(items=[("income", "salary", None, 200_000)])
        item_id = stmt.line_items[0].id

        res = client.patch(
            f"/api/statements/{stmt.id}/line-items/{item_id}",
            json={"category": "housing"},  # expense-only category
        )
        assert res.status_code == 422

    def test_partial_patch_rejects_incompatible_type_against_stored_category(
        self, client, seed_statement
    ):
        stmt = seed_statement(items=[("expense", "housing", "Rent", 50_000)])
        item_id = stmt.line_items[0].id

        res = client.patch(
            f"/api/statements/{stmt.id}/line-items/{item_id}",
            json={"type": "income"},  # 'housing' isn't a valid income category
        )
        assert res.status_code == 422


# ---------- parent updated_at bumps ----------


class TestParentUpdatedAtBump:
    """Editing a line item must move the parent statement's updated_at forward.

    This is part of the API contract: clients sort/cache by updated_at, so a
    silently-stale parent timestamp would be a real bug.
    """

    def _updated_at(self, client, statement_id: str) -> str:
        return client.get(f"/api/statements/{statement_id}").json()["updated_at"]

    def test_add_line_item_bumps_parent(self, client, seed_statement):
        stmt = seed_statement()
        before = self._updated_at(client, stmt.id)
        time.sleep(0.01)

        client.post(
            f"/api/statements/{stmt.id}/line-items",
            json={"type": "expense", "category": "food", "amount_pence": 1000},
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
            json={"amount_pence": 999_999},
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
        # Customer starts with just income, then gradually logs outgoings.
        created = client.post(
            "/api/statements",
            json={
                "period_start": "2026-04-01",
                "period_end": "2026-04-30",
                "line_items": [
                    {"type": "income", "category": "salary", "amount_pence": 200_000},
                ],
            },
        ).json()
        sid = created["id"]
        assert created["assessment"]["band"] == "healthy"  # no outgoings yet

        # Add rent — still healthy.
        r = client.post(
            f"/api/statements/{sid}/line-items",
            json={"type": "expense", "category": "housing", "amount_pence": 50_000},
        )
        assert r.json()["assessment"]["band"] == "healthy"

        # Add a hefty debt repayment — tips into deficit.
        r = client.post(
            f"/api/statements/{sid}/line-items",
            json={"type": "expense", "category": "debt_repayments", "amount_pence": 200_000},
        )
        assert r.json()["assessment"]["band"] == "deficit"

        # Customer realises the debt repayment was logged wrong; fixes it.
        debt_item = next(
            li for li in r.json()["line_items"] if li["category"] == "debt_repayments"
        )
        r = client.patch(
            f"/api/statements/{sid}/line-items/{debt_item['id']}",
            json={"amount_pence": 80_000},
        )
        assert r.json()["assessment"]["band"] == "healthy"

    def test_band_transitions_via_line_item_lifecycle(self, client, seed_statement):
        # Start healthy.
        stmt = seed_statement(
            items=[
                ("income", "salary", None, 200_000),
                ("expense", "housing", None, 50_000),
            ]
        )
        assert client.get(f"/api/statements/{stmt.id}").json()["assessment"]["band"] == "healthy"

        # Add a big expense → deficit.
        r = client.post(
            f"/api/statements/{stmt.id}/line-items",
            json={"type": "expense", "category": "debt_repayments", "amount_pence": 200_000},
        )
        big_id = r.json()["line_items"][-1]["id"]
        assert r.json()["assessment"]["band"] == "deficit"

        # Trim it → tight.
        r = client.patch(
            f"/api/statements/{stmt.id}/line-items/{big_id}",
            json={"amount_pence": 145_000},
        )
        assert r.json()["assessment"]["band"] == "tight"

        # Remove it entirely → back to healthy.
        r = client.delete(f"/api/statements/{stmt.id}/line-items/{big_id}")
        assert r.json()["assessment"]["band"] == "healthy"
