import type { Currency } from "@/api";

/**
 * Minor-unit digits per currency. All currencies in the API allowlist
 * currently have 2 digits, so this is uniform — but the map is the right
 * shape if we ever add JPY (0) or BHD (3).
 */
const MINOR_DIGITS: Record<Currency, number> = {
  GBP: 2,
  EUR: 2,
  USD: 2,
  AUD: 2,
};

/**
 * Format an amount stored in minor units (e.g. pence, cents) into a localised
 * currency string. The minor → major conversion is currency-aware: passing
 * 12345 minor units with GBP gives £123.45, but with JPY would give ¥12,345.
 *
 * Locale defaults to "en-GB" — overrideable per call when we eventually wire
 * up multi-locale support.
 */
export function formatMoney(
  amountMinor: number,
  currency: Currency,
  locale: string = "en-GB",
): string {
  const digits = MINOR_DIGITS[currency];
  const major = amountMinor / Math.pow(10, digits);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(major);
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
