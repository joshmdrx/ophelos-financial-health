from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.assessment import TrendPoint
from app.schemas.line_item import LineItemCreate, LineItemUpdate
from app.schemas.statement import (
    StatementCreate,
    StatementRead,
    StatementSummary,
    StatementUpdate,
)
from app.services import statements as service


router = APIRouter()


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


@router.get(
    "/statements",
    response_model=list[StatementSummary],
    tags=["statements"],
    operation_id="listStatements",
)
def list_statements(
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> list[StatementSummary]:
    return service.list_statements(db, date_from=date_from, date_to=date_to)


@router.post(
    "/statements",
    response_model=StatementRead,
    status_code=status.HTTP_201_CREATED,
    tags=["statements"],
    operation_id="createStatement",
)
def create_statement(
    payload: StatementCreate, db: Session = Depends(get_db)
) -> StatementRead:
    return service.create_statement(db, payload)


@router.get(
    "/statements/{statement_id}",
    response_model=StatementRead,
    tags=["statements"],
    operation_id="getStatement",
)
def get_statement(statement_id: str, db: Session = Depends(get_db)) -> StatementRead:
    try:
        return service.get_statement(db, statement_id)
    except service.NotFoundError as e:
        raise _not_found(str(e)) from e


@router.patch(
    "/statements/{statement_id}",
    response_model=StatementRead,
    tags=["statements"],
    operation_id="updateStatement",
)
def update_statement(
    statement_id: str,
    payload: StatementUpdate,
    db: Session = Depends(get_db),
) -> StatementRead:
    try:
        return service.update_statement(db, statement_id, payload)
    except service.NotFoundError as e:
        raise _not_found(str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.delete(
    "/statements/{statement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["statements"],
    operation_id="deleteStatement",
)
def delete_statement(statement_id: str, db: Session = Depends(get_db)) -> Response:
    try:
        service.delete_statement(db, statement_id)
    except service.NotFoundError as e:
        raise _not_found(str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/statements/{statement_id}/line-items",
    response_model=StatementRead,
    status_code=status.HTTP_201_CREATED,
    tags=["line-items"],
    operation_id="addLineItem",
)
def add_line_item(
    statement_id: str,
    payload: LineItemCreate,
    db: Session = Depends(get_db),
) -> StatementRead:
    try:
        return service.add_line_item(db, statement_id, payload)
    except service.NotFoundError as e:
        raise _not_found(str(e)) from e


@router.patch(
    "/statements/{statement_id}/line-items/{item_id}",
    response_model=StatementRead,
    tags=["line-items"],
    operation_id="updateLineItem",
)
def update_line_item(
    statement_id: str,
    item_id: str,
    payload: LineItemUpdate,
    db: Session = Depends(get_db),
) -> StatementRead:
    try:
        return service.update_line_item(db, statement_id, item_id, payload)
    except service.NotFoundError as e:
        raise _not_found(str(e)) from e
    except service.ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.delete(
    "/statements/{statement_id}/line-items/{item_id}",
    response_model=StatementRead,
    tags=["line-items"],
    operation_id="deleteLineItem",
)
def delete_line_item(
    statement_id: str,
    item_id: str,
    db: Session = Depends(get_db),
) -> StatementRead:
    try:
        return service.delete_line_item(db, statement_id, item_id)
    except service.NotFoundError as e:
        raise _not_found(str(e)) from e


@router.get(
    "/trend",
    response_model=list[TrendPoint],
    tags=["trend"],
    operation_id="getTrend",
)
def get_trend(db: Session = Depends(get_db)) -> list[TrendPoint]:
    return service.trend(db)
