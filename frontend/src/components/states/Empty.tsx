import type { ReactNode } from "react";

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <div className="state__title">{title}</div>
      <p className="state__body">{body}</p>
      {action}
    </div>
  );
}
