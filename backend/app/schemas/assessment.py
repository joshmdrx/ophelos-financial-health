from datetime import date

from pydantic import BaseModel

from app.enums import AssessmentBand, AssessmentTemplateKey, Currency


class AssessmentNumbers(BaseModel):
    income_minor: int
    expenditure_minor: int
    # Signed: negative for deficit. Lets the frontend pick between "surplus"
    # and "shortfall" wording without the server branching on band.
    surplus_minor: int


class Assessment(BaseModel):
    band: AssessmentBand
    template_key: AssessmentTemplateKey
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
