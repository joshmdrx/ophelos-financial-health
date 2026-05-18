from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.enums import CountryCode, Currency
from app.schemas.assessment import Assessment
from app.schemas.line_item import LineItemCreate, LineItemRead


class StatementBase(BaseModel):
    period_start: date
    period_end: date
    note: str | None = Field(default=None, max_length=1000)
    currency: Currency
    country_code: CountryCode

    @model_validator(mode="after")
    def _period_end_after_start(self):
        if self.period_end < self.period_start:
            raise ValueError("period_end must be on or after period_start")
        return self


class StatementCreate(StatementBase):
    line_items: list[LineItemCreate] = Field(default_factory=list)


class StatementUpdate(BaseModel):
    # Currency and country are intentionally absent — they're immutable after
    # creation. Pydantic rejects unknown fields with this config, so a client
    # sending currency/country here gets a clear 422 rather than a silent drop.
    model_config = ConfigDict(extra="forbid")

    period_start: date | None = None
    period_end: date | None = None
    note: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _period_end_after_start(self):
        if (
            self.period_start is not None
            and self.period_end is not None
            and self.period_end < self.period_start
        ):
            raise ValueError("period_end must be on or after period_start")
        return self


class StatementSummary(BaseModel):
    """Lightweight statement representation for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    period_start: date
    period_end: date
    note: str | None
    currency: Currency
    country_code: CountryCode
    created_at: datetime
    updated_at: datetime
    assessment: Assessment


class StatementRead(StatementSummary):
    line_items: list[LineItemRead]
