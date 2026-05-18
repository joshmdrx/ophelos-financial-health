export function Loading({ what = "your information" }: { what?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="state__title">Just a moment</div>
      <p className="state__body">Loading {what}…</p>
    </div>
  );
}
