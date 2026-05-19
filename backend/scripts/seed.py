"""Seed the dev database with a few months of plausible statements.

The seed deliberately covers every debt-load band across four months so the
UI exercises each visual treatment without manual data entry. The narrative
arc is "customer paying down debt month-on-month":

    Jan  income £3,100, balance £62,000  → DTI ≈ 20  → severe
    Feb  income £2,800, balance £25,200  → DTI ≈ 9   → heavy
    Mar  income £3,200, balance  £9,600  → DTI = 3   → manageable
    Apr  income £3,300, balance      £0  →           → debt_free

NULL ("not recorded") is intentionally *not* seeded — it's the path a new
user takes through the UI when they create their first statement.

Idempotent: clears non-deleted rows first so it can be re-run freely.

    uv run python scripts/seed.py
"""
from datetime import date

from sqlalchemy import delete

from app.db import SessionLocal
from app.models import LineItem, Statement


SEED_DATA = [
    # (period_start, period_end, outstanding_debt_minor, [(type, category, label, amount_minor), ...])
    (
        date(2026, 1, 1),
        date(2026, 1, 31),
        6_200_000,  # ≈20× income → severe
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
        2_520_000,  # ≈9× income → heavy
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
        960_000,  # 3× income → manageable
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
        0,  # debt-free
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

        for period_start, period_end, debt_minor, items in SEED_DATA:
            stmt = Statement(
                period_start=period_start,
                period_end=period_end,
                currency="GBP",
                country_code="GB",
                outstanding_debt_minor=debt_minor,
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

    print(f"Seeded {len(SEED_DATA)} statements.")


if __name__ == "__main__":
    main()
