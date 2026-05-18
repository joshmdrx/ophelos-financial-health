/**
 * LineItemForm tests cover two responsibilities the form actually owns:
 *
 *  1. *Client-side validation* — amount > 0, description ≤ 120 chars, type ↔
 *     category coherence. The backend enforces the same rules, but if the
 *     form lets a bad payload through we're sending requests we know will
 *     422 — bad UX.
 *  2. *Two modes*: blank create, prepopulated edit. The form is shared so it
 *     stays in sync with the backend's PATCH endpoint shape.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LineItemForm } from "./LineItemForm";
import { makeLineItem } from "@/test/factories";

describe("LineItemForm — create mode", () => {
  it("submits a well-formed line item in pence", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LineItemForm onSubmit={onSubmit} currency="GBP" />);

    await user.selectOptions(screen.getByLabelText(/type/i), "income");
    await user.selectOptions(screen.getByLabelText(/category/i), "salary");
    await user.type(screen.getByLabelText(/description/i), "April salary");
    await user.type(screen.getByLabelText(/amount/i), "1234.56");
    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      type: "income",
      category: "salary",
      label: "April salary",
      amount_minor: 123_456,
    });
  });

  it("swaps the category options when the type changes", async () => {
    const user = userEvent.setup();
    render(<LineItemForm onSubmit={vi.fn()} currency="GBP" />);

    expect(
      screen.getByRole("option", { name: /housing/i }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/type/i), "income");
    expect(screen.queryByRole("option", { name: /housing/i })).toBeNull();
    expect(screen.getByRole("option", { name: /salary/i })).toBeInTheDocument();
  });

  it("sends a null label when description is left blank", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LineItemForm onSubmit={onSubmit} currency="GBP" />);

    await user.type(screen.getByLabelText(/amount/i), "10");
    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ label: null }),
    );
  });

  it("reflects the pending prop in the submit label", () => {
    render(<LineItemForm onSubmit={vi.fn()} currency="GBP" pending />);
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
  });
});

describe("LineItemForm — inline validation", () => {
  it("blocks submit and surfaces an inline error when the amount is missing", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LineItemForm onSubmit={onSubmit} currency="GBP" />);

    // Don't type an amount.
    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/amount greater than zero/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("rejects a zero amount as not useful information", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LineItemForm onSubmit={onSubmit} currency="GBP" />);

    await user.type(screen.getByLabelText(/amount/i), "0");
    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/amount greater than zero/i),
    ).toBeInTheDocument();
  });

  it("does not show errors until the user attempts submit", async () => {
    const user = userEvent.setup();
    render(<LineItemForm onSubmit={vi.fn()} currency="GBP" />);

    // No amount typed — the validity is already broken, but we don't shout.
    expect(screen.queryByText(/amount greater than zero/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /add line/i }));
    expect(screen.getByText(/amount greater than zero/i)).toBeInTheDocument();
  });

  it("flags an over-length description", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LineItemForm onSubmit={onSubmit} currency="GBP" />);

    const overLong = "x".repeat(121);
    await user.type(screen.getByLabelText(/description/i), overLong);
    await user.type(screen.getByLabelText(/amount/i), "5");
    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/under 120 characters/i)).toBeInTheDocument();
  });
});

describe("LineItemForm — edit mode", () => {
  it("prepopulates from `initial` and shows save + cancel buttons", () => {
    render(
      <LineItemForm currency="GBP"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        initial={makeLineItem({
          type: "income",
          category: "salary",
          label: "Paycheque",
          amount_minor: 280_000,
        })}
      />,
    );

    expect(screen.getByLabelText(/type/i)).toHaveValue("income");
    expect(screen.getByLabelText(/category/i)).toHaveValue("salary");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Paycheque");
    expect(screen.getByLabelText(/amount/i)).toHaveValue(2800);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("submits an updated payload", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <LineItemForm currency="GBP"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initial={makeLineItem({
          type: "expense",
          category: "food",
          label: "Groceries",
          amount_minor: 50_000,
        })}
      />,
    );

    const amount = screen.getByLabelText(/amount/i);
    await user.clear(amount);
    await user.type(amount, "60");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: "expense",
      category: "food",
      label: "Groceries",
      amount_minor: 6_000,
    });
  });

  it("calls onCancel when the user backs out", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <LineItemForm currency="GBP"
        onSubmit={vi.fn()}
        onCancel={onCancel}
        initial={makeLineItem()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("uses the saving label while a request is pending", () => {
    render(
      <LineItemForm currency="GBP"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        initial={makeLineItem()}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
});
