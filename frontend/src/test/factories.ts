import type {
  Assessment,
  AssessmentBand,
  LineItemRead,
  StatementRead,
  StatementSummary,
  TrendPoint,
} from "@/api";

let counter = 0;
const nextId = () => `test-${++counter}`;

const ASSESSMENT_DEFAULTS: Record<AssessmentBand, Partial<Assessment>> = {
  healthy: {
    total_income_pence: 300_000,
    total_expenditure_pence: 200_000,
    surplus_pence: 100_000,
    surplus_ratio: 0.333,
    explanation:
      "You have around £1,000.00 left over after your outgoings — that's a healthy margin. Keep it up.",
  },
  tight: {
    total_income_pence: 200_000,
    total_expenditure_pence: 195_000,
    surplus_pence: 5_000,
    surplus_ratio: 0.025,
    explanation:
      "Your income just covers your outgoings, with about £50.00 left over.",
  },
  deficit: {
    total_income_pence: 200_000,
    total_expenditure_pence: 250_000,
    surplus_pence: -50_000,
    surplus_ratio: -0.25,
    explanation:
      "Your outgoings are about £500.00 more than your income this period.",
  },
  insufficient_data: {
    total_income_pence: 0,
    total_expenditure_pence: 0,
    surplus_pence: 0,
    surplus_ratio: null,
    explanation:
      "We don't have enough information yet to show a full picture.",
  },
};

export function makeAssessment(
  band: AssessmentBand = "healthy",
  overrides: Partial<Assessment> = {},
): Assessment {
  return {
    band,
    ...ASSESSMENT_DEFAULTS[band],
    ...overrides,
  } as Assessment;
}

export function makeLineItem(
  overrides: Partial<LineItemRead> = {},
): LineItemRead {
  const id = overrides.id ?? nextId();
  return {
    id,
    statement_id: overrides.statement_id ?? "stmt-1",
    type: "expense",
    category: "food",
    label: "Groceries",
    amount_pence: 50_000,
    created_at: "2026-04-01T00:00:00",
    updated_at: "2026-04-01T00:00:00",
    ...overrides,
  } as LineItemRead;
}

export function makeStatementSummary(
  overrides: Partial<StatementSummary> = {},
): StatementSummary {
  const id = overrides.id ?? nextId();
  return {
    id,
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    note: null,
    created_at: "2026-04-01T00:00:00",
    updated_at: "2026-04-01T00:00:00",
    assessment: makeAssessment("healthy"),
    ...overrides,
  };
}

export function makeStatement(
  overrides: Partial<StatementRead> = {},
): StatementRead {
  const summary = makeStatementSummary(overrides);
  return {
    ...summary,
    line_items: overrides.line_items ?? [],
  };
}

export function makeTrendPoint(
  overrides: Partial<TrendPoint> = {},
): TrendPoint {
  return {
    statement_id: overrides.statement_id ?? nextId(),
    period_start: "2026-01-01",
    period_end: "2026-01-31",
    band: "healthy",
    total_income_pence: 300_000,
    total_expenditure_pence: 200_000,
    surplus_pence: 100_000,
    ...overrides,
  };
}
