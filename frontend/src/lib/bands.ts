import type {
  Assessment,
  AssessmentBand,
  AssessmentNumbers,
  AssessmentTemplateKey,
  Currency,
  DebtLoadBand,
} from "@/api";
import { formatMoney } from "@/lib/format";

/**
 * Per-band label + headline used by pills and section titles.
 * The headline is band-level (independent of currency / numbers).
 */
export interface BandMeta {
  label: string;
  headline: string;
}

export const BAND_META: Record<AssessmentBand, BandMeta> = {
  healthy: {
    label: "Healthy",
    headline: "You're in a good position",
  },
  tight: {
    label: "Tight",
    headline: "Things are tight but manageable",
  },
  deficit: {
    label: "Stretched",
    headline: "Your outgoings are a little ahead of your income",
  },
  insufficient_data: {
    label: "Just getting started",
    headline: "Let's build the picture",
  },
};

/**
 * Debt-load (stock) band metadata. Independent signal from affordability —
 * shown side-by-side rather than folded into a single verdict.
 */
export const DEBT_BAND_META: Record<DebtLoadBand, BandMeta> = {
  debt_free: {
    label: "Debt-free",
    headline: "Nothing outstanding — that's a great place to be",
  },
  manageable: {
    label: "Manageable",
    headline: "Your debt is at a manageable level",
  },
  heavy: {
    label: "Heavy",
    headline: "Your debt is on the heavy side",
  },
  severe: {
    label: "Significant",
    headline: "Your debt is significant — we can help you find a way forward",
  },
  insufficient_data: {
    label: "Not yet recorded",
    headline: "Add your total outstanding balance to see this",
  },
};

/**
 * Copy bundle, keyed by the backend's template_key. Each entry is a pair of
 * functions that receive the raw numbers + currency and return localised
 * strings. The backend deliberately doesn't format money any more — it
 * returns ``{template_key, numbers, currency}`` and the frontend renders.
 *
 * Tone rules (per SPEC.md):
 *   - never alarming
 *   - never accusatory
 *   - always actionable / forward-looking
 *
 * If you add a template variant, add it here too — the `Record<TemplateKey>`
 * type guarantees we don't forget.
 */
export interface AssessmentCopy {
  /** The explanation sentence (uses the numbers). */
  body: (numbers: AssessmentNumbers, currency: Currency) => string;
  /** A forward-looking next step (currency-agnostic). */
  nextStep: string;
}

export const ASSESSMENT_COPY: Record<AssessmentTemplateKey, AssessmentCopy> = {
  healthy_default: {
    body: (n, c) =>
      `You have around ${formatMoney(n.surplus_minor, c)} left over after your outgoings — that's a healthy margin.`,
    nextStep:
      "Things are looking steady. If you can, putting a little aside each month builds a useful buffer for the unexpected.",
  },
  tight_default: {
    body: (n, c) =>
      `Your income just covers your outgoings, with about ${formatMoney(n.surplus_minor, c)} left over.`,
    nextStep:
      "There's not a lot of slack at the moment. It's worth checking your outgoings for anything that could come down — small changes add up over a few months.",
  },
  deficit_default: {
    body: (n, c) =>
      `Your outgoings are about ${formatMoney(Math.abs(n.surplus_minor), c)} more than your income this period.`,
    nextStep:
      "This happens to lots of people. Going through your outgoings one by one is usually the most useful next step — you might find more room than you'd expect, and we're here to help with the rest.",
  },
  insufficient_data_default: {
    body: () =>
      "We don't have enough information yet to show a full picture.",
    nextStep:
      "Add a few lines of income and your regular outgoings, and we'll show you how things look.",
  },

  // Debt-load copy. The ``body`` describes the balance + DTI, the
  // ``nextStep`` is forward-looking. Same tone rules.
  debt_free_default: {
    body: () => "You have no outstanding balance recorded for this period.",
    nextStep:
      "That's a real achievement. If you can, putting a little aside each month is a useful safety net for the future.",
  },
  debt_manageable_default: {
    body: (n, c) => {
      const balance = formatMoney(n.outstanding_debt_minor ?? 0, c);
      const months = n.debt_to_income_monthly ?? 0;
      return `You owe around ${balance} — that's about ${monthsLabel(months)} of your current income.`;
    },
    nextStep:
      "Keeping up your regular repayments will steadily bring this down. You're in a good position to stay on top of it.",
  },
  debt_heavy_default: {
    body: (n, c) => {
      const balance = formatMoney(n.outstanding_debt_minor ?? 0, c);
      const months = n.debt_to_income_monthly ?? 0;
      return `You owe around ${balance}, which is about ${monthsLabel(months)} of your current income.`;
    },
    nextStep:
      "It's worth taking a closer look at your repayment plan. Even small changes to how you pay down debt can make a real difference over time — we can help you map it out.",
  },
  debt_severe_default: {
    body: (n, c) => {
      const balance = formatMoney(n.outstanding_debt_minor ?? 0, c);
      const months = n.debt_to_income_monthly ?? 0;
      return `You owe around ${balance}, which is around ${monthsLabel(months)} of your current income.`;
    },
    nextStep:
      "This is a lot to carry, and you don't have to figure it out alone. A short conversation with one of our advisers can open up options that aren't always obvious from the outside.",
  },
  debt_insufficient_data_default: {
    body: () =>
      "We don't have your total outstanding balance for this period yet.",
    nextStep:
      "Adding it lets us show how your debt compares to your monthly income, and how it's changing over time.",
  },
};

/**
 * Format the debt-to-income ratio for inline copy. We round to one decimal
 * and switch between "month" and "months" so the sentence reads naturally.
 */
function monthsLabel(months: number): string {
  const rounded = Math.round(months * 10) / 10;
  if (rounded === 1) return "1 month";
  // Whole numbers drop the trailing .0 ("3 months", not "3.0 months").
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${display} months`;
}

/** Convenience: build both copy strings from an Assessment payload. */
export function renderAssessmentCopy(
  assessment: Assessment,
): { body: string; nextStep: string } {
  const copy = ASSESSMENT_COPY[assessment.template_key];
  return {
    body: copy.body(assessment.numbers, assessment.currency),
    nextStep: copy.nextStep,
  };
}

/** Same idea but for the debt-load side of the assessment. */
export function renderDebtCopy(
  assessment: Assessment,
): { body: string; nextStep: string } {
  const copy = ASSESSMENT_COPY[assessment.debt_load_template_key];
  return {
    body: copy.body(assessment.numbers, assessment.currency),
    nextStep: copy.nextStep,
  };
}
