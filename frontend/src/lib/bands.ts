import type {
  Assessment,
  AssessmentBand,
  AssessmentNumbers,
  AssessmentTemplateKey,
  Currency,
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
};

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
