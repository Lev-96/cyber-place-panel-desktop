import { describe, expect, test } from "vitest";
import { paymentText } from "./paymentText";

const t = (k: string) => ({ "session.payCash": "Наличные", "session.payCard": "Карта", "session.payOther": "Другой", "pay.splitSummary": "Раздельно" } as Record<string, string>)[k] ?? k;
const money = (n: number) => `${n}֏`;

describe("a paid bill in words", () => {
  test("a split: each part with its amount, and how", () => {
    expect(paymentText({ payment_method: "split", payments: [
      { method: "cash", amount: "2000.00", note: "3000 картой" }, { method: "card", amount: 3000, note: "3000 картой" },
    ] }, t, money)).toBe("Раздельно: Наличные 2000֏ · Карта 3000֏ (3000 картой)");
  });
  test("one method, as before; other with its text; nothing recorded is null", () => {
    expect(paymentText({ payment_method: "card", payments: [] }, t, money)).toBe("Карта");
    expect(paymentText({ payment_method: "other", payment_method_other: "Idram" }, t, money)).toBe("Другой: Idram");
    expect(paymentText({ payment_method: null }, t, money)).toBeNull();
    expect(paymentText({ payment_method: "split", payments: [] }, t, money)).toBe("Раздельно");
  });
});
