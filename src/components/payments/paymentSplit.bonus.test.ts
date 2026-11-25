import { describe, expect, test } from "vitest";
import { billPaymentBody, checkPayment, emptyPaymentDraft, fillRemaining, paymentBody, useAllBonuses } from "./paymentSplit";

describe("paying with a Club Card's bonuses (2026-11-25)", () => {
  test("enough bonuses: one method, bonus, never more than the bill", () => {
    const { draft, shortCents } = useAllBonuses(100000, emptyPaymentDraft("cash"), 250000);
    expect(shortCents).toBe(0);
    expect(billPaymentBody(draft, checkPayment(100000, draft))).toEqual({ payment_method: "bonus" });
  });

  test("too few: every bonus, the rest on cash, the shortfall said — 1 000 bill, 300 on the card", () => {
    const { draft, shortCents } = useAllBonuses(100000, emptyPaymentDraft("cash"), 30000);
    expect(shortCents).toBe(70000);
    const check = checkPayment(100000, draft);
    expect(check.ok).toBe(true);
    expect(billPaymentBody(draft, check)).toEqual({ payments: [{ method: "cash", amount: 700 }, { method: "bonus", amount: 300 }] });
  });

  test("an empty card spends nothing and puts the whole bill on cash", () => {
    const { draft, shortCents } = useAllBonuses(50000, emptyPaymentDraft("cash"), 0);
    expect(shortCents).toBe(50000);
    expect(billPaymentBody(draft, checkPayment(50000, draft))).toEqual({ payment_method: "cash" });
  });

  test("«Остаток сюда» on the bonus row fills what is still due", () => {
    let d = { ...emptyPaymentDraft("cash"), split: true, amounts: { cash: "400", card: "" } };
    d = fillRemaining(100000, d, "bonus");
    expect(d.bonus).toBe("600.00");
    expect(checkPayment(100000, d).remainingCents).toBe(0);
  });

  test("a screen that never takes bonuses refuses to send one", () => {
    const d = { ...emptyPaymentDraft("cash"), method: "bonus" as const };
    expect(() => paymentBody(d, checkPayment(1000, d))).toThrow();
    const plain = emptyPaymentDraft("card");
    expect(paymentBody(plain, checkPayment(1000, plain))).toEqual({ payment_method: "card" });
  });

  test("a draft without bonuses sends exactly what it sent before", () => {
    const d = { ...emptyPaymentDraft("cash"), split: true, amounts: { cash: "300", card: "700" } };
    expect(billPaymentBody(d, checkPayment(100000, d))).toEqual({ payments: [{ method: "cash", amount: 300 }, { method: "card", amount: 700 }] });
  });
});
