"""Test fixtures.

- ``db``: per-test in-memory SQLite session, schema freshly created.
- ``client``: FastAPI TestClient with the DB dependency overridden.
- ``seed_statement``: factory that inserts a Statement directly via the DB,
  bypassing the API. Use it when the test cares about *what happens to*
  a statement, not the creation contract.
"""
from collections.abc import Iterator
from datetime import date
from typing import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import LineItem, Statement


# A handful of small helpers — referenced from multiple tests, so live here
# rather than getting redefined in each module.

DEFAULT_INCOME = [("income", "salary", "Salary", 280_000)]
DEFAULT_EXPENSES = [
    ("expense", "housing", "Rent", 50_000),
    ("expense", "food", "Groceries", 50_000),
]
DEFAULT_CURRENCY = "GBP"
DEFAULT_COUNTRY = "GB"


@pytest.fixture()
def db() -> Iterator[Session]:
    # StaticPool + a single shared connection so every session sees the same
    # in-memory DB. Without this the DB vanishes between connections.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    def _override_get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


SeedStatement = Callable[..., Statement]


@pytest.fixture()
def seed_statement(db: Session) -> SeedStatement:
    """Insert a Statement + line items straight into the DB.

    Usage:
        stmt = seed_statement()                       # healthy default
        stmt = seed_statement(items=[("income", "salary", None, 200_000)])
        stmt = seed_statement(period_start=date(2026, 1, 1),
                              period_end=date(2026, 1, 31))
    """

    def _seed(
        *,
        period_start: date = date(2026, 4, 1),
        period_end: date = date(2026, 4, 30),
        note: str | None = None,
        currency: str = DEFAULT_CURRENCY,
        country_code: str = DEFAULT_COUNTRY,
        outstanding_debt_minor: int | None = None,
        items: list[tuple[str, str, str | None, int]] | None = None,
    ) -> Statement:
        if items is None:
            items = DEFAULT_INCOME + DEFAULT_EXPENSES

        stmt = Statement(
            period_start=period_start,
            period_end=period_end,
            note=note,
            currency=currency,
            country_code=country_code,
            outstanding_debt_minor=outstanding_debt_minor,
        )
        for type_, category, label, amount in items:
            stmt.line_items.append(
                LineItem(
                    type=type_,
                    category=category,
                    label=label,
                    amount_minor=amount,
                )
            )
        db.add(stmt)
        db.commit()
        db.refresh(stmt)
        return stmt

    return _seed
