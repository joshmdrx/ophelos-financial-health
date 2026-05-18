/**
 * Small inline banner used to surface mutation failures next to the form that
 * caused them. Pulls the API's ``detail`` string when present (FastAPI sends a
 * useful, human-readable message for 4xx) and falls back to a generic but
 * non-alarming line otherwise.
 */
function extractDetail(err: unknown): string | null {
  if (err && typeof err === "object" && "detail" in err) {
    const d = (err as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return null;
}

export function InlineError({
  error,
  fallback = "We couldn't save that. Have a look at the values and try again — your other information is safe.",
}: {
  error: unknown;
  fallback?: string;
}) {
  if (!error) return null;
  const detail = extractDetail(error);
  return (
    <p role="alert" className="form-error">
      {detail ?? fallback}
    </p>
  );
}
