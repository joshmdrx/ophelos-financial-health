import { useState } from "react";

import type { Currency } from "@/api";

const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
  AUD: "A$",
};

interface Props {
  currency: Currency;
  initialMinor: number | null;
  pending?: boolean;
  /** Submit the new balance in minor units, or null to clear it. */
  onSubmit: (amountMinor: number | null) => void;
  onCancel: () => void;
}

/**
 * Inline form for the statement's outstanding-debt balance. Three meaningful
 * submission shapes:
 *   - a number ≥ 0      → save that minor-unit amount
 *   - empty string      → "not recorded" (NULL on the wire) — the user is
 *                         explicitly clearing the value
 *   - anything else     → validation error
 *
 * NULL vs 0 is deliberate: "no balance recorded" and "debt-free" are
 * different signals the API treats distinctly and we mustn't collapse here.
 */
export function BalanceForm({
  currency,
  initialMinor,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState<string>(
    initialMinor === null || initialMinor === undefined
      ? ""
      : majorFromMinor(initialMinor),
  );
  const [submitted, setSubmitted] = useState(false);

  const parsed = value === "" ? null : parseFloat(value);
  const invalid =
    parsed !== null && (!Number.isFinite(parsed) || parsed < 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    onSubmit(parsed === null ? null : Math.round(parsed * 100));
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Edit outstanding balance"
      className="card"
      noValidate
    >
      <h2 className="card__title">Outstanding balance</h2>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Your total outstanding debt at the end of this period. Leave blank if
        you'd rather not record it for now.
      </p>
      <div className="form-row">
        <label htmlFor="balance-amount">
          Amount ({CURRENCY_SYMBOL[currency]})
        </label>
        <input
          id="balance-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 1200.00"
          aria-invalid={submitted && invalid}
          aria-describedby={submitted && invalid ? "balance-error" : undefined}
          autoFocus
        />
        {submitted && invalid && (
          <p id="balance-error" className="field-error" role="alert">
            Please enter zero or a positive amount.
          </p>
        )}
      </div>
      <div className="form-actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function majorFromMinor(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}
