from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.assessment import AssessmentResult, assess
from app.enums import Currency, LineItemType, is_valid_category
from app.models import LineItem, Statement
from app.schemas.assessment import Assessment, AssessmentNumbers, TrendPoint
from app.schemas.line_item import LineItemCreate, LineItemUpdate
from app.schemas.statement import (
    StatementCreate,
    StatementRead,
    StatementSummary,
    StatementUpdate,
)


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _touch(stmt: Statement) -> None:
    """Bump the parent statement's updated_at when a child row changes.

    SQLAlchemy's ``onupdate`` only fires when the row itself is UPDATEd;
    mutating a related collection doesn't qualify, so we set it ourselves.
    """
    stmt.updated_at = _now()


# --- helpers ---


def _assessment_payload(result: AssessmentResult, currency: str) -> Assessment:
    return Assessment(
        band=result.band,
        template_key=result.template_key,
        debt_load_band=result.debt_load_band,
        debt_load_template_key=result.debt_load_template_key,
        currency=Currency(currency),
        numbers=AssessmentNumbers(
            income_minor=result.income_minor,
            expenditure_minor=result.expenditure_minor,
            surplus_minor=result.surplus_minor,
            outstanding_debt_minor=result.outstanding_debt_minor,
            debt_to_income_monthly=result.debt_to_income_monthly,
        ),
    )


def _active_line_items(statement: Statement) -> list[LineItem]:
    return [li for li in statement.line_items if not li.is_deleted]


def _to_summary(statement: Statement) -> StatementSummary:
    return StatementSummary(
        id=statement.id,
        period_start=statement.period_start,
        period_end=statement.period_end,
        note=statement.note,
        currency=Currency(statement.currency),
        country_code=statement.country_code,
        outstanding_debt_minor=statement.outstanding_debt_minor,
        created_at=statement.created_at,
        updated_at=statement.updated_at,
        assessment=_assessment_payload(
            assess(
                _active_line_items(statement),
                outstanding_debt_minor=statement.outstanding_debt_minor,
            ),
            statement.currency,
        ),
    )


def _to_read(statement: Statement) -> StatementRead:
    summary = _to_summary(statement)
    return StatementRead(
        **summary.model_dump(),
        line_items=_active_line_items(statement),
    )


def _get_statement_or_raise(db: Session, statement_id: str) -> Statement:
    stmt = db.get(Statement, statement_id)
    if stmt is None or stmt.is_deleted:
        raise NotFoundError(f"Statement {statement_id} not found")
    return stmt


# --- public API ---


def list_statements(
    db: Session,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StatementSummary]:
    q = select(Statement).where(Statement.is_deleted.is_(False))
    if date_from is not None:
        q = q.where(Statement.period_end >= date_from)
    if date_to is not None:
        q = q.where(Statement.period_start <= date_to)
    q = q.order_by(Statement.period_end.desc(), Statement.created_at.desc())
    return [_to_summary(s) for s in db.execute(q).scalars().all()]


def get_statement(db: Session, statement_id: str) -> StatementRead:
    return _to_read(_get_statement_or_raise(db, statement_id))


def create_statement(db: Session, payload: StatementCreate) -> StatementRead:
    stmt = Statement(
        period_start=payload.period_start,
        period_end=payload.period_end,
        note=payload.note,
        currency=payload.currency.value,
        country_code=payload.country_code.value,
        outstanding_debt_minor=payload.outstanding_debt_minor,
    )
    for item in payload.line_items:
        stmt.line_items.append(
            LineItem(
                type=item.type.value,
                category=item.category.value,
                label=item.label,
                amount_minor=item.amount_minor,
            )
        )
    db.add(stmt)
    db.commit()
    db.refresh(stmt)
    return _to_read(stmt)


def update_statement(
    db: Session, statement_id: str, payload: StatementUpdate
) -> StatementRead:
    stmt = _get_statement_or_raise(db, statement_id)
    data = payload.model_dump(exclude_unset=True)

    new_start = data.get("period_start", stmt.period_start)
    new_end = data.get("period_end", stmt.period_end)
    if new_end < new_start:
        raise ValueError("period_end must be on or after period_start")

    for key, value in data.items():
        setattr(stmt, key, value)
    db.commit()
    db.refresh(stmt)
    return _to_read(stmt)


def delete_statement(db: Session, statement_id: str) -> None:
    stmt = _get_statement_or_raise(db, statement_id)
    stmt.is_deleted = True
    db.commit()


def add_line_item(
    db: Session, statement_id: str, payload: LineItemCreate
) -> StatementRead:
    stmt = _get_statement_or_raise(db, statement_id)
    stmt.line_items.append(
        LineItem(
            type=payload.type.value,
            category=payload.category.value,
            label=payload.label,
            amount_minor=payload.amount_minor,
        )
    )
    _touch(stmt)
    db.commit()
    db.refresh(stmt)
    return _to_read(stmt)


def update_line_item(
    db: Session,
    statement_id: str,
    item_id: str,
    payload: LineItemUpdate,
) -> StatementRead:
    stmt = _get_statement_or_raise(db, statement_id)
    item = next(
        (li for li in stmt.line_items if li.id == item_id and not li.is_deleted),
        None,
    )
    if item is None:
        raise NotFoundError(f"Line item {item_id} not found")

    data = payload.model_dump(exclude_unset=True)

    # Re-check type↔category consistency against the merged state — the
    # schema validator can only do this when both fields are supplied.
    effective_type = data["type"].value if "type" in data else item.type
    effective_category = (
        data["category"].value if "category" in data else item.category
    )
    if not is_valid_category(LineItemType(effective_type), effective_category):
        raise ValidationError(
            f"category '{effective_category}' is not valid for type '{effective_type}'"
        )

    if "type" in data:
        item.type = data["type"].value
    if "category" in data:
        item.category = data["category"].value
    if "label" in data:
        item.label = data["label"]
    if "amount_minor" in data:
        item.amount_minor = data["amount_minor"]

    _touch(stmt)
    db.commit()
    db.refresh(stmt)
    return _to_read(stmt)


def delete_line_item(db: Session, statement_id: str, item_id: str) -> StatementRead:
    stmt = _get_statement_or_raise(db, statement_id)
    item = next(
        (li for li in stmt.line_items if li.id == item_id and not li.is_deleted),
        None,
    )
    if item is None:
        raise NotFoundError(f"Line item {item_id} not found")
    item.is_deleted = True
    _touch(stmt)
    db.commit()
    db.refresh(stmt)
    return _to_read(stmt)


def trend(db: Session) -> list[TrendPoint]:
    q = (
        select(Statement)
        .where(Statement.is_deleted.is_(False))
        .order_by(Statement.period_end.asc())
    )
    points: list[TrendPoint] = []
    for stmt in db.execute(q).scalars().all():
        result = assess(
            _active_line_items(stmt),
            outstanding_debt_minor=stmt.outstanding_debt_minor,
        )
        points.append(
            TrendPoint(
                statement_id=stmt.id,
                period_start=stmt.period_start,
                period_end=stmt.period_end,
                currency=Currency(stmt.currency),
                band=result.band,
                income_minor=result.income_minor,
                expenditure_minor=result.expenditure_minor,
                surplus_minor=result.surplus_minor,
                debt_load_band=result.debt_load_band,
                outstanding_debt_minor=stmt.outstanding_debt_minor,
            )
        )
    return points
