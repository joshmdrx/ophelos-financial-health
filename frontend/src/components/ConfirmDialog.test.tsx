import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

function defaults() {
  return {
    title: "Remove this thing?",
    body: "This can't be undone.",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe("ConfirmDialog", () => {
  it("does not render when closed", () => {
    render(<ConfirmDialog open={false} {...defaults()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders with the supplied copy and proper ARIA when open", () => {
    render(<ConfirmDialog open {...defaults()} confirmLabel="Yes" cancelLabel="No" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Remove this thing?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("fires onConfirm when the confirm button is clicked", async () => {
    const props = defaults();
    const user = userEvent.setup();
    render(<ConfirmDialog open {...props} confirmLabel="Yes" />);

    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("fires onCancel when the cancel button is clicked", async () => {
    const props = defaults();
    const user = userEvent.setup();
    render(<ConfirmDialog open {...props} cancelLabel="No" />);

    await user.click(screen.getByRole("button", { name: "No" }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("fires onCancel when the backdrop is clicked", async () => {
    const props = defaults();
    const user = userEvent.setup();
    render(<ConfirmDialog open {...props} />);

    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it("does not bubble dialog clicks to the backdrop", async () => {
    const props = defaults();
    const user = userEvent.setup();
    render(<ConfirmDialog open {...props} />);

    await user.click(screen.getByRole("dialog"));
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("fires onCancel on Escape", () => {
    const props = defaults();
    render(<ConfirmDialog open {...props} />);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it("disables buttons and shows a working-state label while pending", async () => {
    const props = defaults();
    const user = userEvent.setup();
    render(<ConfirmDialog open {...props} pending />);

    const confirmBtn = screen.getByRole("button", { name: /working/i });
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    // Backdrop click is also disabled while pending so the user can't
    // accidentally dismiss mid-request.
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("applies the destructive variant when tone='destructive'", () => {
    render(
      <ConfirmDialog open {...defaults()} tone="destructive" confirmLabel="Remove" />,
    );
    const confirmBtn = screen.getByRole("button", { name: "Remove" });
    expect(confirmBtn.className).toContain("btn--destructive");
  });
});
