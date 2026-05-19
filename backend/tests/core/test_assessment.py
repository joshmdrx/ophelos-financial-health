"""Assessment rules are the load-bearing logic.

The assessment module is deliberately copy-free now — it returns a template
key plus raw numbers, and the frontend handles wording and currency
formatting. These tests pin the band thresholds and the template-key mapping;
the "no alarming language" check moved to the frontend copy bundle (which is
where the strings now live).
"""
from app.core.assessment import (
    DTI_HEAVY_MAX,
    DTI_MANAGEABLE_MAX,
    HEALTHY_RATIO_THRESHOLD,
    assess,
)
from app.enums import AssessmentBand, AssessmentTemplateKey, DebtLoadBand


def item(type_: str, amount: int, *, is_deleted: bool = False, category: str | None = None) -> dict:
    return {
        "type": type_,
        "amount_minor": amount,
        "is_deleted": is_deleted,
        "category": category or ("salary" if type_ == "income" else "other"),
    }


class TestInsufficientData:
    def test_no_items_at_all(self):
        result = assess([])
        assert result.band == AssessmentBand.insufficient_data
        assert result.template_key == AssessmentTemplateKey.insufficient_data_default
        assert result.income_minor == 0
        assert result.expenditure_minor == 0
        assert result.surplus_minor == 0

    def test_only_expenses_no_income(self):
        # A user with no recorded income should not be flagged as 'deficit'.
        # That framing is harmful in the FCA / vulnerable-customer context.
        result = assess([item("expense", 50_000), item("expense", 20_000)])
        assert result.band == AssessmentBand.insufficient_data
        assert result.template_key == AssessmentTemplateKey.insufficient_data_default

    def test_only_deleted_items(self):
        result = assess([item("income", 100_000, is_deleted=True)])
        assert result.band == AssessmentBand.insufficient_data

    def test_zero_income_with_zero_expense(self):
        result = assess([item("income", 0), item("expense", 0)])
        assert result.band == AssessmentBand.insufficient_data


class TestBands:
    def test_healthy_when_surplus_ratio_above_threshold(self):
        result = assess([item("income", 200_000), item("expense", 150_000)])
        assert result.band == AssessmentBand.healthy
        assert result.template_key == AssessmentTemplateKey.healthy_default
        assert result.surplus_minor == 50_000

    def test_tight_when_small_positive_surplus(self):
        result = assess([item("income", 200_000), item("expense", 190_000)])
        assert result.band == AssessmentBand.tight
        assert result.template_key == AssessmentTemplateKey.tight_default
        assert result.surplus_minor == 10_000

    def test_tight_when_surplus_is_exactly_zero(self):
        result = assess([item("income", 200_000), item("expense", 200_000)])
        assert result.band == AssessmentBand.tight
        assert result.surplus_minor == 0

    def test_deficit_when_expense_exceeds_income(self):
        result = assess([item("income", 200_000), item("expense", 250_000)])
        assert result.band == AssessmentBand.deficit
        assert result.template_key == AssessmentTemplateKey.deficit_default
        # Surplus is signed — frontend reads sign to pick "surplus" vs
        # "shortfall" copy.
        assert result.surplus_minor == -50_000

    def test_boundary_at_healthy_threshold_is_inclusive(self):
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
        assert result.income_minor == 310_000
        assert result.expenditure_minor == 130_000
        assert result.surplus_minor == 180_000

    def test_deleted_items_are_excluded(self):
        result = assess(
            [
                item("income", 200_000),
                item("expense", 150_000, is_deleted=True),
                item("expense", 50_000),
            ]
        )
        assert result.expenditure_minor == 50_000
        assert result.surplus_minor == 150_000


class TestPayloadShape:
    """The dataclass shape itself is part of the contract — service code
    builds the API response straight from these fields."""

    def test_result_contains_only_keys_and_numbers_no_copy(self):
        result = assess([item("income", 100_000), item("expense", 50_000)])
        # Numbers carry no currency — that lives on the statement, not in the
        # assessment itself. Copy strings have been removed.
        assert not hasattr(result, "explanation")
        assert not hasattr(result, "currency")
        assert isinstance(result.surplus_minor, int)


# ---------- debt load ----------


