"""Add outstanding_debt_minor to statements.

Nullable on purpose: NULL means "balance not recorded" — distinct from 0,
which means "debt-free". The two are different signals for the assessment.

A CHECK constraint enforces non-negative balances at the DB level. The
application Pydantic schema enforces the same rule (``ge=0``); the CHECK is
belt-and-braces.

Wrapped in ``batch_alter_table`` so SQLite handles the column add via a
table-recreate (needed for CHECK constraints on new columns).

Revision ID: 903dfbe1ff5b
Revises: 8a1c2d3e4f56
Create Date: 2026-05-19 11:16:34.752676

"""
from alembic import op
import sqlalchemy as sa


revision = "903dfbe1ff5b"
down_revision = "8a1c2d3e4f56"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("statements") as batch:
        batch.add_column(
            sa.Column("outstanding_debt_minor", sa.Integer(), nullable=True)
        )
        batch.create_check_constraint(
            "ck_statements_outstanding_debt_non_negative",
            "outstanding_debt_minor IS NULL OR outstanding_debt_minor >= 0",
        )


def downgrade() -> None:
    with op.batch_alter_table("statements") as batch:
        batch.drop_constraint(
            "ck_statements_outstanding_debt_non_negative", type_="check"
        )
        batch.drop_column("outstanding_debt_minor")
