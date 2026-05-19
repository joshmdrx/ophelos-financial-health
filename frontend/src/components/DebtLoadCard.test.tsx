/**
 * Tests for DebtLoadCard cover three things that matter most:
 *
 * 1. The right copy renders for each band (smoke-test the template-key path).
 * 2. NULL ("balance not recorded") and 0 ("debt-free") look meaningfully
 *    different to the user — not just the same "0" with different copy.
 * 3. Tone — every band's text passes the no-alarming-language rule. This is
 *    where the FCA-friendly framing actually lives now that copy moved to
 *    the frontend.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DebtLoadCard } from "./DebtLoadCard";
import { makeAssessment } from "@/test/factories";

const FORBIDDEN = /\b(fail|failure|warning|cannot afford|danger|bad)\b/i;

describe("DebtLoadCard", () => {
  it("renders the debt-free band with celebratory copy", () => {
    render(
      <DebtLoadCard
        assessment={makeAssessment("healthy", {
          debt_load_band: "debt_free",
          numbers: {
            income_minor: 300_000,
            expenditure_minor: 200_000,
            surplus_minor: 100_000,
            outstanding_debt_minor: 0,
            debt_to_income_monthly: 0,
          },
        })}
      />,
    );

    const card = screen.getByLabelText(/outstanding debt assessment/i);
    expect(card).toHaveAttribute("data-debt-band", "debt_free");
    expect(card).toHaveTextContent(/nothing outstanding/i);
    expect(card.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("renders the manageable band with the balance + months figure", () => {
    render(
      <DebtLoadCard
        assessment={makeAssessment("healthy", {
          debt_load_band: "manageable",
          numbers: {
            income_minor: 200_000,
            expenditure_minor: 150_000,
            surplus_minor: 50_000,
            outstanding_debt_minor: 600_000,
            debt_to_income_monthly: 3,
          },
        })}
      />,
    );

    const card = screen.getByLabelText(/outstanding debt assessment/i);
    expect(card).toHaveAttribute("data-debt-band", "manageable");
    // "About 3 months of your current income" — the months figure ends up
    // in the body copy, not as a separate label.
    expect(card).toHaveTextContent("3 months");
    // Balance shown in the numbers grid.
    expect(card).toHaveTextContent("£6,000.00");
    expect(card.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("renders the severe band without alarming language", () => {
    render(
      <DebtLoadCard
        assessment={makeAssessment("healthy", {
          debt_load_band: "severe",
          numbers: {
            income_minor: 100_000,
            expenditure_minor: 80_000,
            surplus_minor: 20_000,
            outstanding_debt_minor: 2_000_000,
            debt_to_income_monthly: 20,
          },
        })}
      />,
    );

    const card = screen.getByLabelText(/outstanding debt assessment/i);
    expect(card).toHaveAttribute("data-debt-band", "severe");
    // The strongest label we use is "Significant" — not "bad" / "danger".
    expect(card).toHaveTextContent(/significant/i);
    expect(card.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("treats NULL balance as 'not yet recorded' rather than zero", () => {
    render(
      <DebtLoadCard
        assessment={makeAssessment("healthy", {
          debt_load_band: "insufficient_data",
          numbers: {
            income_minor: 300_000,
            expenditure_minor: 200_000,
            surplus_minor: 100_000,
            outstanding_debt_minor: null,
            debt_to_income_monthly: null,
          },
        })}
      />,
    );

    const card = screen.getByLabelText(/outstanding debt assessment/i);
    expect(card).toHaveAttribute("data-debt-band", "insufficient_data");
    // The numbers grid is suppressed when there's no balance — no leading
    // "£0.00" that would imply debt-free.
    expect(card).not.toHaveTextContent("£0.00");
    expect(card).toHaveTextContent(/not recorded yet|add your total/i);
  });

  it("shows an 'Add balance' button when a callback is supplied (Statements view)", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <DebtLoadCard
        assessment={makeAssessment("healthy", {
          debt_load_band: "insufficient_data",
          numbers: {
            income_minor: 200_000,
            expenditure_minor: 100_000,
            surplus_minor: 100_000,
            outstanding_debt_minor: null,
            debt_to_income_monthly: null,
          },
        })}
        onEditBalance={onEdit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add balance/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("offers 'Update balance' when a value is already present", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <DebtLoadCard
        assessment={makeAssessment("healthy", {
          debt_load_band: "manageable",
          numbers: {
            income_minor: 200_000,
            expenditure_minor: 100_000,
            surplus_minor: 100_000,
            outstanding_debt_minor: 400_000,
            debt_to_income_monthly: 2,
          },
        })}
        onEditBalance={onEdit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /update balance/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("hides the edit button when no callback is supplied (Dashboard view)", () => {
    render(
      <DebtLoadCard
        assessment={makeAssessment("healthy", {
          debt_load_band: "manageable",
          numbers: {
            income_minor: 200_000,
            expenditure_minor: 100_000,
            surplus_minor: 100_000,
            outstanding_debt_minor: 400_000,
            debt_to_income_monthly: 2,
          },
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /balance/i })).toBeNull();
  });
});
