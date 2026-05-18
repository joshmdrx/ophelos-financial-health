import { useEffect, useState } from "react";
import type {
  Currency,
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

/**
 * Currency symbol shown on the input label. The actual money formatting goes
 * through Intl.NumberFormat elsewhere; this is just a label hint so the user
 * knows which currency they're entering.
 */
const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
  AUD: "A$",
};

function prettyCategory(c: string) {
  return c.replace("_", " ");
}

/**
 * Convert a stored minor-unit amount into the major-unit string used by the
 * <input>. For our 2-digit-minor allowlist this is /100. Whole-major values
 * drop the trailing .00.
 */
function majorFromMinor(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

export interface LineItemFormProps {
  onSubmit: (item: LineItemCreate) => void;
  /** The parent statement's currency — drives the amount-input label only. */
  currency: Currency;
  /** When set the form is in *edit* mode: prepopulated, with a Cancel button
   *  and a different submit label. */
  initial?: LineItemRead | null;
  onCancel?: () => void;
  pending?: boolean;
}

export function LineItemForm({
  onSubmit,
  currency,
  initial = null,
  onCancel,
  pending,
}: LineItemFormProps) {
  const isEditing = initial !== null;

  const [type, setType] = useState<LineItemType>(initial?.type ?? "expense");
  const [category, setCategory] = useState<string>(initial?.category ?? "food");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(
    initial ? majorFromMinor(initial.amount_minor) : "",
  );
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initial) {
      setType(initial.type);
      setCategory(initial.category);
      setLabel(initial.label ?? "");
      setAmount(majorFromMinor(initial.amount_minor));
      setSubmitted(false);
    }
  }, [initial]);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function changeType(next: LineItemType) {
    setType(next);
    setCategory(next === "income" ? "salary" : "food");
  }

  const parsed = parseFloat(amount);
  const amountMinor = Number.isFinite(parsed) ? Math.round(parsed * 100) : null;

  const errors = {
    amount:
      amountMinor === null || amountMinor <= 0
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
    if (!isValid || amountMinor === null) return;
    onSubmit({
      type,
      category: category as IncomeCategory | ExpenseCategory,
      label: label.trim() || null,
      amount_minor: amountMinor,
    });
    if (!isEditing) {
      setLabel("");
      setAmount("");
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
          <label htmlFor="li-amount">Amount ({CURRENCY_SYMBOL[currency]})</label>
          <input
            id="li-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
