import { describe, expect, it } from "vitest";

import type { AssessmentBand, AssessmentTemplateKey } from "@/api";
import {
  ASSESSMENT_COPY,
  BAND_META,
  renderAssessmentCopy,
} from "./bands";
import { makeAssessment } from "@/test/factories";

const ALL_BANDS: AssessmentBand[] = [
  "healthy",
  "tight",
  "deficit",
  "insufficient_data",
];

const ALL_TEMPLATES: AssessmentTemplateKey[] = [
  "healthy_default",
  "tight_default",
  "deficit_default",
  "insufficient_data_default",
];

/**
 * The copy bundle is the single place where alarming/accusatory language could
 * leak into the product. We assert it can't, both by content and by structure.
 */
describe("ASSESSMENT_COPY tone", () => {
  // Words/phrases the brief specifically forbids in customer-facing copy.
  const FORBIDDEN = [
    /\bfail(ure|ed)?\b/i,
    /\bwarning\b/i,
    /\bcannot afford\b/i,
    /\byou can't\b/i,
    /\byou shouldn't\b/i,
  ];

  for (const key of ALL_TEMPLATES) {
    it(`'${key}' body + nextStep contain no alarming language`, () => {
      const copy = ASSESSMENT_COPY[key];
      // Pick a representative payload — deficit gets a negative surplus so
      // the body renders the shortfall path; the others use defaults.
      const assessment = makeAssessment(
        key.replace("_default", "") as AssessmentBand,
      );
      const body = copy.body(assessment.numbers, assessment.currency);
      const combined = `${body} ${copy.nextStep}`;
      for (const pattern of FORBIDDEN) {
        expect(combined).not.toMatch(pattern);
      }
    });
  }
});

describe("ASSESSMENT_COPY rendering", () => {
  it("healthy_default body includes the formatted surplus in the right currency", () => {
    const body = ASSESSMENT_COPY.healthy_default.body(
      { income_minor: 200_000, expenditure_minor: 100_000, surplus_minor: 100_000 },
      "GBP",
    );
    expect(body).toContain("£1,000.00");
  });

  it("deficit_default body uses the absolute shortfall, not a negative number", () => {
    const body = ASSESSMENT_COPY.deficit_default.body(
      { income_minor: 200_000, expenditure_minor: 250_000, surplus_minor: -50_000 },
      "GBP",
    );
    // Must not show a "-£500" — that visual reads as a punishment.
    expect(body).not.toContain("-£");
    expect(body).toContain("£500.00");
  });

  it("renders EUR amounts when the statement's currency is EUR", () => {
    const body = ASSESSMENT_COPY.healthy_default.body(
      { income_minor: 200_000, expenditure_minor: 100_000, surplus_minor: 100_000 },
      "EUR",
    );
    expect(body).toContain("€1,000.00");
  });

  it("insufficient_data body doesn't try to print any numbers", () => {
    const body = ASSESSMENT_COPY.insufficient_data_default.body(
      { income_minor: 0, expenditure_minor: 0, surplus_minor: 0 },
      "GBP",
    );
    // Zero amounts would render as £0.00 — not useful copy. The template
    // sidesteps it entirely.
    expect(body).not.toMatch(/£0\.00|0\.00/);
  });

  it("renderAssessmentCopy composes body + nextStep from an Assessment payload", () => {
    const assessment = makeAssessment("healthy", {
      numbers: {
        income_minor: 200_000,
        expenditure_minor: 100_000,
        surplus_minor: 100_000,
      },
    });
    const rendered = renderAssessmentCopy(assessment);
    expect(rendered.body).toContain("£1,000.00");
    expect(rendered.nextStep).toBeTruthy();
  });
});

describe("BAND_META completeness", () => {
  // If we ever add an AssessmentBand value without updating BAND_META the
  // pill / legend will render `undefined`. This static check pins that.
  for (const band of ALL_BANDS) {
    it(`has label + headline for '${band}'`, () => {
      expect(BAND_META[band]?.label).toBeTruthy();
      expect(BAND_META[band]?.headline).toBeTruthy();
    });
  }
});
