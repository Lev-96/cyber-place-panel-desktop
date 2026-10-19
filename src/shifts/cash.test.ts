import { describe, expect, test } from "vitest";
import { centsOf, kindOf, parseCents, shiftAmount, toAmount } from "./cash";

describe("cash typed at the till", () => {
  test("reads the ways people type an amount", () => {
    expect(parseCents("47000")).toBe(4_700_000);
    expect(parseCents("47 000")).toBe(4_700_000);
    expect(parseCents("47000.5")).toBe(4_700_050);
    expect(parseCents("47000,50")).toBe(4_700_050);
    expect(parseCents("0")).toBe(0);
    expect(parseCents("99999999.99")).toBe(9_999_999_999);
  });

  test("refuses what is not an amount rather than guessing", () => {
    for (const bad of ["", "-5", "12.345", "abc", "1e3", "100000000", "1.2.3"]) {
      expect(parseCents(bad), bad).toBeNull();
    }
  });

  test("is exact where floats are not", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004.
    expect(toAmount(centsOf("0.10") + centsOf("0.20"))).toBe("0.30");
    expect(toAmount(-300000)).toBe("-3000.00");
  });

  test("the difference has the server's sign: counted minus expected", () => {
    expect(kindOf(centsOf("47000.00") - centsOf("50000.00"))).toBe("shortage");
    expect(kindOf(centsOf("52000.00") - centsOf("50000.00"))).toBe("surplus");
    expect(kindOf(0)).toBe("none");
  });
});

describe("a shift amount on screen", () => {
  const money = (n: number, o?: { minimumFractionDigits?: number }) => (o?.minimumFractionDigits ? n.toFixed(2) : String(Math.round(n)));

  test("keeps the cents when there are any: a 0.39 shortage is not shown as 0", () => {
    expect(shiftAmount(money, "-0.39")).toBe("-0.39");
    expect(shiftAmount(money, "2006.39")).toBe("2006.39");
  });

  test("whole amounts stay whole", () => {
    expect(shiftAmount(money, "52000.00")).toBe("52000");
  });
});
