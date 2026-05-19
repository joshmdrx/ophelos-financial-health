import { Link } from "react-router-dom";

import { AssessmentCard } from "@/components/AssessmentCard";
import { DebtLoadCard } from "@/components/DebtLoadCard";
import { Empty } from "@/components/states/Empty";
import { ErrorState } from "@/components/states/ErrorState";
import { Loading } from "@/components/states/Loading";
import { useStatementList } from "@/hooks/useStatements";
import { formatMonthRange } from "@/lib/format";

export function Dashboard() {
  const { data, isLoading, isError, refetch } = useStatementList();

  if (isLoading) return <Loading what="your latest summary" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  // List is ordered newest-first by the API.
  const latest = data?.[0];

  if (!latest) {
    return (
      <>
        <header className="page-header">
          <h1>Welcome</h1>
          <p className="page-header__lede">
            Add a month of income and outgoings and we'll show you a clear
            picture of where you stand.
          </p>
        </header>
        <Empty
          title="Nothing logged yet"
          body="Once you've added your first statement, your overview will appear here."
          action={
            <Link className="btn" to="/statements">
              Add your first statement
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1>Your overview</h1>
        <p className="page-header__lede">
          Based on your most recent statement. The numbers below explain how we
          got there.
        </p>
      </header>
      <AssessmentCard
        assessment={latest.assessment}
        periodLabel={formatMonthRange(latest.period_start, latest.period_end)}
      />
      <div style={{ marginTop: 16 }}>
        <DebtLoadCard
          assessment={latest.assessment}
          periodLabel={formatMonthRange(latest.period_start, latest.period_end)}
          // Dashboard is read-only — the edit button only appears on
          // Statements/detail where the user has the editing context.
        />
      </div>
      <p style={{ marginTop: 16 }}>
        <Link to="/statements">See all your statements →</Link>
      </p>
    </>
  );
}
