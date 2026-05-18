import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// Force the API client to point at the same origin our MSW handlers use, and
// look fetch up lazily on every call. client-fetch captures globalThis.fetch
// at config time, so without the wrapper it'd hold a reference to the
// pre-MSW fetch and our handlers would never see a request.
import { client } from "@/api/services.gen";
client.setConfig({
  baseUrl: "http://localhost:8000",
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom has no ResizeObserver — recharts depends on it. Stub a no-op so charts
// can mount in tests; specific tests opt into deterministic dimensions via
// the Recharts mock helper.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}
