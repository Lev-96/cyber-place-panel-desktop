import { describe, expect, test } from "vitest";
import { bonusAmountText } from "./bonusAmount";

const money = (v: number, o?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) =>
  v.toLocaleString("en-US", { minimumFractionDigits: o?.minimumFractionDigits ?? 0, maximumFractionDigits: o?.maximumFractionDigits ?? 0 });

describe("bonusAmountText — a card's bonuses 1:1 (2026-11-25)", () => {
  test("cents are kept, never rounded", () => {
    expect(bonusAmountText(money, "43.89")).toBe("43.89");
    expect(bonusAmountText(money, "193.10")).toBe("193.10");
    expect(bonusAmountText(money, "0.50")).toBe("0.50");
  });
  test("a whole sum has no .00; nonsense is 0", () => {
    expect(bonusAmountText(money, "300.00")).toBe("300");
    expect(bonusAmountText(money, "abc")).toBe("0");
  });
});
