import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


# Allowlists are duplicated as DB-level CHECK constraints. The Python enums
# in app/enums.py are the source of truth for application validation; these
# CHECKs are belt-and-braces so the DB rejects bad values even if something
# bypasses the API.
_CURRENCY_VALUES = ("'GBP'", "'EUR'", "'USD'", "'AUD'")
_COUNTRY_VALUES = ("'GB'", "'IE'", "'FR'", "'DE'", "'US'", "'AU'")


class Statement(Base):
    __tablename__ = "statements"
    __table_args__ = (
        CheckConstraint(
            f"currency IN ({', '.join(_CURRENCY_VALUES)})",
            name="ck_statements_currency",
        ),
        CheckConstraint(
            f"country_code IN ({', '.join(_COUNTRY_VALUES)})",
            name="ck_statements_country_code",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # ISO 4217 alpha currency code; immutable after creation (enforced in service).
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # ISO 3166-1 alpha-2 country code; immutable after creation.
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    line_items: Mapped[list["LineItem"]] = relationship(  # noqa: F821
        back_populates="statement",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
