import { describe, expect, test } from "vitest";
import { compactCount, ratingAverage } from "./ratingFormat";

describe("rating counts, short (2026-11-27, owner)", () => {
  test.each([
    [0, "0"], [1, "1"], [999, "999"], [1000, "1K"], [1500, "1.5K"], [1999, "1.9K"], [12_345, "12.3K"],
    [999_999, "999.9K"], [1_000_000, "1M"], [2_500_000, "2.5M"],
  ])("%d → %s", (n, s) => { expect(compactCount(n)).toBe(s); });

  test("no average while nobody rated", () => {
    expect(ratingAverage({ average: null, count: 0 })).toBeNull();
    expect(ratingAverage({ average: "4.5", count: 2 })).toBe("4.5");
    expect(ratingAverage(undefined)).toBeNull();
  });
});
