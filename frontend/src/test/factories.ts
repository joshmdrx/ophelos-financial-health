import type {
  Assessment,
  AssessmentBand,
  AssessmentNumbers,
  AssessmentTemplateKey,
  Currency,
  DebtLoadBand,
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

const DEBT_BAND_TO_TEMPLATE: Record<DebtLoadBand, AssessmentTemplateKey> = {
  debt_free: "debt_free_default",
  manageable: "debt_manageable_default",
  heavy: "debt_heavy_default",
  severe: "debt_severe_default",
  insufficient_data: "debt_insufficient_data_default",
};

const NUMBERS_DEFAULTS: Record<AssessmentBand, AssessmentNumbers> = {
  healthy: {
    income_minor: 300_000,
    expenditure_minor: 200_000,
    surplus_minor: 100_000,
    outstanding_debt_minor: null,
    debt_to_income_monthly: null,
  },
  tight: {
    income_minor: 200_000,
    expenditure_minor: 195_000,
    surplus_minor: 5_000,
    outstanding_debt_minor: null,
    debt_to_income_monthly: null,
  },
  deficit: {
    income_minor: 200_000,
    expenditure_minor: 250_000,
    surplus_minor: -50_000,
    outstanding_debt_minor: null,
    debt_to_income_monthly: null,
  },
  insufficient_data: {
    income_minor: 0,
    expenditure_minor: 0,
    surplus_minor: 0,
    outstanding_debt_minor: null,
    debt_to_income_monthly: null,
  },
};

export function makeAssessment(
  band: AssessmentBand = "healthy",
  overrides: Partial<Assessment> = {},
): Assessment {
  // Default debt band is whatever the override carries, else insufficient
  // (the "no balance recorded yet" case — keeps tests focused on the
  // affordability band unless they opt into debt explicitly).
  const debtBand = overrides.debt_load_band ?? "insufficient_data";
  return {
    band,
    template_key: BAND_TO_TEMPLATE[band],
    debt_load_band: debtBand,
    debt_load_template_key: DEBT_BAND_TO_TEMPLATE[debtBand],
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
    outstanding_debt_minor: null,
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
    debt_load_band: "insufficient_data",
    outstanding_debt_minor: null,
    ...overrides,
  };
}
