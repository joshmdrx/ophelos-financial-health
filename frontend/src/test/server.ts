import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import type {
  LineItemCreate,
  StatementCreate,
  StatementRead,
  StatementSummary,
  TrendPoint,
} from "@/api";

import { makeAssessment, makeLineItem, makeStatement } from "./factories";

const API = "http://localhost:8000/api";

/**
 * Default handlers return an empty world — every test that cares about data
 * overrides them via ``server.use(...)``. Keeping defaults minimal prevents
 * one test's data from leaking into another's.
 */
export const defaultHandlers = [
  http.get(`${API}/health`, () => HttpResponse.json({ status: "ok" })),

  http.get(`${API}/statements`, () =>
    HttpResponse.json<StatementSummary[]>([]),
  ),
  http.get(`${API}/statements/:id`, ({ params }) =>
    HttpResponse.json<StatementRead>(makeStatement({ id: params.id as string })),
  ),
  http.post(`${API}/statements`, async ({ request }) => {
    const body = (await request.json()) as StatementCreate;
    return HttpResponse.json<StatementRead>(
      makeStatement({
        period_start: body.period_start,
        period_end: body.period_end,
        note: body.note ?? null,
        line_items: body.line_items?.map((li, i) =>
          makeLineItem({
            id: `new-li-${i}`,
            type: li.type,
            category: li.category,
            label: li.label ?? null,
            amount_minor: li.amount_minor,
          }),
        ),
      }),
      { status: 201 },
    );
  }),
  http.patch(`${API}/statements/:id`, ({ params }) =>
    HttpResponse.json<StatementRead>(makeStatement({ id: params.id as string })),
  ),
  http.delete(`${API}/statements/:id`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${API}/statements/:id/line-items`, async ({ params, request }) => {
    const body = (await request.json()) as LineItemCreate;
    return HttpResponse.json<StatementRead>(
      makeStatement({
        id: params.id as string,
        line_items: [makeLineItem({ ...body, label: body.label ?? null })],
      }),
      { status: 201 },
    );
  }),
  http.patch(`${API}/statements/:id/line-items/:itemId`, ({ params }) =>
    HttpResponse.json<StatementRead>(makeStatement({ id: params.id as string })),
  ),
  http.delete(`${API}/statements/:id/line-items/:itemId`, ({ params }) =>
    HttpResponse.json<StatementRead>(makeStatement({ id: params.id as string })),
  ),

  http.get(`${API}/trend`, () => HttpResponse.json<TrendPoint[]>([])),
];

export const server = setupServer(...defaultHandlers);

// Convenience: build common override scenarios that several tests reuse.
export const scenarios = {
  /** API returns a 500 on the named GET endpoint. */
  failGet: (path: string) =>
    http.get(`${API}${path}`, () =>
      HttpResponse.json({ detail: "boom" }, { status: 500 }),
    ),
  /** API returns 404 on the named GET endpoint. */
  notFoundGet: (path: string) =>
    http.get(`${API}${path}`, () =>
      HttpResponse.json({ detail: "not found" }, { status: 404 }),
    ),
  /** API returns 422 on a POST/PATCH — used for validation paths. */
  failPost: (path: string) =>
    http.post(`${API}${path}`, () =>
      HttpResponse.json({ detail: "invalid" }, { status: 422 }),
    ),
};

export const apiUrl = (path: string) => `${API}${path}`;

export function statementsList(items: StatementSummary[]) {
  return http.get(`${API}/statements`, () =>
    HttpResponse.json<StatementSummary[]>(items),
  );
}

export function statementDetail(stmt: StatementRead) {
  return http.get(`${API}/statements/${stmt.id}`, () =>
    HttpResponse.json<StatementRead>(stmt),
  );
}

export function trendSeries(points: TrendPoint[]) {
  return http.get(`${API}/trend`, () => HttpResponse.json<TrendPoint[]>(points));
}

// Re-export factories tightly so suites can use a single import.
export { makeAssessment };
