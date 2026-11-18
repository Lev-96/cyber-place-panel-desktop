import { describe, expect, test } from "vitest";
import { monthParam, owedAmount, percentText, partnerChoices, termsLine } from "./partnerTerms";
import type { IPartner } from "@/api/partners";

const T: Record<string, string> = { "partners.termsPercent": "{0}% остаётся клубу", "partners.termsFixed": "{0} в месяц платит клубу" };
const t = (k: string) => T[k] ?? k;
const money = (n: number) => `${n} ֏`;

describe("partner terms in words (2026-11-18)", () => {
  test("a percent as people say it: trailing zeros dropped from the server's string", () => {
    expect(percentText("10.00")).toBe("10");
    expect(percentText("12.50")).toBe("12.5");
    expect(percentText("7.25")).toBe("7.25");
    expect(percentText("100")).toBe("100");
    expect(percentText("0.00")).toBe("0");
  });

  test("«10% остаётся клубу» / «50000 ֏ в месяц платит клубу»", () => {
    expect(termsLine({ terms: "percent", percent: "10.00", fixed_amount: null }, t, money)).toBe("10% остаётся клубу");
    expect(termsLine({ terms: "fixed", percent: null, fixed_amount: "50000.00" }, t, money)).toBe("50000 ֏ в месяц платит клубу");
  });

  test("what the partner owes is the server's negative share without its sign", () => {
    expect(owedAmount("-20000.00")).toBe("20000.00");
    expect(owedAmount("90000.00")).toBe("90000.00");
  });

  test("the month the settlement asks for", () => {
    expect(monthParam({ year: 2026, month: 3 })).toBe("2026-03");
    expect(monthParam({ year: 2026, month: 11 })).toBe("2026-11");
  });

  test("only active, not archived partners can be given a product; the product's own one is kept", () => {
    const p = (id: number, active: boolean, archived: boolean) => ({ id, active, archived } as IPartner);
    const list = [p(1, true, false), p(2, false, false), p(3, true, true)];
    expect(partnerChoices(list, null).map((x) => x.id)).toEqual([1]);
    expect(partnerChoices(list, 3).map((x) => x.id)).toEqual([1, 3]);
  });
});
