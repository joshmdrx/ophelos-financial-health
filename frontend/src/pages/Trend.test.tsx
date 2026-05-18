/**
 * Trend chart tests.
 *
 * Recharts' ResponsiveContainer measures its parent at mount time. jsdom
 * doesn't lay anything out, so without a stub the chart never renders. We
 * mock ResponsiveContainer to pass children straight through inside a
 * fixed-size box — enough for the rest of the chart to compute positions
 * and emit the SVG we want to assert against.
 */
import { screen, within } from "@testing-library/react";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    // Recharts charts need explicit width/height to render their SVG. The
    // real ResponsiveContainer measures the DOM, which jsdom can't do —
    // so we clone the chart child and inject fixed dimensions.
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement, { width: 800, height: 320 })
        : null,
  };
});

import { Trend } from "@/pages/Trend";
import { makeTrendPoint } from "@/test/factories";
import { scenarios, server, trendSeries } from "@/test/server";
import { renderWithProviders } from "@/test/wrappers";

function chartDots(container: HTMLElement): SVGCircleElement[] {
  // The line's dots are <circle> elements inside the recharts dot layer.
  // activeDot circles only appear on hover, so the non-hover state has one
  // circle per data point.
  return Array.from(
    container.querySelectorAll<SVGCircleElement>(".recharts-line-dots circle"),
  );
}

describe("Trend page", () => {
  it("shows the empty state when the API returns no points", async () => {
    renderWithProviders(<Trend />);
    expect(
      await screen.findByText(/nothing to chart yet/i),
    ).toBeInTheDocument();
  });

  it("shows a retryable error state when the API fails", async () => {
    server.use(scenarios.failGet("/trend"));
    renderWithProviders(<Trend />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /we couldn't load this/i,
    );
  });

  it("renders one dot per point and labels the legend", async () => {
    server.use(
      trendSeries([
        makeTrendPoint({ statement_id: "1", period_end: "2026-01-31", band: "healthy" }),
        makeTrendPoint({ statement_id: "2", period_end: "2026-02-28", band: "tight" }),
        makeTrendPoint({ statement_id: "3", period_end: "2026-03-31", band: "deficit" }),
      ]),
    );
    const { container } = renderWithProviders(<Trend />);

    await screen.findByText(/over time/i);

    // Wait for the line to mount; dots appear after the chart's first paint.
    await new Promise((r) => setTimeout(r, 50));
    expect(chartDots(container).length).toBe(3);

    // The legend explains each band — keeps the chart self-describing.
    const legend = screen.getByText(/how to read this/i).closest("section")!;
    expect(within(legend).getByText("Healthy")).toBeInTheDocument();
    expect(within(legend).getByText("Tight")).toBeInTheDocument();
    expect(within(legend).getByText("Stretched")).toBeInTheDocument();
  });

  it("colours each dot by its band", async () => {
    server.use(
      trendSeries([
        makeTrendPoint({ statement_id: "h", band: "healthy" }),
        makeTrendPoint({ statement_id: "t", band: "tight", period_end: "2026-02-28" }),
        makeTrendPoint({ statement_id: "d", band: "deficit", period_end: "2026-03-31" }),
        makeTrendPoint({ statement_id: "i", band: "insufficient_data", period_end: "2026-04-30" }),
      ]),
    );
    const { container } = renderWithProviders(<Trend />);

    await screen.findByText(/over time/i);
    await new Promise((r) => setTimeout(r, 50));

    const fills = chartDots(container).map((d) => d.getAttribute("fill"));
    expect(fills).toEqual([
      "var(--band-healthy-accent)",
      "var(--band-tight-accent)",
      "var(--band-deficit-accent)",
      "var(--band-insufficient-accent)",
    ]);
  });

  it("shows a friendly hint when there's only one statement so far", async () => {
    server.use(trendSeries([makeTrendPoint({ statement_id: "only" })]));
    renderWithProviders(<Trend />);

    expect(
      await screen.findByText(/just one statement so far/i),
    ).toBeInTheDocument();
  });

  it("includes insufficient_data points in the series rather than dropping them", async () => {
    // An empty month is meaningful — the trend should expose the gap.
    server.use(
      trendSeries([
        makeTrendPoint({ statement_id: "jan", band: "healthy" }),
        makeTrendPoint({
          statement_id: "feb",
          band: "insufficient_data",
          total_income_pence: 0,
          total_expenditure_pence: 0,
          surplus_pence: 0,
          period_end: "2026-02-28",
        }),
        makeTrendPoint({ statement_id: "mar", band: "healthy", period_end: "2026-03-31" }),
      ]),
    );
    const { container } = renderWithProviders(<Trend />);

    await screen.findByText(/over time/i);
    await new Promise((r) => setTimeout(r, 50));
    expect(chartDots(container).length).toBe(3);
  });
});
