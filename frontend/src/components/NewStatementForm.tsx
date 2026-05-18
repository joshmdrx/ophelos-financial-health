import { useState } from "react";

interface Props {
  onSubmit: (payload: { period_start: string; period_end: string }) => void;
  onCancel: () => void;
  pending?: boolean;
}

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
  const invalid = !!start && !!end && end < start;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    onSubmit({ period_start: start, period_end: end });
  }

  return (
    <form onSubmit={submit} className="card" aria-label="New statement">
      <h2 className="card__title">Start a new statement</h2>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Pick the period this statement covers. You can add lines after.
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
