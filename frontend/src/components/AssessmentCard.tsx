import type { Assessment } from "@/api";
import { BAND_META, renderAssessmentCopy } from "@/lib/bands";
import { formatMoney } from "@/lib/format";

interface Props {
  assessment: Assessment;
  /** Optional period label, e.g. "April 2026" — gives the headline context. */
  periodLabel?: string;
}

export function AssessmentCard({ assessment, periodLabel }: Props) {
  const meta = BAND_META[assessment.band];
  const copy = renderAssessmentCopy(assessment);
  const { numbers, currency } = assessment;
  const surplusLabel = numbers.surplus_minor >= 0 ? "Surplus" : "Shortfall";

  return (
    <section
      className="assessment"
      data-band={assessment.band}
      aria-label="Affordability assessment"
    >
      <div className="assessment__eyebrow">
        {periodLabel ? `Your position · ${periodLabel}` : "Your position"}
      </div>
      <h1 className="assessment__band">{meta.headline}</h1>
      <p className="assessment__explanation">{copy.body}</p>

      <div className="assessment__numbers" role="group" aria-label="Summary">
        <div>
          <div className="assessment__number-label">Income</div>
          <div className="assessment__number-value">
            {formatMoney(numbers.income_minor, currency)}
          </div>
        </div>
        <div>
          <div className="assessment__number-label">Outgoings</div>
          <div className="assessment__number-value">
            {formatMoney(numbers.expenditure_minor, currency)}
          </div>
        </div>
        <div>
          <div className="assessment__number-label">{surplusLabel}</div>
          <div className="assessment__number-value">
            {formatMoney(Math.abs(numbers.surplus_minor), currency)}
          </div>
        </div>
      </div>

      <p className="assessment__nextstep">{copy.nextStep}</p>
    </section>
  );
}
