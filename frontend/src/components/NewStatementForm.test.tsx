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
    const end = screen.getByLabelText(/to/i) as HTMLInputElement;

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
    });
  });

  it("blocks submission and surfaces a gentle message when end is before start", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<NewStatementForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    const start = screen.getByLabelText(/from/i);
    const end = screen.getByLabelText(/to/i);
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
