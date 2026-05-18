import type { Currency, LineItemRead } from "@/api";
import { formatMoney } from "@/lib/format";

export function LineItemTable({
  items,
  currency,
  onEdit,
  onDelete,
  pendingDeleteId,
  editingId,
}: {
  items: LineItemRead[];
  /** Parent statement's currency — drives money formatting on amounts. */
  currency: Currency;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  pendingDeleteId?: string | null;
  /** Which row is being edited — that row gets visual emphasis. */
  editingId?: string | null;
}) {
  if (items.length === 0) {
    return (
      <p style={{ color: "var(--color-text-muted)" }}>
        No lines yet — add one above.
      </p>
    );
  }
  const hasActions = !!onEdit || !!onDelete;
  return (
    <table className="line-items">
      <thead>
        <tr>
          <th>Type</th>
          <th>Category</th>
          <th>Description</th>
          <th style={{ textAlign: "right" }}>Amount</th>
          {hasActions && <th />}
        </tr>
      </thead>
      <tbody>
        {items.map((li) => {
          const isEditing = editingId === li.id;
          return (
            <tr key={li.id} data-editing={isEditing || undefined}>
              <td>
                <span className="line-items__type" data-type={li.type}>
                  {li.type === "income" ? "Income" : "Outgoing"}
                </span>
              </td>
              <td>{li.category.replace("_", " ")}</td>
              <td>{li.label || "—"}</td>
              <td className="amount">{formatMoney(li.amount_minor, currency)}</td>
              {hasActions && (
                <td className="actions">
                  {onEdit && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => onEdit(li.id)}
                      aria-label={`Edit ${li.label || li.category}`}
                      style={{ padding: "2px 10px", marginRight: 4 }}
                    >
                      {isEditing ? "Editing" : "Edit"}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="btn btn--danger-ghost"
                      onClick={() => onDelete(li.id)}
                      disabled={pendingDeleteId === li.id}
                      aria-label={`Remove ${li.label || li.category}`}
                    >
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
