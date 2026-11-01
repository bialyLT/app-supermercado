import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatDateTime, formatDateTimeLocal, formatQuantity, formatTime, parseDateTimeLocal } from "../src/client/presentation";

describe("presentation helpers", () => {
  const instant = "2026-01-15T02:30:00.000Z";

  it("formats timestamps in the branch timezone without changing the source", () => {
    expect(formatDate(instant)).toBe("14/1/26");
    expect(formatTime(instant)).toBe("23:30");
    expect(formatDateTime(instant)).toBe("14/1/26, 23:30");
  });

  it("formats decimal quantities and money without floating point conversion", () => {
    expect(formatQuantity("12.500", 3)).toBe("12.5");
    expect(formatCurrency("1234567.5")).toBe("$1.234.567,50");
    expect(formatCurrency("10.00", "USD")).toBe("US$10,00");
    expect(formatCurrency("1234567.5", "USD", "en-US")).toBe("$1,234,567.50");
  });

  it("round-trips datetime-local values in the branch timezone", () => {
    expect(formatDateTimeLocal(instant)).toBe("2026-01-14T23:30");
    expect(parseDateTimeLocal("2026-01-14T23:30")).toBe(instant);
  });
});
