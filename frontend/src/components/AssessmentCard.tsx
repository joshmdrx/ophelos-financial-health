import type { Assessment } from "@/api";
import { BAND_META } from "@/lib/bands";
import { formatMoneyFromPence } from "@/lib/format";

interface Props {
  assessment: Assessment;
  /** Optional period label, e.g. "April 2026" — gives the headline context. */
  periodLabel?: string;
}

export function AssessmentCard({ assessment, periodLabel }: Props) {
  const meta = BAND_META[assessment.band];
  const surplusLabel = assessment.surplus_pence >= 0 ? "Surplus" : "Shortfall";

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
      <p className="assessment__explanation">{assessment.explanation}</p>

      <div className="assessment__numbers" role="group" aria-label="Summary">
        <div>
          <div className="assessment__number-label">Income</div>
          <div className="assessment__number-value">
            {formatMoneyFromPence(assessment.total_income_pence)}
          </div>
        </div>
        <div>
          <div className="assessment__number-label">Outgoings</div>
          <div className="assessment__number-value">
            {formatMoneyFromPence(assessment.total_expenditure_pence)}
          </div>
        </div>
        <div>
          <div className="assessment__number-label">{surplusLabel}</div>
          <div className="assessment__number-value">
            {formatMoneyFromPence(Math.abs(assessment.surplus_pence))}
          </div>
        </div>
      </div>

      <p className="assessment__nextstep">{meta.nextStep}</p>
    </section>
  );
}
