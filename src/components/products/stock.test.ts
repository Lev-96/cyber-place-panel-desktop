import { describe, expect, it } from "vitest";
import { parseQuantity, signedDelta, stockChangeText, stockNumber, stockWarningText, stockWarningsOf } from "./stock";

/** Stock on screen (2026-11-16): written down, never worked out. */
describe("parseQuantity", () => {
  it("reads nothing typed as «not counted», a whole number as itself", () => {
    expect(parseQuantity("")).toEqual({ kind: "empty" });
    expect(parseQuantity("   ")).toEqual({ kind: "empty" });
    expect(parseQuantity("10")).toEqual({ kind: "ok", value: 10 });
    expect(parseQuantity(" 1 000 ")).toEqual({ kind: "ok", value: 1000 });
    expect(parseQuantity("0")).toEqual({ kind: "ok", value: 0 });
    expect(parseQuantity("999999")).toEqual({ kind: "ok", value: 999999 });
  });

  it("refuses what is not a count", () => {
    for (const bad of ["-1", "1.5", "1,5", "ten", "1e3", "1000000", "+5"]) {
      expect(parseQuantity(bad)).toEqual({ kind: "invalid" });
    }
    // A receipt is at least one.
    expect(parseQuantity("0", 1)).toEqual({ kind: "invalid" });
    expect(parseQuantity("1", 1)).toEqual({ kind: "ok", value: 1 });
  });
});

describe("the words", () => {
  it("writes counts and changes with a real minus sign", () => {
    expect(stockNumber(15)).toBe("15");
    expect(stockNumber(-2)).toBe("−2");
    expect(signedDelta(10)).toBe("+10");
    expect(signedDelta(-3)).toBe("−3");
    expect(signedDelta(0)).toBe("0");
  });

  it("says a change as «5 → 15 (+10)», from and to «not counted» without a delta", () => {
    expect(stockChangeText({ before: 5, after: 15, delta: 10 }, "Без учёта")).toBe("5 → 15 (+10)");
    expect(stockChangeText({ before: 7, after: 6, delta: -1 }, "Без учёта")).toBe("7 → 6 (−1)");
    expect(stockChangeText({ before: null, after: 10, delta: 10 }, "Без учёта")).toBe("Без учёта → 10");
    expect(stockChangeText({ before: 6, after: null, delta: -6 }, "Без учёта")).toBe("6 → Без учёта");
    expect(stockChangeText({ before: 6, after: 6, delta: 0 }, "Без учёта")).toBe("6 → 6");
  });

  it("names every product a sale took below zero, by the viewer's name when it has one", () => {
    const warnings = [{ product_id: 1, name: "Кола", stock: -2 }, { product_id: 2, name: "Chips", stock: -1 }];
    expect(stockWarningText(warnings, "Ниже нуля: {0}.")).toBe("Ниже нуля: Кола −2, Chips −1.");
    expect(stockWarningText(warnings, "Below zero: {0}.", (id) => (id === 2 ? "Чипсы" : null))).toBe("Below zero: Кола −2, Чипсы −1.");
    expect(stockWarningText([], "{0}")).toBeNull();
  });

  it("reads the server's warnings, and none from an answer without them", () => {
    expect(stockWarningsOf({ order: {}, stock_warnings: [{ product_id: 1, name: "Кола", stock: -2 }] })).toEqual([{ product_id: 1, name: "Кола", stock: -2 }]);
    expect(stockWarningsOf({ order: {} })).toEqual([]);
    expect(stockWarningsOf(null)).toEqual([]);
    expect(stockWarningsOf({ stock_warnings: [{ product_id: "1" }, "x"] })).toEqual([]);
  });
});
