const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

export function formatMoneyFromPence(pence: number): string {
  return gbp.format(pence / 100);
}

export function formatMonthRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const fmtMonth = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (sameMonth) return fmtMonth(s);
  return `${fmtMonth(s)} – ${fmtMonth(e)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