class TestDebtLoadBand:
    """Debt-load is independent of affordability — the band depends only on
    income and outstanding balance (a *stock*, not a flow). Tests cover
    every transition and edge case.
    """

    def test_no_balance_recorded_is_insufficient_data(self):
        result = assess(
            [item("income", 200_000), item("expense", 100_000)],
            outstanding_debt_minor=None,
        )
        assert result.debt_load_band == DebtLoadBand.insufficient_data
        assert (
            result.debt_load_template_key
            == AssessmentTemplateKey.debt_insufficient_data_default
        )
        assert result.debt_to_income_monthly is None
        assert result.outstanding_debt_minor is None

    def test_zero_balance_is_debt_free_not_insufficient_data(self):
        # 0 is a meaningful answer — "debt-free" — and must be distinct from
        # "not recorded". This is the FCA-friendly outcome we want to
        # celebrate explicitly.
        result = assess(
            [item("income", 200_000), item("expense", 100_000)],
            outstanding_debt_minor=0,
        )
        assert result.debt_load_band == DebtLoadBand.debt_free
        assert result.debt_load_template_key == AssessmentTemplateKey.debt_free_default
        assert result.debt_to_income_monthly == 0.0

    def test_balance_with_zero_income_is_insufficient_data(self):
        # DTI is undefined when income is 0 — we can't say how heavy the
        # debt is without a denominator. Surfacing this as 'insufficient'
        # keeps the UI quiet rather than misleading.
        result = assess(
            [item("expense", 200_000)],
            outstanding_debt_minor=500_000,
        )
        assert result.debt_load_band == DebtLoadBand.insufficient_data
        assert result.debt_to_income_monthly is None

    def test_manageable_band(self):
        # DTI = 3 — comfortably inside the manageable band.
        result = assess(
            [item("income", 200_000), item("expense", 100_000)],
            outstanding_debt_minor=600_000,
        )
        assert result.debt_load_band == DebtLoadBand.manageable
        assert result.debt_to_income_monthly == 3.0

    def test_heavy_band(self):
        # DTI = 9 — inside the heavy band.
        result = assess(
            [item("income", 100_000), item("expense", 50_000)],
            outstanding_debt_minor=900_000,
        )
        assert result.debt_load_band == DebtLoadBand.heavy
        assert result.debt_to_income_monthly == 9.0

    def test_severe_band(self):
        # DTI = 20 — well above the heavy threshold.
        result = assess(
            [item("income", 100_000), item("expense", 50_000)],
            outstanding_debt_minor=2_000_000,
        )
        assert result.debt_load_band == DebtLoadBand.severe
        assert result.debt_to_income_monthly == 20.0


class TestDebtLoadBoundaries:
    """Pin the exact thresholds so a tune-up of the constants is visible
    in a diff."""

    def test_exactly_6x_is_manageable(self):
        income = 100_000
        result = assess(
            [item("income", income), item("expense", 50_000)],
            outstanding_debt_minor=int(income * DTI_MANAGEABLE_MAX),
        )
        assert result.debt_load_band == DebtLoadBand.manageable

    def test_just_above_6x_is_heavy(self):
        income = 100_000
        result = assess(
            [item("income", income), item("expense", 50_000)],
            outstanding_debt_minor=int(income * DTI_MANAGEABLE_MAX) + 1,
        )
        assert result.debt_load_band == DebtLoadBand.heavy

    def test_exactly_12x_is_heavy(self):
        income = 100_000
        result = assess(
            [item("income", income), item("expense", 50_000)],
            outstanding_debt_minor=int(income * DTI_HEAVY_MAX),
        )
        assert result.debt_load_band == DebtLoadBand.heavy

    def test_just_above_12x_is_severe(self):
        income = 100_000
        result = assess(
            [item("income", income), item("expense", 50_000)],
            outstanding_debt_minor=int(income * DTI_HEAVY_MAX) + 1,
        )
        assert result.debt_load_band == DebtLoadBand.severe


class TestBandsAreIndependent:
    """Affordability and debt-load are two signals. Neither should leak into
    the other — these tests pin the independence by mixing combinations.
    """

    def test_healthy_affordability_with_severe_debt(self):
        result = assess(
            [item("income", 200_000), item("expense", 100_000)],
            outstanding_debt_minor=5_000_000,  # 25x
        )
        assert result.band == AssessmentBand.healthy
        assert result.debt_load_band == DebtLoadBand.severe

    def test_deficit_affordability_with_debt_free(self):
        # User overspent this month but has no outstanding debt — possible
        # when someone draws down savings. Each signal stands alone.
        result = assess(
            [item("income", 100_000), item("expense", 150_000)],
            outstanding_debt_minor=0,
        )
        assert result.band == AssessmentBand.deficit
        assert result.debt_load_band == DebtLoadBand.debt_free

    def test_insufficient_affordability_with_no_balance(self):
        # Both sides have nothing to say. The combined UI shows two empty
        # states rather than fabricating either.
        result = assess([], outstanding_debt_minor=None)
        assert result.band == AssessmentBand.insufficient_data
        assert result.debt_load_band == DebtLoadBand.insufficient_data


class TestDebtBackwardCompatibility:
    """``outstanding_debt_minor`` is optional — callers that ignore the new
    argument get the same affordability result as before, with a debt band
    of ``insufficient_data``. Important because every service-layer caller
    has to be migrated incrementally."""

    def test_omitted_balance_defaults_to_insufficient_data(self):
        result = assess([item("income", 200_000), item("expense", 100_000)])
        assert result.band == AssessmentBand.healthy  # unchanged
        assert result.debt_load_band == DebtLoadBand.insufficient_data
        assert result.outstanding_debt_minor is None
