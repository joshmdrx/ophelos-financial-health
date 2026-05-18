"""Assessment rules are the load-bearing logic. Tests pin each band and edge case."""
from app.core.assessment import HEALTHY_RATIO_THRESHOLD, assess
from app.enums import AssessmentBand


def item(type_: str, amount: int, *, is_deleted: bool = False, category: str | None = None) -> dict:
    return {
        "type": type_,
        "amount_pence": amount,
        "is_deleted": is_deleted,
        "category": category or ("salary" if type_ == "income" else "other"),
    }


class TestInsufficientData:
    def test_no_items_at_all(self):
        result = assess([])
        assert result.band == AssessmentBand.insufficient_data
        assert result.total_income_pence == 0
        assert result.total_expenditure_pence == 0
        assert result.surplus_ratio is None

    def test_only_expenses_no_income(self):
        # A user with no recorded income should not be flagged as 'deficit'.
        # That framing is harmful in the FCA / vulnerable-customer context.
        result = assess([item("expense", 50_000), item("expense", 20_000)])
        assert result.band == AssessmentBand.insufficient_data

    def test_only_deleted_items(self):
        result = assess([item("income", 100_000, is_deleted=True)])
        assert result.band == AssessmentBand.insufficient_data

    def test_zero_income_with_zero_expense(self):
        result = assess([item("income", 0), item("expense", 0)])
        assert result.band == AssessmentBand.insufficient_data


class TestBands:
    def test_healthy_when_surplus_ratio_above_threshold(self):
        # £2000 income, £1500 expense → ratio 0.25
        result = assess([item("income", 200_000), item("expense", 150_000)])
        assert result.band == AssessmentBand.healthy
        assert result.surplus_pence == 50_000
        assert result.surplus_ratio == 0.25

    def test_tight_when_small_positive_surplus(self):
        # £2000 income, £1900 expense → ratio 0.05
        result = assess([item("income", 200_000), item("expense", 190_000)])
        assert result.band == AssessmentBand.tight
        assert result.surplus_pence == 10_000

    def test_tight_when_surplus_is_exactly_zero(self):
        result = assess([item("income", 200_000), item("expense", 200_000)])
        assert result.band == AssessmentBand.tight
        assert result.surplus_pence == 0
        assert result.surplus_ratio == 0.0

    def test_deficit_when_expense_exceeds_income(self):
        result = assess([item("income", 200_000), item("expense", 250_000)])
        assert result.band == AssessmentBand.deficit
        assert result.surplus_pence == -50_000

    def test_boundary_at_healthy_threshold_is_inclusive(self):
        # ratio == 0.10 should land in 'healthy', not 'tight'.
        income = 1_000_000
        expense = income - int(income * HEALTHY_RATIO_THRESHOLD)
        result = assess([item("income", income), item("expense", expense)])
        assert result.band == AssessmentBand.healthy

    def test_just_below_healthy_threshold_is_tight(self):
        result = assess([item("income", 1_000_000), item("expense", 900_001)])
        assert result.band == AssessmentBand.tight


class TestAggregation:
    def test_multiple_income_and_expense_items_summed_correctly(self):
        result = assess(
            [
                item("income", 280_000),
                item("income", 30_000),
                item("expense", 50_000),
                item("expense", 20_000),
                item("expense", 60_000),
            ]
        )
        assert result.total_income_pence == 310_000
        assert result.total_expenditure_pence == 130_000
        assert result.surplus_pence == 180_000

    def test_deleted_items_are_excluded(self):
        result = assess(
            [
                item("income", 200_000),
                item("expense", 150_000, is_deleted=True),
                item("expense", 50_000),
            ]
        )
        assert result.total_expenditure_pence == 50_000
        assert result.surplus_pence == 150_000


class TestExplanation:
    def test_explanation_never_empty_for_any_band(self):
        for items in [
            [],
            [item("income", 200_000), item("expense", 100_000)],
            [item("income", 200_000), item("expense", 250_000)],
            [item("income", 200_000), item("expense", 195_000)],
        ]:
            result = assess(items)
            assert result.explanation
            # No alarming language; we explicitly avoid this in copy.
            for forbidden in ("fail", "failure", "you cannot", "warning"):
                assert forbidden not in result.explanation.lower()
