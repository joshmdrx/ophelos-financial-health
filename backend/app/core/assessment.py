"""Pure assessment logic.

This module knows nothing about currency, formatting, or copy. It takes raw
amounts (already in the statement's minor unit), computes both an
affordability band (cashflow) and a debt-load band (stock), and returns the
template keys + the raw numbers. The frontend picks the wording, formats the
money, and owns the tone.

The two bands are deliberately independent — see DECISIONS.md for the
rationale. They share nothing except the income figure, which feeds the
debt-to-income ratio.
"""
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from app.enums import (
    AssessmentBand,
    AssessmentTemplateKey,
    DebtLoadBand,
    LineItemType,
)


# --- thresholds (named so they're easy to tune + document) ---

# Affordability: surplus as a fraction of income.
HEALTHY_RATIO_THRESHOLD = 0.10

# Debt-load: debt-to-monthly-income (DTI_m) bands.
#  - ``manageable`` up to and including 6× monthly income
#  - ``heavy``       up to and including 12×
#  - ``severe``      above 12×
DTI_MANAGEABLE_MAX = 6.0
DTI_HEAVY_MAX = 12.0


# --- result type ---


@dataclass(frozen=True)
class AssessmentResult:
    # Affordability (cashflow) ---
    band: AssessmentBand
    template_key: AssessmentTemplateKey
    income_minor: int
    expenditure_minor: int
    surplus_minor: int  # signed; negative = deficit

    # Debt load (stock) ---
    debt_load_band: DebtLoadBand
    debt_load_template_key: AssessmentTemplateKey
    outstanding_debt_minor: int | None
    # DTI in months of income. None when income == 0 or balance missing.
    debt_to_income_monthly: float | None


# --- helpers (tolerant of dicts + ORM rows so tests stay easy to write) ---


def _amount(item: Any) -> int:
    return item["amount_minor"] if isinstance(item, dict) else item.amount_minor


def _type(item: Any) -> str:
    return item["type"] if isinstance(item, dict) else item.type


def _is_deleted(item: Any) -> bool:
    if isinstance(item, dict):
        return item.get("is_deleted", False)
    return getattr(item, "is_deleted", False)


# --- band computations (pure) ---


def _affordability_band(
    income: int, expenditure: int, item_count: int
) -> tuple[AssessmentBand, AssessmentTemplateKey]:
    # No-data and no-income alike fall into 'insufficient_data'. We
    # deliberately do *not* flag a user with no recorded income as 'deficit'
    # — that framing is harmful in a vulnerable-customer context.
    if item_count == 0 or income == 0:
        return (
            AssessmentBand.insufficient_data,
            AssessmentTemplateKey.insufficient_data_default,
        )

    surplus = income - expenditure
    ratio = surplus / income

    if surplus < 0:
        return AssessmentBand.deficit, AssessmentTemplateKey.deficit_default
    if ratio >= HEALTHY_RATIO_THRESHOLD:
        return AssessmentBand.healthy, AssessmentTemplateKey.healthy_default
    return AssessmentBand.tight, AssessmentTemplateKey.tight_default


def _debt_load_band(
    income: int, outstanding_debt_minor: int | None
) -> tuple[DebtLoadBand, AssessmentTemplateKey, float | None]:
    """Map (income, debt balance) → debt-load band + template key + DTI.

    Decision tree, in order:
      1. balance == 0          → debt_free (DTI = 0)
      2. balance is None       → insufficient_data
      3. income == 0           → insufficient_data (DTI undefined)
      4. otherwise compute DTI and bucket
    """
    if outstanding_debt_minor == 0:
        return (
            DebtLoadBand.debt_free,
            AssessmentTemplateKey.debt_free_default,
            0.0,
        )

    if outstanding_debt_minor is None or income == 0:
        return (
            DebtLoadBand.insufficient_data,
            AssessmentTemplateKey.debt_insufficient_data_default,
            None,
        )

    dti = outstanding_debt_minor / income

    if dti <= DTI_MANAGEABLE_MAX:
        return (
            DebtLoadBand.manageable,
            AssessmentTemplateKey.debt_manageable_default,
            dti,
        )
    if dti <= DTI_HEAVY_MAX:
        return (
            DebtLoadBand.heavy,
            AssessmentTemplateKey.debt_heavy_default,
            dti,
        )
    return (
        DebtLoadBand.severe,
        AssessmentTemplateKey.debt_severe_default,
        dti,
    )


# --- public ---


def assess(
    line_items: Iterable[Any],
    outstanding_debt_minor: int | None = None,
) -> AssessmentResult:
    income = 0
    expenditure = 0
    item_count = 0

    for item in line_items:
        if _is_deleted(item):
            continue
        item_count += 1
        amount = _amount(item)
        if _type(item) == LineItemType.income.value:
            income += amount
        else:
            expenditure += amount

    surplus = income - expenditure

    band, template_key = _affordability_band(income, expenditure, item_count)
    debt_band, debt_template, dti = _debt_load_band(income, outstanding_debt_minor)

    return AssessmentResult(
        band=band,
        template_key=template_key,
        income_minor=income,
        expenditure_minor=expenditure,
        surplus_minor=surplus,
        debt_load_band=debt_band,
        debt_load_template_key=debt_template,
        outstanding_debt_minor=outstanding_debt_minor,
        debt_to_income_monthly=dti,
    )
