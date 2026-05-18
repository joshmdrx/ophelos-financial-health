import { useEffect, useId, useRef } from "react";

/**
 * A small confirmation modal used in place of native ``window.confirm``.
 * Centralising the look + tone here means we get consistent button labels and
 * copy across the app, and the destructive variant can be visually distinct
 * without ever leaning on red/alarm styling.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "neutral" for non-destructive confirms, "destructive" for removals. */
  tone?: "neutral" | "destructive";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape; focus the confirm button on open so keyboard users
  // can act immediately.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    // Focus the most-actionable button — the user can Tab to Cancel.
    const confirmBtn = dialogRef.current?.querySelector<HTMLButtonElement>(
      "[data-confirm]",
    );
    confirmBtn?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onClick={() => !pending && onCancel()}
      data-testid="dialog-backdrop"
    >
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        <p className="dialog__body">{body}</p>
        <div className="dialog__actions">
          <button
            type="button"
            className={
              "btn" + (tone === "destructive" ? " btn--destructive" : "")
            }
            onClick={onConfirm}
            disabled={pending}
            data-confirm
          >
            {pending ? "Working…" : confirmLabel}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
