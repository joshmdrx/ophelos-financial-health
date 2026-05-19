/**
 * Statements page tests focus on the full create→edit flow most likely to
 * regress: list renders, clicking a row loads detail, the new-statement form
 * opens and submits, and a fetch failure produces a retryable error.
 */
import { screen, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HttpResponse, http } from "msw";

import { Statements } from "@/pages/Statements";
import {
  makeAssessment,
  makeLineItem,
  makeStatement,
  makeStatementSummary,
} from "@/test/factories";
import {
  apiUrl,
  scenarios,
  server,
  statementDetail,
  statementsList,
} from "@/test/server";
import { renderWithProviders } from "@/test/wrappers";

describe("Statements page", () => {
  it("shows the empty state when there are no statements", async () => {
    renderWithProviders(<Statements />);

    await waitForElementToBeRemoved(() =>
      screen.queryByText(/just a moment/i),
    );

    expect(screen.getByText(/no statements yet/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /new statement/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders the list and auto-selects the first statement", async () => {
    const apr = makeStatementSummary({
      id: "apr",
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      assessment: makeAssessment("healthy"),
    });
    const mar = makeStatementSummary({
      id: "mar",
      period_start: "2026-03-01",
      period_end: "2026-03-31",
      assessment: makeAssessment("tight"),
    });
    server.use(
      statementsList([apr, mar]),
      statementDetail(makeStatement({ id: "apr", assessment: apr.assessment })),
    );

    renderWithProviders(<Statements />);

    expect(await screen.findByText("April 2026")).toBeInTheDocument();
    expect(screen.getByText("March 2026")).toBeInTheDocument();
    // Auto-selection lights up the assessment card for the latest.
    expect(
      await screen.findByLabelText(/affordability assessment/i),
    ).toHaveAttribute("data-band", "healthy");
  });

  it("loads a different statement's detail when its row is clicked", async () => {
    const apr = makeStatementSummary({
      id: "apr",
      period_end: "2026-04-30",
      assessment: makeAssessment("healthy"),
    });
    const mar = makeStatementSummary({
      id: "mar",
      period_end: "2026-03-31",
      assessment: makeAssessment("deficit"),
    });
    server.use(
      statementsList([apr, mar]),
      statementDetail(makeStatement({ id: "apr", assessment: apr.assessment })),
      statementDetail(makeStatement({ id: "mar", assessment: mar.assessment })),
    );

    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    await screen.findByText("April 2026");
    await user.click(screen.getByRole("button", { name: /march 2026/i }));

    // The detail panel's band data attribute flips to match.
    const card = await screen.findByLabelText(/affordability assessment/i);
    expect(card).toHaveAttribute("data-band", "deficit");
  });

  it("opens the new-statement form, submits it, and re-fetches the list", async () => {
    // Initially empty list — after creation the handler returns one entry.
    let listCalls = 0;
    server.use(
      ...[
        // GET /statements: empty on first call, populated after a create.
        statementsList(
          [], // baseline
        ),
      ],
    );
    // Override the GET with a dynamic handler we can flip.
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.get("http://localhost:8000/api/statements", () => {
        listCalls += 1;
        return HttpResponse.json(
          listCalls === 1
            ? []
            : [
                makeStatementSummary({
                  id: "fresh",
                  period_start: "2026-05-01",
                  period_end: "2026-05-31",
                }),
              ],
        );
      }),
      statementDetail(makeStatement({ id: "fresh" })),
    );

    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    // Empty state visible.
    await screen.findByText(/no statements yet/i);

    // Open the create form via the top-toolbar button.
    await user.click(
      screen.getAllByRole("button", { name: /new statement/i })[0],
    );

    const form = await screen.findByRole("form", { name: /new statement/i });
    const startInput = within(form).getByLabelText(/from/i);
    const endInput = within(form).getByLabelText(/^to$/i);
    await user.clear(startInput);
    await user.type(startInput, "2026-05-01");
    await user.clear(endInput);
    await user.type(endInput, "2026-05-31");

    await user.click(
      within(form).getByRole("button", { name: /create statement/i }),
    );

    // After invalidation the new statement appears.
    expect(await screen.findByText(/may 2026/i)).toBeInTheDocument();
    expect(listCalls).toBeGreaterThanOrEqual(2);
  });

  it("shows a retryable error state when the list endpoint fails", async () => {
    server.use(scenarios.failGet("/statements"));
    renderWithProviders(<Statements />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /we couldn't load this/i,
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("shows a detail-level error state when a single statement fails to load", async () => {
    const sum = makeStatementSummary({ id: "x" });
    server.use(
      statementsList([sum]),
      scenarios.failGet("/statements/x"),
    );

    renderWithProviders(<Statements />);

    // Wait for the list to render.
    await screen.findByText("April 2026");
    // The right-hand detail area surfaces its own error state.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /we couldn't load this/i,
    );
  });
});

describe("Statements page — confirm dialog", () => {
  function withOneStatement(id = "only") {
    const sum = makeStatementSummary({ id });
    server.use(
      statementsList([sum]),
      statementDetail(makeStatement({ id, line_items: [] })),
    );
    return id;
  }

  it("opens a modal instead of using native confirm when removing a statement", async () => {
    withOneStatement();
    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    await user.click(
      await screen.findByRole("button", { name: /remove this statement/i }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText(/remove this statement\?/i)).toBeInTheDocument();
  });

  it("cancelling the dialog does not call DELETE", async () => {
    withOneStatement();
    let deleteCalls = 0;
    server.use(
      http.delete(apiUrl("/statements/only"), () => {
        deleteCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    await user.click(
      await screen.findByRole("button", { name: /remove this statement/i }),
    );
    await user.click(screen.getByRole("button", { name: /keep it/i }));

    // Dialog gone, no DELETE fired.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteCalls).toBe(0);
  });

  it("confirming removes the statement and advances selection", async () => {
    const a = makeStatementSummary({
      id: "a",
      period_start: "2026-04-01",
      period_end: "2026-04-30",
    });
    const b = makeStatementSummary({
      id: "b",
      period_start: "2026-03-01",
      period_end: "2026-03-31",
    });
    let deleted = false;
    server.use(
      http.get(apiUrl("/statements"), () =>
        HttpResponse.json(deleted ? [b] : [a, b]),
      ),
      statementDetail(makeStatement({ id: "a" })),
      statementDetail(makeStatement({ id: "b" })),
      http.delete(apiUrl("/statements/a"), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    await screen.findByText("April 2026");
    // Wait for the detail pane to finish loading so the remove button is
    // rendered (it lives inside StatementDetail).
    const removeBtn = await screen.findByRole("button", {
      name: /remove this statement/i,
    });
    await user.click(removeBtn);
    await user.click(screen.getByRole("button", { name: /yes, remove it/i }));

    // List no longer shows April; March is auto-selected.
    expect(screen.queryByText("April 2026")).toBeNull();
    expect(screen.getByText("March 2026")).toBeInTheDocument();
  });
});

describe("Statements page — inline mutation errors", () => {
  it("shows a non-alarming error next to the create form when the API rejects it", async () => {
    server.use(scenarios.failPost("/statements"));
    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    await user.click(
      (await screen.findAllByRole("button", { name: /new statement/i }))[0],
    );
    const form = await screen.findByRole("form", { name: /new statement/i });
    await user.click(
      within(form).getByRole("button", { name: /create statement/i }),
    );

    // The detail message from the API surfaces inline; no toast, no alert popup.
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid/i);
  });

  it("shows an inline error when adding a line item fails", async () => {
    const id = "x";
    server.use(
      statementsList([makeStatementSummary({ id })]),
      statementDetail(makeStatement({ id, line_items: [] })),
      scenarios.failPost(`/statements/${id}/line-items`),
    );

    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    const form = await screen.findByRole("form", { name: /add a line item/i });
    await user.type(within(form).getByLabelText(/amount/i), "10");
    await user.click(within(form).getByRole("button", { name: /add line/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("Statements page — edit a line item", () => {
  it("switches the form into edit mode and PATCHes the chosen item", async () => {
    const id = "edit-target";
    const item = makeLineItem({
      id: "li-1",
      statement_id: id,
      type: "expense",
      category: "food",
      label: "Groceries",
      amount_minor: 50_000,
    });
    let patchedBody: unknown = null;
    server.use(
      statementsList([makeStatementSummary({ id })]),
      statementDetail(makeStatement({ id, line_items: [item] })),
      http.patch(
        apiUrl(`/statements/${id}/line-items/${item.id}`),
        async ({ request }) => {
          patchedBody = await request.json();
          return HttpResponse.json(
            makeStatement({
              id,
              line_items: [{ ...item, amount_minor: 60_000 }],
            }),
          );
        },
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    await user.click(
      await screen.findByRole("button", { name: /edit groceries/i }),
    );

    const form = await screen.findByRole("form", { name: /edit line item/i });
    const amount = within(form).getByLabelText(/amount/i);
    await user.clear(amount);
    await user.type(amount, "60");
    await user.click(within(form).getByRole("button", { name: /save changes/i }));

    // The form returns to add-mode after a successful save.
    expect(
      await screen.findByRole("form", { name: /add a line item/i }),
    ).toBeInTheDocument();

    expect(patchedBody).toMatchObject({
      type: "expense",
      category: "food",
      amount_minor: 6_000,
    });
  });

  it("Cancel exits edit mode without firing a request", async () => {
    const id = "cancel-target";
    const item = makeLineItem({ id: "li-1", statement_id: id });
    let patchCalls = 0;
    server.use(
      statementsList([makeStatementSummary({ id })]),
      statementDetail(makeStatement({ id, line_items: [item] })),
      http.patch(
        apiUrl(`/statements/${id}/line-items/${item.id}`),
        () => {
          patchCalls += 1;
          return HttpResponse.json(makeStatement({ id }));
        },
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<Statements />);

    await user.click(await screen.findByRole("button", { name: /edit groceries/i }));
    const form = await screen.findByRole("form", { name: /edit line item/i });
    await user.click(within(form).getByRole("button", { name: /cancel/i }));

    expect(
      await screen.findByRole("form", { name: /add a line item/i }),
    ).toBeInTheDocument();
    expect(patchCalls).toBe(0);
  });
});
