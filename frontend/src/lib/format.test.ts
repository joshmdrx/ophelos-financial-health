import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";

/**
 * formatMoney sits at the boundary where the backend's currency-agnostic
 * integers become customer-facing strings. The tests pin two things:
 *  - each allowlisted currency produces the right symbol + separators,
 *  - the minor → major conversion is correct (we currently allow only
 *    2-digit-minor currencies, so 100 → 1.00 across the board).
 *
 * Locale assertions use en-GB (the default) where it matters.
 */
describe("formatMoney", () => {
  it("formats GBP with the £ symbol", () => {
    expect(formatMoney(123456, "GBP")).toBe("£1,234.56");
  });

  it("formats EUR with the € symbol", () => {
    expect(formatMoney(123456, "EUR")).toBe("€1,234.56");
  });

  it("formats USD with the US$ symbol in en-GB", () => {
    // en-GB disambiguates USD as "US$" — that's the right behaviour for a
    // UK-first product showing the user a non-home currency.
    expect(formatMoney(123456, "USD")).toBe("US$1,234.56");
  });

  it("formats AUD with the A$ symbol in en-GB", () => {
    expect(formatMoney(123456, "AUD")).toBe("A$1,234.56");
  });

  it("renders whole-major amounts with two decimal places", () => {
    expect(formatMoney(100, "GBP")).toBe("£1.00");
  });

  it("renders zero as the currency's zero", () => {
    expect(formatMoney(0, "GBP")).toBe("£0.00");
  });

  it("renders negative amounts with the locale's negative form", () => {
    // Intl uses parentheses or a minus sign depending on locale; we don't
    // pin the exact format, only that it carries a sign.
    const formatted = formatMoney(-5000, "GBP");
    expect(formatted).toMatch(/[-(]/);
    expect(formatted).toMatch(/50\.00/);
  });

  it("uses the requested locale for separators", () => {
    // de-DE swaps the thousands and decimal separators.
    expect(formatMoney(123456, "EUR", "de-DE")).toMatch(/1\.234,56/);
  });
});
