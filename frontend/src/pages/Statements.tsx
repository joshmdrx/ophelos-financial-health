import { useEffect, useState } from "react";

import { AssessmentCard } from "@/components/AssessmentCard";
import { BandPill } from "@/components/BandPill";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InlineError } from "@/components/InlineError";
import { LineItemForm } from "@/components/LineItemForm";
import { LineItemTable } from "@/components/LineItemTable";
import { NewStatementForm } from "@/components/NewStatementForm";
import { Empty } from "@/components/states/Empty";
import { ErrorState } from "@/components/states/ErrorState";
import { Loading } from "@/components/states/Loading";
import {
  useAddLineItem,
  useCreateStatement,
  useDeleteLineItem,
  useDeleteStatement,
  useStatement,
  useStatementList,
  useUpdateLineItem,
} from "@/hooks/useStatements";
import { formatMoneyFromPence, formatMonthRange } from "@/lib/format";

export function Statements() {
  const list = useStatementList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Keep selection coherent with the cached list. Three cases:
  //  - list became non-empty and nothing's selected → pick the first.
  //  - list still has the selected id → no change.
  //  - selected id no longer in the list (e.g. optimistically deleted) →
  //    advance to the new first, or null if the list is now empty.
  useEffect(() => {
    if (!list.data) return;
    if (list.data.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const stillThere = list.data.some((s) => s.id === selectedId);
    if (!stillThere) setSelectedId(list.data[0].id);
  }, [list.data, selectedId]);

  const createStatement = useCreateStatement();
  const deleteStatement = useDeleteStatement();

  if (list.isLoading) return <Loading what="your statements" />;
  if (list.isError) return <ErrorState onRetry={() => list.refetch()} />;

  const statements = list.data ?? [];
  const noneYet = statements.length === 0 && !creating;

  return (
    <>
      <header className="page-header">
        <h1>Statements</h1>
        <p className="page-header__lede">
          Each statement covers a period — usually a month. Adding income and
          outgoings here is what powers your overview and over-time view.
        </p>
      </header>

      <div className="toolbar">
        <div />
        {!creating && (
          <button className="btn" onClick={() => setCreating(true)}>
            New statement
          </button>
        )}
      </div>

      {creating && (
        <>
          <NewStatementForm
            onCancel={() => {
              setCreating(false);
              createStatement.reset();
            }}
            pending={createStatement.isPending}
            onSubmit={(payload) =>
              createStatement.mutate(
                { ...payload, line_items: [], note: null },
                {
                  onSuccess: (created) => {
                    setSelectedId(created.id);
                    setCreating(false);
                  },
                },
              )
            }
          />
          <InlineError error={createStatement.error} />
        </>
      )}

      {noneYet ? (
        <Empty
          title="No statements yet"
          body="Create your first statement to start building the picture."
          action={
            <button className="btn" onClick={() => setCreating(true)}>
              New statement
            </button>
          }
        />
      ) : (
        <div className="detail-grid" style={{ marginTop: 16 }}>
          <div className="statement-list">
            {statements.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  "statement-row" + (s.id === selectedId ? " active" : "")
                }
                onClick={() => setSelectedId(s.id)}
              >
                <div>
                  <div className="statement-row__period">
                    {formatMonthRange(s.period_start, s.period_end)}
                  </div>
                  <div className="statement-row__sub">
                    {formatMoneyFromPence(s.assessment.total_income_pence)} in ·{" "}
                    {formatMoneyFromPence(s.assessment.total_expenditure_pence)}{" "}
                    out
                  </div>
                </div>
                <BandPill band={s.assessment.band} />
                <div />
              </button>
            ))}
          </div>

          {selectedId ? (
            <StatementDetail
              key={selectedId}
              statementId={selectedId}
              onDelete={(id) => deleteStatement.mutate(id)}
              deletePending={deleteStatement.isPending}
              deleteError={deleteStatement.error}
            />
          ) : (
            <Empty
              title="Pick a statement"
              body="Choose one from the list to view and edit its lines."
            />
          )}
        </div>
      )}
    </>
  );
}

function StatementDetail({
  statementId,
  onDelete,
  deletePending,
  deleteError,
}: {
  statementId: string;
  onDelete: (id: string) => void;
  deletePending: boolean;
  deleteError: unknown;
}) {
  const { data, isLoading, isError, refetch } = useStatement(statementId);
  const addItem = useAddLineItem(statementId);
  const updateItem = useUpdateLineItem(statementId);
  const deleteItem = useDeleteLineItem(statementId);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(
    null,
  );
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  if (isLoading) return <Loading what="this statement" />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const editingItem = editingItemId
    ? data.line_items.find((li) => li.id === editingItemId) ?? null
    : null;

  function exitEditMode() {
    setEditingItemId(null);
    updateItem.reset();
  }

  return (
    <div>
      <AssessmentCard
        assessment={data.assessment}
        periodLabel={formatMonthRange(data.period_start, data.period_end)}
      />

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card__title">Income and outgoings</h2>
        <LineItemTable
          items={data.line_items}
          editingId={editingItemId}
          pendingDeleteId={pendingDeleteItemId}
          onEdit={(id) => {
            setEditingItemId(id);
            addItem.reset();
            updateItem.reset();
          }}
          onDelete={(id) => {
            setPendingDeleteItemId(id);
            deleteItem.mutate(id, {
              onSettled: () => setPendingDeleteItemId(null),
            });
          }}
        />
        <InlineError error={deleteItem.error} />
      </section>

      <section className="card">
        <h2 className="card__title">
          {editingItem ? "Edit this line" : "Add a line"}
        </h2>
        <LineItemForm
          // Remount when entering/leaving edit mode so internal state resets
          // cleanly without manual effect choreography.
          key={editingItemId ?? "new"}
          initial={editingItem}
          pending={editingItem ? updateItem.isPending : addItem.isPending}
          onCancel={editingItem ? exitEditMode : undefined}
          onSubmit={(body) => {
            if (editingItem) {
              updateItem.mutate(
                { itemId: editingItem.id, body },
                { onSuccess: () => exitEditMode() },
              );
            } else {
              addItem.mutate(body);
            }
          }}
        />
        <InlineError error={editingItem ? updateItem.error : addItem.error} />
      </section>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setConfirmRemoveOpen(true)}
          disabled={deletePending}
        >
          {deletePending ? "Removing…" : "Remove this statement"}
        </button>
      </div>
      <InlineError error={deleteError} />

      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Remove this statement?"
        body="It won't contribute to your overview or over-time view. You can always add a new statement for this period later."
        confirmLabel="Yes, remove it"
        cancelLabel="Keep it"
        tone="destructive"
        pending={deletePending}
        onConfirm={() => {
          onDelete(statementId);
          setConfirmRemoveOpen(false);
        }}
        onCancel={() => setConfirmRemoveOpen(false)}
      />
    </div>
  );
}
