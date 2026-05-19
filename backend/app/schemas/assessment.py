from datetime import date

from pydantic import BaseModel

from app.enums import (
    AssessmentBand,
    AssessmentTemplateKey,
    Currency,
    DebtLoadBand,
)


class AssessmentNumbers(BaseModel):
    income_minor: int
    expenditure_minor: int
    # Signed: negative for deficit. Lets the frontend pick between "surplus"
    # and "shortfall" wording without the server branching on band.
    surplus_minor: int
    # Echoed from the statement so the frontend can render the debt panel
    # without an extra lookup. None = balance not recorded.
    outstanding_debt_minor: int | None = None
    # Debt-to-monthly-income ratio (months of income). None when the ratio is
    # undefined (no balance, or no income).
    debt_to_income_monthly: float | None = None


class Assessment(BaseModel):
    # Affordability (cashflow).
    band: AssessmentBand
    template_key: AssessmentTemplateKey
    # Debt load (stock). Independent signal — surfaced alongside, not folded
    # into ``band``.
    debt_load_band: DebtLoadBand
    debt_load_template_key: AssessmentTemplateKey

    currency: Currency
    numbers: AssessmentNumbers


class TrendPoint(BaseModel):
    statement_id: str
    period_start: date
    period_end: date
    currency: Currency
    band: AssessmentBand
    income_minor: int
    expenditure_minor: int
    surplus_minor: int
    # New: lets the chart optionally render the debt curve. None for
    # statements with no recorded balance — frontend renders a gap, not a
    # zero (which would lie).
    debt_load_band: DebtLoadBand
    outstanding_debt_minor: int | None = None
