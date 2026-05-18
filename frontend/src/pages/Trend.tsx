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
import { formatMoneyFromPence } from "@/lib/format";
import type { AssessmentBand, TrendPoint } from "@/api";

const BAND_COLOR: Record<AssessmentBand, string> = {
  healthy: "var(--band-healthy-accent)",
  tight: "var(--band-tight-accent)",
  deficit: "var(--band-deficit-accent)",
  insufficient_data: "var(--band-insufficient-accent)",
};

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
        Income {formatMoneyFromPence(p.total_income_pence)}
        <br />
        Outgoings {formatMoneyFromPence(p.total_expenditure_pence)}
        <br />
        {p.surplus_pence >= 0 ? "Surplus" : "Shortfall"}{" "}
        {formatMoneyFromPence(Math.abs(p.surplus_pence))}
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

  // One point isn't really a 'trend' — show a friendlier hint than a single dot.
  const onlyOne = points.length === 1;

  const chartData = points.map((p) => ({
    ...p,
    label: shortMonth(p.period_end),
    surplus_pounds: p.surplus_pence / 100,
  }));

  return (
    <>
      <header className="page-header">
        <h1>Over time</h1>
        <p className="page-header__lede">
          The line shows your surplus (income minus outgoings) for each
          statement. Dots are coloured by how that month landed.
        </p>
      </header>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
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
              tickFormatter={(v) => `£${v}`}
            />
            <ReferenceLine
              y={0}
              stroke="var(--color-border-strong)"
              strokeDasharray="3 3"
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--color-border-strong)" }} />
            <Line
              type="monotone"
              dataKey="surplus_pounds"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={<BandedDot />}
              activeDot={{ r: 8 }}
              isAnimationActive={false}
            />
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
          Just one statement so far — once you have a couple, you'll see the
          shape of how things are changing.
        </p>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <h2 className="card__title">How to read this</h2>
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--color-text-muted)" }}>
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
      </section>
    </>
  );
}
