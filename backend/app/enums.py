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


class DebtLoadBand(str, Enum):
    """How heavy is the customer's outstanding balance relative to their
    monthly income? Independent of the affordability (cashflow) band.

    Mapping uses debt-to-monthly-income (DTI_m):
      - ≤ 0           → ``debt_free``
      - ≤ 6×          → ``manageable``
      - ≤ 12×         → ``heavy``
      - > 12×         → ``severe``
      - missing data  → ``insufficient_data``
    """

    debt_free = "debt_free"
    manageable = "manageable"
    heavy = "heavy"
    severe = "severe"
    insufficient_data = "insufficient_data"


# Currency + country allowlists. Kept deliberately small.
#
# All currencies in this allowlist have a 2-digit minor unit (pence, cents),
# so the conversion factor from minor → major is uniformly 100. If we ever add
# JPY/KRW (0 digits) or BHD/JOD (3 digits) we'll need a per-currency factor
# map both server-side and in the frontend formatter.

class Currency(str, Enum):
    GBP = "GBP"
    EUR = "EUR"
    USD = "USD"
    AUD = "AUD"


class CountryCode(str, Enum):
    GB = "GB"
    IE = "IE"
    FR = "FR"
    DE = "DE"
    US = "US"
    AU = "AU"


# Template keys for assessment copy. Backend returns the key + the numbers;
# frontend owns the rendered string and tone. The ``_default`` suffix leaves
# room for variants later (e.g. ``deficit_first_time``) without renames.
class AssessmentTemplateKey(str, Enum):
    # Affordability (cashflow) bands.
    healthy_default = "healthy_default"
    tight_default = "tight_default"
    deficit_default = "deficit_default"
    insufficient_data_default = "insufficient_data_default"
    # Debt-load bands.
    debt_free_default = "debt_free_default"
    debt_manageable_default = "debt_manageable_default"
    debt_heavy_default = "debt_heavy_default"
    debt_severe_default = "debt_severe_default"
    debt_insufficient_data_default = "debt_insufficient_data_default"


CATEGORIES_BY_TYPE: dict[LineItemType, set[str]] = {
    LineItemType.income: {c.value for c in IncomeCategory},
    LineItemType.expense: {c.value for c in ExpenseCategory},
}


def is_valid_category(item_type: LineItemType, category: str) -> bool:
    return category in CATEGORIES_BY_TYPE[item_type]
