import type { Assessment } from "@/api";
import { DEBT_BAND_META, renderDebtCopy } from "@/lib/bands";
import { formatMoney } from "@/lib/format";

/**
 * Sibling to ``AssessmentCard``. Surfaces the debt-load signal separately so
 * it stays distinct from cashflow — different decisions, different conversations.
 *
 * Tone rules per SPEC.md:
 *   - never alarming (no red, no "warning", no "failure")
 *   - always pair the position with a next step
 *   - "Significant" is the strongest label we use, never "bad" / "danger"
 */
interface Props {
  assessment: Assessment;
  /** Optional period label so the card can be self-describing on the dashboard. */
  periodLabel?: string;
  /** Shown only when the parent passes a callback — keeps the dashboard card
   *  purely informational. */
  onEditBalance?: () => void;
}

export function DebtLoadCard({ assessment, periodLabel, onEditBalance }: Props) {
  const meta = DEBT_BAND_META[assessment.debt_load_band];
  const copy = renderDebtCopy(assessment);
  const { numbers, currency } = assessment;
  const hasBalance = numbers.outstanding_debt_minor !== null
    && numbers.outstanding_debt_minor !== undefined;

  return (
    <section
      className="assessment"
      data-debt-band={assessment.debt_load_band}
      aria-label="Outstanding debt assessment"
    >
      <div className="assessment__eyebrow">
        {periodLabel ? `Your debt position · ${periodLabel}` : "Your debt position"}
      </div>
      <h2 className="assessment__band">{meta.headline}</h2>
      <p className="assessment__explanation">{copy.body}</p>

      {hasBalance && (
        <div className="assessment__numbers" role="group" aria-label="Debt summary">
          <div>
            <div className="assessment__number-label">Outstanding</div>
            <div className="assessment__number-value">
              {formatMoney(numbers.outstanding_debt_minor!, currency)}
            </div>
          </div>
          {numbers.debt_to_income_monthly !== null
            && numbers.debt_to_income_monthly !== undefined && (
            <div>
              <div className="assessment__number-label">Months of income</div>
              <div className="assessment__number-value">
                {formatMonths(numbers.debt_to_income_monthly)}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="assessment__nextstep">{copy.nextStep}</p>

      {onEditBalance && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onEditBalance}
          >
            {hasBalance ? "Update balance" : "Add balance"}
          </button>
        </div>
      )}
    </section>
  );
}

function formatMonths(months: number): string {
  const rounded = Math.round(months * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
