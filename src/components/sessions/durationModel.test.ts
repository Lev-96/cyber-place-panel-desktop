import { describe, expect, test } from "vitest";
import { amountIn, minutesOf } from "./durationModel";

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
