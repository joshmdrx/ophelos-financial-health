import { useState } from "react";

import type { CountryCode, Currency } from "@/api";

interface Props {
  onSubmit: (payload: {
    period_start: string;
    period_end: string;
    currency: Currency;
    country_code: CountryCode;
    outstanding_debt_minor: number | null;
  }) => void;
  onCancel: () => void;
  pending?: boolean;
}

const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
  AUD: "A$",
};

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "GBP", label: "GBP — British pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — US dollar" },
  { value: "AUD", label: "AUD — Australian dollar" },
];

const COUNTRIES: { value: CountryCode; label: string }[] = [
  { value: "GB", label: "United Kingdom" },
  { value: "IE", label: "Ireland" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "US", label: "United States" },
  { value: "AU", label: "Australia" },
];

function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function NewStatementForm({ onSubmit, onCancel, pending }: Props) {
  const initial = thisMonthRange();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [country, setCountry] = useState<CountryCode>("GB");
  // Empty string = "not recorded" (NULL). The user can type 0 to mean
  // "debt-free" explicitly — we don't conflate those.
  const [debt, setDebt] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const periodInvalid = !!start && !!end && end < start;

  // Parse the debt input lazily so we can show a validation message without
  // forcing the user to clear-and-retype.
  const debtParsed = debt === "" ? null : parseFloat(debt);
  const debtInvalid =
    debtParsed !== null && (!Number.isFinite(debtParsed) || debtParsed < 0);

  const invalid = periodInvalid || debtInvalid;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    onSubmit({
      period_start: start,
      period_end: end,
      currency,
      country_code: country,
      // Major-unit string → minor-unit integer. Empty input stays as null
      // ("not recorded") which is meaningfully different from 0 ("debt-free").
      outstanding_debt_minor:
        debtParsed === null ? null : Math.round(debtParsed * 100),
    });
  }

  return (
    <form onSubmit={submit} className="card" aria-label="New statement">
      <h2 className="card__title">Start a new statement</h2>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Pick the period this statement covers and the currency you'll record it
        in. Currency and country are set once and can't change later.
      </p>
      <div className="form-grid">
        <div className="form-row">
          <label htmlFor="ns-start">From</label>
          <input
            id="ns-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="ns-end">To</label>
          <input
            id="ns-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="ns-currency">Currency</label>
          <select
            id="ns-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="ns-country">Country</label>
          <select
            id="ns-country"
            value={country}
            onChange={(e) => setCountry(e.target.value as CountryCode)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ns-debt">
            Total outstanding debt ({CURRENCY_SYMBOL[currency]})
            <span
              style={{
                fontWeight: 400,
                color: "var(--color-text-muted)",
                marginLeft: 8,
              }}
            >
              optional — leave blank if you'd rather skip
            </span>
          </label>
          <input
            id="ns-debt"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={debt}
            onChange={(e) => setDebt(e.target.value)}
            placeholder="e.g. 1200.00"
            aria-invalid={submitted && debtInvalid}
            aria-describedby={
              submitted && debtInvalid ? "ns-debt-error" : "ns-debt-hint"
            }
          />
          {submitted && debtInvalid ? (
            <p id="ns-debt-error" className="field-error" role="alert">
              Please enter zero or a positive amount.
            </p>
          ) : (
            <p
              id="ns-debt-hint"
              style={{
                fontSize: "0.8rem",
                color: "var(--color-text-muted)",
                margin: 0,
              }}
            >
              Entering 0 means "no outstanding debt". You can edit this later.
            </p>
          )}
        </div>
      </div>
      {periodInvalid && (
        <p className="field-error" role="alert">
          The end date needs to be on or after the start date.
        </p>
      )}
      <div className="form-actions">
        <button className="btn" disabled={pending || invalid}>
          {pending ? "Creating…" : "Create statement"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
