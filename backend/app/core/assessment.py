"""Pure assessment logic.

This module knows nothing about currency, formatting, or copy. It takes raw
amounts (already in the statement's minor unit), computes a band, and returns a
template key plus the raw numbers. The frontend picks the wording, formats the
money, and owns the tone.
"""
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from app.enums import AssessmentBand, AssessmentTemplateKey, LineItemType


HEALTHY_RATIO_THRESHOLD = 0.10


@dataclass(frozen=True)
class AssessmentResult:
    band: AssessmentBand
    template_key: AssessmentTemplateKey
    income_minor: int
    expenditure_minor: int
    # Signed: negative for deficit.
    surplus_minor: int


def _amount(item: Any) -> int:
    return item["amount_minor"] if isinstance(item, dict) else item.amount_minor


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

    surplus = income - expenditure

    # No-data and no-income alike fall into 'insufficient_data'. We deliberately
    # do *not* flag a user with no recorded income as 'deficit' — that framing
    # is harmful in a vulnerable-customer context, and we'd rather prompt them
    # to add income than label them.
    if item_count == 0 or income == 0:
        return AssessmentResult(
            band=AssessmentBand.insufficient_data,
            template_key=AssessmentTemplateKey.insufficient_data_default,
            income_minor=income,
            expenditure_minor=expenditure,
            surplus_minor=surplus,
        )

    ratio = surplus / income

    if surplus < 0:
        band = AssessmentBand.deficit
        template_key = AssessmentTemplateKey.deficit_default
    elif ratio >= HEALTHY_RATIO_THRESHOLD:
        band = AssessmentBand.healthy
        template_key = AssessmentTemplateKey.healthy_default
    else:
        band = AssessmentBand.tight
        template_key = AssessmentTemplateKey.tight_default

    return AssessmentResult(
        band=band,
        template_key=template_key,
        income_minor=income,
        expenditure_minor=expenditure,
        surplus_minor=surplus,
    )
