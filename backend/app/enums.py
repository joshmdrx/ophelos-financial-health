from enum import Enum


class LineItemType(str, Enum):
    income = "income"
    expense = "expense"


class IncomeCategory(str, Enum):
    salary = "salary"
    benefits = "benefits"
    pension = "pension"
    other = "other"


class ExpenseCategory(str, Enum):
    housing = "housing"
    utilities = "utilities"
    food = "food"
    transport = "transport"
    debt_repayments = "debt_repayments"
    childcare = "childcare"
    insurance = "insurance"
    other = "other"


class AssessmentBand(str, Enum):
    healthy = "healthy"
    tight = "tight"
    deficit = "deficit"
    insufficient_data = "insufficient_data"


CATEGORIES_BY_TYPE: dict[LineItemType, set[str]] = {
    LineItemType.income: {c.value for c in IncomeCategory},
    LineItemType.expense: {c.value for c in ExpenseCategory},
}


def is_valid_category(item_type: LineItemType, category: str) -> bool:
    return category in CATEGORIES_BY_TYPE[item_type]
