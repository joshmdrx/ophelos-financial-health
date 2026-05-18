"""Seed the dev database with a few months of plausible statements.

Idempotent: clears non-deleted rows first so it can be re-run freely.

    uv run python scripts/seed.py
"""
from datetime import date

from sqlalchemy import delete

from app.db import SessionLocal
from app.models import LineItem, Statement


SEED_DATA = [
    # (period_start, period_end, [(type, category, label, pence), ...])
    (
        date(2026, 1, 1),
        date(2026, 1, 31),
        [
            ("income", "salary", "Salary", 280_000),
            ("income", "other", "Side work", 30_000),
            ("expense", "housing", "Rent", 50_000),
            ("expense", "utilities", "Energy + water", 12_000),
            ("expense", "food", "Groceries", 50_000),
            ("expense", "transport", "Travel", 15_000),
            ("expense", "debt_repayments", "Card", 100_000),
        ],
    ),
    (
        date(2026, 2, 1),
        date(2026, 2, 28),
        [
            ("income", "salary", "Salary", 280_000),
            ("expense", "housing", "Rent", 50_000),
            ("expense", "utilities", "Energy + water", 14_000),
            ("expense", "food", "Groceries", 60_000),
            ("expense", "transport", "Travel", 17_000),
            ("expense", "debt_repayments", "Card", 100_000),
            ("expense", "other", "Vet bill", 25_000),
        ],
    ),
    (
        date(2026, 3, 1),
        date(2026, 3, 31),
        [
            ("income", "salary", "Salary", 280_000),
            ("income", "benefits", "Universal Credit", 40_000),
            ("expense", "housing", "Rent", 50_000),
            ("expense", "utilities", "Energy + water", 10_000),
            ("expense", "food", "Groceries", 48_000),
            ("expense", "transport", "Travel", 14_000),
            ("expense", "debt_repayments", "Card", 80_000),
        ],
    ),
    (
        date(2026, 4, 1),
        date(2026, 4, 30),
        [
            ("income", "salary", "Salary", 290_000),
            ("income", "benefits", "Universal Credit", 40_000),
            ("expense", "housing", "Rent", 50_000),
            ("expense", "utilities", "Energy + water", 9_000),
            ("expense", "food", "Groceries", 46_000),
            ("expense", "transport", "Travel", 13_000),
            ("expense", "debt_repayments", "Card", 80_000),
        ],
    ),
]


def main() -> None:
    with SessionLocal() as db:
        db.execute(delete(LineItem))
        db.execute(delete(Statement))
        db.commit()

        for period_start, period_end, items in SEED_DATA:
            stmt = Statement(period_start=period_start, period_end=period_end)
            for type_, category, label, amount in items:
                stmt.line_items.append(
                    LineItem(
                        type=type_,
                        category=category,
                        label=label,
                        amount_pence=amount,
                    )
                )
            db.add(stmt)
        db.commit()

    print(f"Seeded {len(SEED_DATA)} statements.")


if __name__ == "__main__":
    main()
