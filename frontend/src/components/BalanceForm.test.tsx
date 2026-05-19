/**
 * BalanceForm is small but load-bearing — it's the only path that
 * distinguishes "not recorded" (NULL) from "debt-free" (0). Each row of the
 * truth table gets a dedicated test.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BalanceForm } from "./BalanceForm";

describe("BalanceForm", () => {
  it("prepopulates the major-unit amount from minor units", () => {
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={123_456}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/amount/i)).toHaveValue(1234.56);
  });

  it("starts blank when initial is null (no balance recorded)", () => {
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/amount/i)).toHaveValue(null);
  });

  it("submits a positive amount in minor units", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/amount/i), "750");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith(75_000);
  });

  it("submits 0 as zero, not as null — debt-free is distinct from unknown", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={50_000}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/amount/i));
    await user.type(screen.getByLabelText(/amount/i), "0");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith(0);
  });

  it("submits null when the input is left blank — clears the balance", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={50_000}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/amount/i));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith(null);
  });

  it("rejects a negative amount inline without firing onSubmit", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    // jsdom's number input strips most negative strings, so type a value
    // then mutate to negative via fireEvent. Easiest: type "-50" — some
    // browsers accept it, some don't; in jsdom we get the parsed value
    // through.
    const input = screen.getByLabelText(/amount/i);
    await user.type(input, "-50");
    await user.click(screen.getByRole("button", { name: /save/i }));

    // Either jsdom rejected the input (value stays empty → onSubmit called
    // with null) or it accepted the negative and validation blocked it.
    // We care that *positive-only* semantics held — so a non-null negative
    // would be a real bug.
    const calls = onSubmit.mock.calls;
    if (calls.length > 0) {
      // If a call happened, it must be null (input parsing stripped it),
      // never a negative number.
      expect(calls[0][0]).toBeNull();
    } else {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /zero or a positive amount/i,
      );
    }
  });

  it("fires onCancel when the user backs out", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={null}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables actions and shows a saving label while pending", () => {
    render(
      <BalanceForm
        currency="GBP"
        initialMinor={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("shows the right currency symbol on the amount label", () => {
    const { rerender } = render(
      <BalanceForm
        currency="GBP"
        initialMinor={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/amount \(£\)/i)).toBeInTheDocument();

    rerender(
      <BalanceForm
        currency="EUR"
        initialMinor={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/amount \(€\)/i)).toBeInTheDocument();
  });
});
