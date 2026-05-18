"""Pure assessment logic. No DB, no FastAPI — easy to unit-test.

A line item, for these purposes, is anything with `type`, `amount_pence`, and an
`is_deleted` flag. We accept both ORM rows and plain dicts so the function is
reusable from tests, scripts, and services.
"""
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from app.enums import AssessmentBand, LineItemType


HEALTHY_RATIO_THRESHOLD = 0.10


@dataclass(frozen=True)
class AssessmentResult:
    band: AssessmentBand
    total_income_pence: int
    total_expenditure_pence: int
    surplus_pence: int
    surplus_ratio: float | None
    explanation: str


def _amount(item: Any) -> int:
    return item["amount_pence"] if isinstance(item, dict) else item.amount_pence


def _type(item: Any) -> str:
    return item["type"] if isinstance(item, dict) else item.type


def _is_deleted(item: Any) -> bool:
    if isinstance(item, dict):
        return item.get("is_deleted", False)
    return getattr(item, "is_deleted", False)


def assess(line_items: Iterable[Any]) -> AssessmentResult:
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

    if item_count == 0 or income == 0:
        return AssessmentResult(
            band=AssessmentBand.insufficient_data,
            total_income_pence=income,
            total_expenditure_pence=expenditure,
            surplus_pence=income - expenditure,
            surplus_ratio=None,
            explanation=(
                "We don't have enough information yet to show a full picture. "
                "Add your income and regular outgoings to get started."
            ),
        )

    surplus = income - expenditure
    ratio = surplus / income

    if surplus < 0:
        band = AssessmentBand.deficit
        explanation = (
            f"Your outgoings are about £{abs(surplus) / 100:,.2f} more than your income this period. "
            "Small adjustments can make a real difference — let's look at where it might help most."
        )
    elif ratio >= HEALTHY_RATIO_THRESHOLD:
        band = AssessmentBand.healthy
        explanation = (
            f"You have around £{surplus / 100:,.2f} left over after your outgoings — "
            "that's a healthy margin. Keep it up."
        )
    else:
        band = AssessmentBand.tight
        explanation = (
            f"Your income just covers your outgoings, with about £{surplus / 100:,.2f} left over. "
            "It's tight but manageable — a small change either way can shift the picture."
        )

    return AssessmentResult(
        band=band,
        total_income_pence=income,
        total_expenditure_pence=expenditure,
        surplus_pence=surplus,
        surplus_ratio=ratio,
        explanation=explanation,
    )
