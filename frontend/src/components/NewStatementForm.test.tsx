import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewStatementForm } from "./NewStatementForm";

describe("NewStatementForm", () => {
  it("submits the chosen period", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    const start = screen.getByLabelText(/from/i) as HTMLInputElement;
    const end = screen.getByLabelText(/^to$/i) as HTMLInputElement;

    await user.clear(start);
    await user.type(start, "2026-04-01");
    await user.clear(end);
    await user.type(end, "2026-04-30");

    await user.click(screen.getByRole("button", { name: /create statement/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      currency: "GBP",
      country_code: "GB",
      // Blank balance maps to null ("not recorded") — distinct from 0.
      outstanding_debt_minor: null,
    });
  });

  it("blocks submission and surfaces a gentle message when end is before start", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    const start = screen.getByLabelText(/from/i);
    const end = screen.getByLabelText(/^to$/i);
    await user.clear(start);
    await user.type(start, "2026-04-30");
    await user.clear(end);
    await user.type(end, "2026-04-01");

    expect(
      screen.getByText(/end date needs to be on or after/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create statement/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel when the user backs out", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables submit and shows a pending label while the request is in flight", () => {
    render(<NewStatementForm onSubmit={vi.fn()} onCancel={vi.fn()} pending />);
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });
});

describe("NewStatementForm — outstanding debt", () => {
  it("submits null when the balance field is left blank", async () => {
    // The test in the previous suite already asserts the null default, but
    // pinning it here too keeps the debt-input behaviour self-documenting.
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /create statement/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ outstanding_debt_minor: null }),
    );
  });

  it("submits the typed amount converted to minor units", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/total outstanding debt/i), "1200");
    await user.click(screen.getByRole("button", { name: /create statement/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ outstanding_debt_minor: 120_000 }),
    );
  });

  it("preserves the meaningful distinction between 0 and blank", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Explicitly typing 0 must surface as 0 (debt-free), not be coerced to
    // null (not recorded). This is the most important debt-input invariant.
    await user.type(screen.getByLabelText(/total outstanding debt/i), "0");
    await user.click(screen.getByRole("button", { name: /create statement/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ outstanding_debt_minor: 0 }),
    );
  });

  it("updates the currency symbol on the debt label when currency changes", async () => {
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(
      screen.getByLabelText(/total outstanding debt \(£\)/i),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/currency/i), "EUR");
    expect(
      screen.getByLabelText(/total outstanding debt \(€\)/i),
    ).toBeInTheDocument();
  });
});
