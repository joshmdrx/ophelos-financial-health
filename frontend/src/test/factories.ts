import type {
  Assessment,
  AssessmentBand,
  AssessmentNumbers,
  AssessmentTemplateKey,
  Currency,
  LineItemRead,
  StatementRead,
  StatementSummary,
  TrendPoint,
} from "@/api";

let counter = 0;
const nextId = () => `test-${++counter}`;

const BAND_TO_TEMPLATE: Record<AssessmentBand, AssessmentTemplateKey> = {
  healthy: "healthy_default",
  tight: "tight_default",
  deficit: "deficit_default",
  insufficient_data: "insufficient_data_default",
};

const NUMBERS_DEFAULTS: Record<AssessmentBand, AssessmentNumbers> = {
  healthy: {
    income_minor: 300_000,
    expenditure_minor: 200_000,
    surplus_minor: 100_000,
  },
  tight: {
    income_minor: 200_000,
    expenditure_minor: 195_000,
    surplus_minor: 5_000,
  },
  deficit: {
    income_minor: 200_000,
    expenditure_minor: 250_000,
    surplus_minor: -50_000,
  },
  insufficient_data: {
    income_minor: 0,
    expenditure_minor: 0,
    surplus_minor: 0,
  },
};

export function makeAssessment(
  band: AssessmentBand = "healthy",
  overrides: Partial<Assessment> = {},
): Assessment {
  return {
    band,
    template_key: BAND_TO_TEMPLATE[band],
    currency: "GBP",
    numbers: { ...NUMBERS_DEFAULTS[band], ...overrides.numbers },
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
    amount_minor: 50_000,
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
    currency: "GBP" as Currency,
    country_code: "GB",
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
    currency: "GBP" as Currency,
    band: "healthy",
    income_minor: 300_000,
    expenditure_minor: 200_000,
    surplus_minor: 100_000,
    ...overrides,
  };
}
