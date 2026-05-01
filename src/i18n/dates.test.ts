import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMonth, formatTime } from "./dates";

// Dates are formatted in the runner's local TZ. The tests construct dates
// via the local-time `Date` constructor so the assertions are stable
// regardless of where CI runs — the calendar fields we compare are exactly
// the ones we passed in.

describe("formatDate", () => {
  it("returns DD.MM.YYYY for a valid date", () => {
    expect(formatDate(new Date(2026, 4, 1, 12, 0))).toBe("01.05.2026");
    expect(formatDate(new Date(2025, 11, 31, 23, 59))).toBe("31.12.2025");
  });

  it("zero-pads single digits", () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe("01.01.2026");
    expect(formatDate(new Date(2026, 8, 9))).toBe("09.09.2026");
  });

  it("accepts ISO strings", () => {
    // Construct from the same wall-clock instant the formatter will read.
    const iso = new Date(2026, 4, 1, 0, 0, 0).toISOString();
    expect(formatDate(iso)).toBe("01.05.2026");
  });

  it("returns placeholder for null / undefined / empty / invalid", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatTime", () => {
  it("returns HH:MM with zero-padding", () => {
    expect(formatTime(new Date(2026, 4, 1, 9, 5))).toBe("09:05");
    expect(formatTime(new Date(2026, 4, 1, 23, 55))).toBe("23:55");
    expect(formatTime(new Date(2026, 4, 1, 0, 0))).toBe("00:00");
  });

  it("returns placeholder for invalid input", () => {
    expect(formatTime(null)).toBe("—");
    expect(formatTime("invalid")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("combines date and time", () => {
    expect(formatDateTime(new Date(2026, 4, 1, 23, 55))).toBe("01.05.2026 23:55");
  });

  it("returns placeholder for invalid input", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("formatMonth", () => {
  it("returns MM.YYYY", () => {
    expect(formatMonth(new Date(2026, 4, 1))).toBe("05.2026");
    expect(formatMonth(new Date(2026, 0, 15))).toBe("01.2026");
  });

  it("returns placeholder for invalid input", () => {
    expect(formatMonth(null)).toBe("—");
  });
});
