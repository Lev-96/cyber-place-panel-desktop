import { describe, expect, test } from "vitest";
import { amountIn, minutesOf, clockOf } from "./durationModel";
import { isNextDay } from "./ClockTimeField";

/** One length, two units: what "2" means is decided by the unit beside it. */
describe("minutesOf", () => {
  test.each([
    ["2", "hours", 120],
    ["1.5", "hours", 90],
    ["1,5", "hours", 90],
    ["0.25", "hours", 15],
    ["30", "minutes", 30],
    ["180", "minutes", 180],
    ["10", "hours", 600],
  ] as const)("%s %s is %i minutes", (amount, unit, minutes) => {
    expect(minutesOf(amount, unit)).toBe(minutes);
  });

  test.each([
    ["", "hours"], ["  ", "minutes"], ["0", "minutes"], ["-1", "hours"], ["abc", "hours"],
    ["1.5", "minutes"], ["0.33", "hours"], ["601", "minutes"], ["10.5", "hours"],
  ] as const)("%j %s means nothing the server would take", (amount, unit) => {
    expect(minutesOf(amount, unit)).toBeNull();
  });
});

describe("amountIn", () => {
  test("keeps the length across a unit switch", () => {
    expect(amountIn("2", "hours", "minutes")).toBe("120");
    expect(amountIn("90", "minutes", "hours")).toBe("1.5");
    expect(amountIn("45", "minutes", "hours")).toBe("0.75");
    expect(amountIn("60", "minutes", "minutes")).toBe("60");
  });

  test("leaves what means nothing yet as typed", () => {
    expect(amountIn("", "hours", "minutes")).toBe("");
    expect(amountIn("abc", "minutes", "hours")).toBe("abc");
  });
});

describe("clockOf — the time a plan runs until (2026-10-26)", () => {
  test("a 24-hour time in the server's form", () => {
    expect(clockOf("00:40")).toBe("00:40");
    expect(clockOf("0:40")).toBe("00:40");
    expect(clockOf("23:59")).toBe("23:59");
    expect(clockOf(" 9.05 ")).toBe("09:05");
  });

  test("nothing it would refuse", () => {
    for (const bad of ["", "24:00", "25:80", "12:60", "9", "0940", "12:5", "12:00:00", "-1:00", "ab:cd"]) {
      expect(clockOf(bad)).toBeNull();
    }
  });
});

describe("isNextDay", () => {
  test("an end after midnight is tomorrow, the same evening is today", () => {
    const now = new Date(2026, 9, 26, 23, 50);
    expect(isNextDay(new Date(2026, 9, 27, 0, 40).toISOString(), now)).toBe(true);
    expect(isNextDay(new Date(2026, 9, 26, 23, 59).toISOString(), now)).toBe(false);
  });
});
