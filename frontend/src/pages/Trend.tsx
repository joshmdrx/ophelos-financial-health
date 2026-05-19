import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Dot,
} from "recharts";

import { BandPill } from "@/components/BandPill";
import { Empty } from "@/components/states/Empty";
import { ErrorState } from "@/components/states/ErrorState";
import { Loading } from "@/components/states/Loading";
import { useTrend } from "@/hooks/useStatements";
import { BAND_META } from "@/lib/bands";
import { formatMoney } from "@/lib/format";
import type { AssessmentBand, Currency, TrendPoint } from "@/api";

const BAND_COLOR: Record<AssessmentBand, string> = {
  healthy: "var(--band-healthy-accent)",
  tight: "var(--band-tight-accent)",
  deficit: "var(--band-deficit-accent)",
  insufficient_data: "var(--band-insufficient-accent)",
};

// Visually distinct from surplus — same warm palette but a slate-ish hue
// so the two lines don't fight. Debt is a stock; surplus is a flow.
const DEBT_LINE_COLOR = "var(--color-text-muted)";

function shortMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

interface TooltipPayloadEntry {
  payload: TrendPoint;
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;
  const p: TrendPoint = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "var(--shadow-md)",
        minWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {new Date(p.period_end).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        })}
      </div>
      <div style={{ margin: "4px 0" }}>
        <BandPill band={p.band} />
      </div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
        Income {formatMoney(p.income_minor, p.currency)}
        <br />
        Outgoings {formatMoney(p.expenditure_minor, p.currency)}
        <br />
        {p.surplus_minor >= 0 ? "Surplus" : "Shortfall"}{" "}
        {formatMoney(Math.abs(p.surplus_minor), p.currency)}
        {p.outstanding_debt_minor !== null
          && p.outstanding_debt_minor !== undefined && (
          <>
            <br />
            Outstanding debt{" "}
            {formatMoney(p.outstanding_debt_minor, p.currency)}
          </>
        )}
      </div>
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: TrendPoint;
}

function BandedDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return null;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={6}
      fill={BAND_COLOR[payload.band]}
      stroke="var(--color-surface)"
      strokeWidth={2}
    />
  );
}

