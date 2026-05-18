import { useState } from "react";

import type { CountryCode, Currency } from "@/api";

interface Props {
  onSubmit: (payload: {
    period_start: string;
    period_end: string;
    currency: Currency;
    country_code: CountryCode;
  }) => void;
  onCancel: () => void;
  pending?: boolean;
}

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
  const invalid = !!start && !!end && end < start;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    onSubmit({
      period_start: start,
      period_end: end,
      currency,
      country_code: country,
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
      </div>
      {invalid && (
        <p style={{ color: "var(--band-deficit-fg)", fontSize: "0.85rem" }}>
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
