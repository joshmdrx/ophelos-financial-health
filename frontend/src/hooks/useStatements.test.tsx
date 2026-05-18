/**
 * Hook tests. These don't render any page UI — they cover the contract between
 * the generated SDK and TanStack Query: did we surface ``error`` correctly,
 * does the invalidation chain refresh sibling queries, etc.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { HttpResponse, http } from "msw";

import {
  useAddLineItem,
  useCreateStatement,
  useDeleteStatement,
  useStatement,
  useStatementList,
  useTrend,
} from "@/hooks/useStatements";

import {
  makeStatement,
  makeStatementSummary,
  makeTrendPoint,
} from "@/test/factories";
import {
  apiUrl,
  scenarios,
  server,
  statementDetail,
  statementsList,
  trendSeries,
} from "@/test/server";

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe("useStatementList", () => {
  it("returns statements on success", async () => {
    server.use(
      statementsList([
        makeStatementSummary({ id: "s1", period_end: "2026-01-31" }),
        makeStatementSummary({ id: "s2", period_end: "2026-02-28" }),
      ]),
    );

    const { wrapper } = wrap();
    const { result } = renderHook(() => useStatementList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].id).toBe("s1");
  });

  it("surfaces an error when the API fails", async () => {
    server.use(scenarios.failGet("/statements"));

    const { wrapper } = wrap();
    const { result } = renderHook(() => useStatementList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("returns an empty array when nothing is logged yet", async () => {
    // Default handler returns []. Just verify the empty path is success, not
    // error or loading — the UI relies on that distinction.
    const { wrapper } = wrap();
    const { result } = renderHook(() => useStatementList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe("useStatement", () => {
  it("fetches a single statement and exposes its line items", async () => {
    const stmt = makeStatement({
      id: "abc",
      line_items: [
        { id: "li-1", statement_id: "abc", type: "income", category: "salary", label: "Salary", amount_pence: 200_000, created_at: "", updated_at: "" },
      ],
    });
    server.use(statementDetail(stmt));

    const { wrapper } = wrap();
    const { result } = renderHook(() => useStatement("abc"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.line_items).toHaveLength(1);
  });

  it("does not fire when id is null (avoids a doomed request)", () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useStatement(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("surfaces a 404 as an error", async () => {
    server.use(scenarios.notFoundGet("/statements/missing"));

    const { wrapper } = wrap();
    const { result } = renderHook(() => useStatement("missing"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useTrend", () => {
  it("returns points on success", async () => {
    server.use(trendSeries([makeTrendPoint({ statement_id: "t1" })]));

    const { wrapper } = wrap();
    const { result } = renderHook(() => useTrend(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("surfaces a failure", async () => {
    server.use(scenarios.failGet("/trend"));

    const { wrapper } = wrap();
    const { result } = renderHook(() => useTrend(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateStatement", () => {
  it("creates and invalidates the list + trend queries", async () => {
    const { qc, wrapper } = wrap();
    // Seed the cache with stale data; after a successful create both keys
    // should be marked stale so the UI refetches.
    qc.setQueryData(["statements"], [makeStatementSummary({ id: "old" })]);
    qc.setQueryData(["trend"], [makeTrendPoint()]);

    const { result } = renderHook(() => useCreateStatement(), { wrapper });

    result.current.mutate({
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      note: null,
      line_items: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryState(["statements"])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["trend"])?.isInvalidated).toBe(true);
  });

  it("surfaces validation failures as a mutation error", async () => {
    server.use(scenarios.failPost("/statements"));
    const { wrapper } = wrap();
    const { result } = renderHook(() => useCreateStatement(), { wrapper });

    result.current.mutate({
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      note: null,
      line_items: [],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteStatement", () => {
  it("removes the row from the cached list optimistically before the request resolves", async () => {
    const { qc, wrapper } = wrap();
    qc.setQueryData(["statements"], [
      makeStatementSummary({ id: "a" }),
      makeStatementSummary({ id: "b" }),
    ]);

    // Hold the DELETE open until we explicitly resolve it — the optimistic
    // cache update should be visible mid-request.
    let resolveDelete: () => void = () => {};
    const pending = new Promise<void>((r) => { resolveDelete = r; });
    server.use(
      http.delete(apiUrl("/statements/a"), async () => {
        await pending;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteStatement(), { wrapper });
    result.current.mutate("a");

    await waitFor(() => {
      const cached = qc.getQueryData<{ id: string }[]>(["statements"]);
      expect(cached?.map((s) => s.id)).toEqual(["b"]);
    });

    resolveDelete();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls the cache back when the request fails", async () => {
    const { qc, wrapper } = wrap();
    const initial = [
      makeStatementSummary({ id: "a" }),
      makeStatementSummary({ id: "b" }),
    ];
    qc.setQueryData(["statements"], initial);

    server.use(
      http.delete(apiUrl("/statements/a"), () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useDeleteStatement(), { wrapper });
    result.current.mutate("a");

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = qc.getQueryData<{ id: string }[]>(["statements"]);
    // Both rows should be back — the optimistic removal was rolled back.
    expect(cached?.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("useAddLineItem", () => {
  it("returns the updated statement on success", async () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useAddLineItem("abc"), { wrapper });

    result.current.mutate({
      type: "expense",
      category: "food",
      label: "Groceries",
      amount_pence: 5_000,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.line_items[0].amount_pence).toBe(5_000);
  });

  it("propagates a server validation error", async () => {
    server.use(scenarios.failPost("/statements/abc/line-items"));
    const { wrapper } = wrap();
    const { result } = renderHook(() => useAddLineItem("abc"), { wrapper });

    result.current.mutate({
      type: "expense",
      category: "food",
      label: null,
      amount_pence: 100,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
