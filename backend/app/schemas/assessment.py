from datetime import date

from pydantic import BaseModel

from app.enums import AssessmentBand


class Assessment(BaseModel):
    band: AssessmentBand
    total_income_pence: int
    total_expenditure_pence: int
    surplus_pence: int
    surplus_ratio: float | None
    explanation: str


class TrendPoint(BaseModel):
    statement_id: str
    period_start: date
    period_end: date
    band: AssessmentBand
    total_income_pence: int
    total_expenditure_pence: int
    surplus_pence: int
