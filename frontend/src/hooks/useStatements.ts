import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addLineItem,
  createStatement,
  deleteLineItem,
  deleteStatement,
  getStatement,
  getTrend,
  listStatements,
  updateLineItem,
  updateStatement,
} from "@/api";
import type {
  LineItemCreate,
  LineItemUpdate,
  StatementCreate,
  StatementRead,
  StatementSummary,
  StatementUpdate,
  TrendPoint,
} from "@/api";

const KEYS = {
  list: ["statements"] as const,
  detail: (id: string) => ["statement", id] as const,
  trend: ["trend"] as const,
};

async function unwrap<T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error || data === undefined) {
    throw error ?? new Error("Request failed");
  }
  return data;
}

export function useStatementList() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: () => unwrap<StatementSummary[]>(listStatements()),
  });
}

export function useStatement(id: string | null) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : ["statement", "none"],
    queryFn: () =>
      unwrap<StatementRead>(getStatement({ path: { statement_id: id! } })),
    enabled: !!id,
  });
}

export function useTrend() {
  return useQuery({
    queryKey: KEYS.trend,
    queryFn: () => unwrap<TrendPoint[]>(getTrend()),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: KEYS.list });
  qc.invalidateQueries({ queryKey: KEYS.trend });
  if (id) qc.invalidateQueries({ queryKey: KEYS.detail(id) });
}

export function useCreateStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StatementCreate) =>
      unwrap<StatementRead>(createStatement({ body })),
    onSuccess: (created) => invalidateAll(qc, created.id),
  });
}

/**
 * PATCH a statement. Used today for editing the outstanding-debt balance
 * (currency and country are immutable; the backend rejects them with 422).
 */
export function useUpdateStatement(statementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StatementUpdate) =>
      unwrap<StatementRead>(
        updateStatement({ path: { statement_id: statementId }, body }),
      ),
    onSuccess: () => invalidateAll(qc, statementId),
  });
}

export function useDeleteStatement() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, string, { previous?: StatementSummary[] }>({
    mutationFn: (id: string) =>
      unwrap(deleteStatement({ path: { statement_id: id } })),
    // Remove the row from the cached list immediately so the UI updates the
    // moment the user confirms. The full invalidation in onSettled re-syncs
    // against the server's view (and picks up any cascade like trend refresh).
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEYS.list });
      const previous = qc.getQueryData<StatementSummary[]>(KEYS.list);
      if (previous) {
        qc.setQueryData<StatementSummary[]>(
          KEYS.list,
          previous.filter((s) => s.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      // Roll the optimistic removal back so the user can see + retry.
      if (ctx?.previous) {
        qc.setQueryData(KEYS.list, ctx.previous);
      }
    },
    onSettled: (_data, _err, id) => invalidateAll(qc, id),
  });
}

export function useAddLineItem(statementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LineItemCreate) =>
      unwrap<StatementRead>(
        addLineItem({ path: { statement_id: statementId }, body }),
      ),
    onSuccess: () => invalidateAll(qc, statementId),
  });
}

export function useUpdateLineItem(statementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: LineItemUpdate }) =>
      unwrap<StatementRead>(
        updateLineItem({
          path: { statement_id: statementId, item_id: itemId },
          body,
        }),
      ),
    onSuccess: () => invalidateAll(qc, statementId),
  });
}

export function useDeleteLineItem(statementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      unwrap<StatementRead>(
        deleteLineItem({
          path: { statement_id: statementId, item_id: itemId },
        }),
      ),
    onSuccess: () => invalidateAll(qc, statementId),
  });
}
