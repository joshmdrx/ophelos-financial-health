"""Add currency + country_code to statements; rename amount_pence → amount_minor.

The strategy on statements is the safe one for nullable→NOT NULL:
1. Add both columns nullable.
2. Backfill existing rows (everything is GBP/GB right now).
3. Flip to NOT NULL and add the allowlist CHECK.

The line_items rename also has to drop and re-create the existing
amount-non-negative CHECK because SQLite stores the constraint expression as
text — after a column rename it would reference a column that no longer
exists. Both tables are wrapped in batch_alter_table so this works on SQLite
(table-recreate under the hood) while staying readable on other dialects.

Revision ID: 8a1c2d3e4f56
Revises: 40c4b74b154b
Create Date: 2026-05-18 21:00:00

"""
from alembic import op
import sqlalchemy as sa


revision = "8a1c2d3e4f56"
down_revision = "40c4b74b154b"
branch_labels = None
depends_on = None


CURRENCY_ALLOWLIST = ("GBP", "EUR", "USD", "AUD")
COUNTRY_ALLOWLIST = ("GB", "IE", "FR", "DE", "US", "AU")


def _in_clause(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def upgrade() -> None:
    # --- statements: add currency + country_code, backfill, NOT NULL + CHECK ---
    with op.batch_alter_table("statements") as batch_op:
        batch_op.add_column(
            sa.Column("currency", sa.String(length=3), nullable=True)
        )
        batch_op.add_column(
            sa.Column("country_code", sa.String(length=2), nullable=True)
        )

    op.execute("UPDATE statements SET currency = 'GBP' WHERE currency IS NULL")
    op.execute("UPDATE statements SET country_code = 'GB' WHERE country_code IS NULL")

    with op.batch_alter_table("statements") as batch_op:
        batch_op.alter_column(
            "currency", existing_type=sa.String(length=3), nullable=False
        )
        batch_op.alter_column(
            "country_code", existing_type=sa.String(length=2), nullable=False
        )
        batch_op.create_check_constraint(
            "ck_statements_currency",
            f"currency IN ({_in_clause(CURRENCY_ALLOWLIST)})",
        )
        batch_op.create_check_constraint(
            "ck_statements_country_code",
            f"country_code IN ({_in_clause(COUNTRY_ALLOWLIST)})",
        )

    # --- line_items: rename amount_pence → amount_minor ---
    # Drop the existing CHECK first; it references the old column name and
    # would otherwise become invalid after the rename.
    with op.batch_alter_table("line_items") as batch_op:
        batch_op.drop_constraint(
            "ck_line_items_amount_non_negative", type_="check"
        )
        batch_op.alter_column(
            "amount_pence",
            new_column_name="amount_minor",
            existing_type=sa.Integer(),
            existing_nullable=False,
        )
        batch_op.create_check_constraint(
            "ck_line_items_amount_non_negative", "amount_minor >= 0"
        )


def downgrade() -> None:
    with op.batch_alter_table("line_items") as batch_op:
        batch_op.drop_constraint(
            "ck_line_items_amount_non_negative", type_="check"
        )
        batch_op.alter_column(
            "amount_minor",
            new_column_name="amount_pence",
            existing_type=sa.Integer(),
            existing_nullable=False,
        )
        batch_op.create_check_constraint(
            "ck_line_items_amount_non_negative", "amount_pence >= 0"
        )

    with op.batch_alter_table("statements") as batch_op:
        batch_op.drop_constraint("ck_statements_currency", type_="check")
        batch_op.drop_constraint("ck_statements_country_code", type_="check")
        batch_op.drop_column("country_code")
        batch_op.drop_column("currency")
