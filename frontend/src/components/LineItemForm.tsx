import { useEffect, useState } from "react";
import type {
  ExpenseCategory,
  IncomeCategory,
  LineItemCreate,
  LineItemRead,
  LineItemType,
} from "@/api";

const INCOME_CATEGORIES: IncomeCategory[] = [
  "salary",
  "benefits",
  "pension",
  "other",
];
const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "housing",
  "utilities",
  "food",
  "transport",
  "debt_repayments",
  "childcare",
  "insurance",
  "other",
];

const LABEL_MAX_LENGTH = 120;

function prettyCategory(c: string) {
  return c.replace("_", " ");
}

function poundsFromPence(pence: number): string {
  // Display whole-pound amounts without a trailing .00; everything else keeps
  // two decimal places.
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

export interface LineItemFormProps {
  onSubmit: (item: LineItemCreate) => void;
  /** When set the form is in *edit* mode: prepopulated, with a Cancel button
   *  and a different submit label. */
  initial?: LineItemRead | null;
  onCancel?: () => void;
  pending?: boolean;
}

export function LineItemForm({
  onSubmit,
  initial = null,
  onCancel,
  pending,
}: LineItemFormProps) {
  const isEditing = initial !== null;

  const [type, setType] = useState<LineItemType>(initial?.type ?? "expense");
  const [category, setCategory] = useState<string>(initial?.category ?? "food");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [pounds, setPounds] = useState(
    initial ? poundsFromPence(initial.amount_pence) : "",
  );
  const [submitted, setSubmitted] = useState(false);

  // If a different row enters edit mode we get a new ``initial`` — sync the
  // form to it. Callers can also bypass this by remounting with a ``key``.
  useEffect(() => {
    if (initial) {
      setType(initial.type);
      setCategory(initial.category);
      setLabel(initial.label ?? "");
      setPounds(poundsFromPence(initial.amount_pence));
      setSubmitted(false);
    }
  }, [initial]);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function changeType(next: LineItemType) {
    setType(next);
    setCategory(next === "income" ? "salary" : "food");
  }

  // Parse the user input once; reuse for validation + submit.
  const parsed = parseFloat(pounds);
  const amountPence = Number.isFinite(parsed) ? Math.round(parsed * 100) : null;

  // Validation derives from current state — we only *display* the errors
  // once the user has tried to submit (less nagging while they're still
  // typing).
  const errors = {
    amount:
      amountPence === null || amountPence <= 0
        ? "Please enter an amount greater than zero."
        : null,
    label:
      label.length > LABEL_MAX_LENGTH
        ? `Keep the description under ${LABEL_MAX_LENGTH} characters.`
        : null,
  };
  const isValid = !errors.amount && !errors.label;
  const showErrors = submitted;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!isValid || amountPence === null) return;
    onSubmit({
      type,
      category: category as IncomeCategory | ExpenseCategory,
      label: label.trim() || null,
      amount_pence: amountPence,
    });
    if (!isEditing) {
      // Creation mode: clear the inputs so the next add starts fresh.
      setLabel("");
      setPounds("");
      setSubmitted(false);
    }
  }

  const submitLabel = pending
    ? isEditing
      ? "Saving…"
      : "Adding…"
    : isEditing
      ? "Save changes"
      : "Add line";

  return (
    <form
      onSubmit={submit}
      aria-label={isEditing ? "Edit line item" : "Add a line item"}
      noValidate
    >
      <div className="form-grid">
        <div className="form-row">
          <label htmlFor="li-type">Type</label>
          <select
            id="li-type"
            value={type}
            onChange={(e) => changeType(e.target.value as LineItemType)}
          >
            <option value="income">Income</option>
            <option value="expense">Outgoing</option>
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="li-category">Category</label>
          <select
            id="li-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {prettyCategory(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="li-label">Description (optional)</label>
          <input
            id="li-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Salary"
            aria-invalid={showErrors && !!errors.label}
            aria-describedby={
              showErrors && errors.label ? "li-label-error" : undefined
            }
          />
          {showErrors && errors.label && (
            <p id="li-label-error" className="field-error" role="alert">
              {errors.label}
            </p>
          )}
        </div>
        <div className="form-row">
          <label htmlFor="li-amount">Amount (£)</label>
          <input
            id="li-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={pounds}
            onChange={(e) => setPounds(e.target.value)}
            aria-invalid={showErrors && !!errors.amount}
            aria-describedby={
              showErrors && errors.amount ? "li-amount-error" : undefined
            }
          />
          {showErrors && errors.amount && (
            <p id="li-amount-error" className="field-error" role="alert">
              {errors.amount}
            </p>
          )}
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn" disabled={pending}>
          {submitLabel}
        </button>
        {isEditing && onCancel && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
