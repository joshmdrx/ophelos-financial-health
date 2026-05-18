export function ErrorState({
  title = "We couldn't load this",
  body = "Something went wrong on our side. It's not your fault — please try again in a moment.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state" role="alert">
      <div className="state__title">{title}</div>
      <p className="state__body">{body}</p>
      {onRetry && (
        <button className="btn btn--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