export function Trend() {
  const { data, isLoading, isError, refetch } = useTrend();
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [showDebt, setShowDebt] = useState(true);

  // The set of currencies the user actually has statements in — drives the
  // filter dropdown so we never offer one with no data behind it.
  const availableCurrencies = useMemo<Currency[]>(() => {
    if (!data) return [];
    const seen: Currency[] = [];
    for (const p of data) {
      if (!seen.includes(p.currency)) seen.push(p.currency);
    }
    return seen;
  }, [data]);

  // Default to the latest statement's currency (data is oldest-first, so the
  // last entry is most recent).
  const effectiveCurrency: Currency | null =
    currency ??
    (availableCurrencies.length > 0
      ? data![data!.length - 1].currency
      : null);

  if (isLoading) return <Loading what="your trend" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const points = data ?? [];

  if (points.length === 0) {
    return (
      <>
        <header className="page-header">
          <h1>Over time</h1>
          <p className="page-header__lede">
            As you add statements, this view shows how your position is moving
            month to month.
          </p>
        </header>
        <Empty
          title="Nothing to chart yet"
          body="Once you've logged a statement or two, you'll see your surplus over time here."
        />
      </>
    );
  }

  // Honest UX: don't mix currencies on one axis. Filter, don't convert.
  const filtered = effectiveCurrency
    ? points.filter((p) => p.currency === effectiveCurrency)
    : points;
  const onlyOne = filtered.length === 1;

  const chartData = filtered.map((p) => ({
    ...p,
    label: shortMonth(p.period_end),
    surplus_major: p.surplus_minor / 100,
    // Recharts ignores null y-values, leaving a gap. That's exactly what we
    // want for "balance not recorded" — don't fabricate a zero.
    debt_major:
      p.outstanding_debt_minor !== null
        && p.outstanding_debt_minor !== undefined
        ? p.outstanding_debt_minor / 100
        : null,
  }));

  // Hide the debt toggle entirely if none of the (filtered) statements have a
  // balance — no point showing a toggle for an empty line.
  const anyDebtRecorded = filtered.some(
    (p) =>
      p.outstanding_debt_minor !== null && p.outstanding_debt_minor !== undefined,
  );

  return (
    <>
      <header className="page-header">
        <h1>Over time</h1>
        <p className="page-header__lede">
          The line shows your surplus (income minus outgoings) for each
          statement. Dots are coloured by how that month landed.
        </p>
      </header>

      {(availableCurrencies.length > 1 || anyDebtRecorded) && (
        <div
          className="toolbar"
          style={{ justifyContent: "flex-start", gap: 16, flexWrap: "wrap" }}
        >
          {availableCurrencies.length > 1 && (
            <>
              <label htmlFor="trend-currency" style={{ fontSize: "0.9rem" }}>
                Showing
              </label>
              <select
                id="trend-currency"
                value={effectiveCurrency ?? ""}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span
                style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}
              >
                Statements in other currencies aren't mixed in.
              </span>
            </>
          )}
          {anyDebtRecorded && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.9rem",
                color: "var(--color-text-muted)",
                marginLeft: "auto",
              }}
            >
              <input
                type="checkbox"
                checked={showDebt}
                onChange={(e) => setShowDebt(e.target.checked)}
                aria-label="Show outstanding debt line"
              />
              Show outstanding debt
            </label>
          )}
        </div>
      )}

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            // Wider left margin makes room for the currency-formatted y-axis
            // ticks (e.g. "£1,400.00") which would otherwise be clipped.
            margin={{ top: 8, right: 24, left: 32, bottom: 8 }}
          >
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--color-text-subtle)"
              tickLine={false}
            />
            <YAxis
              stroke="var(--color-text-subtle)"
              tickLine={false}
              tickFormatter={(v) =>
                effectiveCurrency
                  ? formatMoney(Math.round(v * 100), effectiveCurrency)
                  : String(v)
              }
            />
            <ReferenceLine
              y={0}
              stroke="var(--color-border-strong)"
              strokeDasharray="3 3"
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: "var(--color-border-strong)" }}
            />
            <Line
              type="monotone"
              dataKey="surplus_major"
              name="Surplus"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={<BandedDot />}
              activeDot={{ r: 8 }}
              isAnimationActive={false}
            />
            {showDebt && anyDebtRecorded && (
              <Line
                type="monotone"
                dataKey="debt_major"
                name="Outstanding debt"
                stroke={DEBT_LINE_COLOR}
                strokeWidth={2}
                strokeDasharray="5 3"
                // Connect across gaps in case a statement has no balance
                // recorded — but a *missing* point itself still shows as a
                // gap (null y).
                connectNulls={false}
                dot={{ r: 4, fill: DEBT_LINE_COLOR }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {onlyOne && (
        <p
          style={{
            color: "var(--color-text-muted)",
            marginTop: 16,
            fontSize: 14,
          }}
        >
          Just one statement in this currency so far — once you have a couple,
          you'll see the shape of how things are changing.
        </p>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <h2 className="card__title">How to read this</h2>
        <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
          The solid line is your monthly <strong>surplus</strong>. Dot colour
          shows how that month landed:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "var(--color-text-muted)",
          }}
        >
          <li>
            <strong style={{ color: "var(--band-healthy-fg)" }}>
              {BAND_META.healthy.label}
            </strong>{" "}
            — comfortable surplus.
          </li>
          <li>
            <strong style={{ color: "var(--band-tight-fg)" }}>
              {BAND_META.tight.label}
            </strong>{" "}
            — income just covers outgoings.
          </li>
          <li>
            <strong style={{ color: "var(--band-deficit-fg)" }}>
              {BAND_META.deficit.label}
            </strong>{" "}
            — outgoings ahead of income.
          </li>
          <li>
            <strong style={{ color: "var(--band-insufficient-fg)" }}>
              {BAND_META.insufficient_data.label}
            </strong>{" "}
            — not enough information yet.
          </li>
        </ul>
        {anyDebtRecorded && (
          <p
            style={{
              color: "var(--color-text-muted)",
              marginTop: 12,
              marginBottom: 0,
            }}
          >
            The dashed line is your <strong>outstanding debt</strong> over
            time. Months without a recorded balance show as a gap so the
            chart never invents a zero. Manageable, heavy, and significant
            levels are described next to each statement.
          </p>
        )}
      </section>
    </>
  );
}
