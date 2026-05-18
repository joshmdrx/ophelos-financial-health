/**
 * Dashboard render-state tests.
 *
 * The dashboard has four distinct visual states and the brief specifically
 * calls out that each should be handled thoughtfully. These tests pin each
 * one and also check the tone — we don't want a deficit screen reading like
 * an alarm.
 */
import { screen, waitForElementToBeRemoved } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dashboard } from "@/pages/Dashboard";
import { makeAssessment, makeStatementSummary } from "@/test/factories";
import { scenarios, server, statementsList } from "@/test/server";
import { renderWithProviders } from "@/test/wrappers";

describe("Dashboard", () => {
  it("shows the loading state while statements are fetched", () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByRole("status")).toHaveTextContent(/just a moment/i);
  });

  it("shows the empty-state CTA when nothing is logged yet", async () => {
    // Default handler returns [].
    renderWithProviders(<Dashboard />);

    await waitForElementToBeRemoved(() => screen.queryByRole("status"));
    expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add your first statement/i }),
    ).toBeInTheDocument();
  });

  it("renders the latest assessment with explanation and totals", async () => {
    server.use(
      statementsList([
        makeStatementSummary({
          id: "latest",
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          assessment: makeAssessment("healthy", {
            numbers: {
              income_minor: 280_000,
              expenditure_minor: 180_000,
              surplus_minor: 100_000,
            },
          }),
        }),
      ]),
    );

    renderWithProviders(<Dashboard />);

    expect(
      await screen.findByText(/you're in a good position/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you have around £1,000\.00 left over/i),
    ).toBeInTheDocument();
    expect(screen.getByText("£2,800.00")).toBeInTheDocument();
    expect(screen.getByText("£1,800.00")).toBeInTheDocument();
    expect(screen.getByText("£1,000.00")).toBeInTheDocument();

    // Assessment card carries the band as a data attribute — the CSS keys off
    // it. If this disappears, the styling breaks silently.
    expect(screen.getByLabelText(/affordability assessment/i)).toHaveAttribute(
      "data-band",
      "healthy",
    );
  });

  it("renders a deficit without alarming language", async () => {
    server.use(
      statementsList([
        makeStatementSummary({
          assessment: makeAssessment("deficit", {
            numbers: {
              income_minor: 200_000,
              expenditure_minor: 250_000,
              surplus_minor: -50_000,
            },
          }),
        }),
      ]),
    );

    renderWithProviders(<Dashboard />);

    // The headline frames this as a position to work from, not a verdict.
    expect(
      await screen.findByText(/outgoings are a little ahead/i),
    ).toBeInTheDocument();

    // The summary shows the absolute shortfall, not a negative number with a
    // minus sign — that visual would read as a punishment.
    expect(screen.getByText("Shortfall")).toBeInTheDocument();
    expect(screen.getByText("£500.00")).toBeInTheDocument();

    // No combination of "fail", "warning", or shouting language should appear.
    expect(screen.queryByText(/fail|warning|cannot afford/i)).toBeNull();
  });

  it("surfaces an API failure as a recoverable error state with retry", async () => {
    server.use(scenarios.failGet("/statements"));
    renderWithProviders(<Dashboard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /we couldn't load this/i,
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("treats an insufficient_data assessment as a gentle next-step prompt, not an alert", async () => {
    server.use(
      statementsList([
        makeStatementSummary({
          assessment: makeAssessment("insufficient_data"),
        }),
      ]),
    );

    renderWithProviders(<Dashboard />);
    expect(
      await screen.findByText(/let's build the picture/i),
    ).toBeInTheDocument();
  });
});
