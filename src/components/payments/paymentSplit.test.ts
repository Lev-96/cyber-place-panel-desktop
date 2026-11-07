import { describe, expect, test } from "vitest";
import { checkPayment, emptyPaymentDraft, fillRemaining, paymentBody } from "./paymentSplit";

const split = (amounts: Partial<Record<"cash" | "card" | "other", string>>, note = "картой и наличными") => ({
  ...emptyPaymentDraft(), split: true, note, amounts: { cash: "", card: "", other: "", ...amounts },
});

describe("how a bill was paid", () => {
  test("one method: the body every server has always taken", () => {
    const d = emptyPaymentDraft("card");
    const c = checkPayment(500000, d);
    expect(c.ok).toBe(true);
    expect(paymentBody(d, c)).toEqual({ payment_method: "card" });
  });

  test("«other» alone must say what it was", () => {
    const d = { ...emptyPaymentDraft("other"), note: "  " };
    expect(checkPayment(100, d)).toMatchObject({ ok: false, problem: "note" });
    const named = { ...d, note: "Idram" };
    expect(paymentBody(named, checkPayment(100, named))).toEqual({ payment_method: "other", payment_method_other: "Idram" });
  });

  test("split: parts that add up to the bill, to the cent, with a note", () => {
    const d = split({ card: "3000", cash: "1999.50", other: "0.50" });
    const c = checkPayment(500000, d);
    expect(c).toMatchObject({ ok: true, problem: null, remainingCents: 0 });
    expect(paymentBody(d, c)).toEqual({
      payments: [{ method: "cash", amount: 1999.5 }, { method: "card", amount: 3000 }, { method: "other", amount: 0.5 }],
      payment_note: "картой и наличными",
    });
  });

  test("split: too little, too much, one part, an unreadable part, no note", () => {
    expect(checkPayment(500000, split({ card: "3000", cash: "1000" }))).toMatchObject({ ok: false, problem: "sum", remainingCents: 100000 });
    expect(checkPayment(500000, split({ card: "3000", cash: "3000" }))).toMatchObject({ ok: false, problem: "sum", remainingCents: -100000 });
    expect(checkPayment(500000, split({ card: "5000" }))).toMatchObject({ ok: false, problem: "parts" });
    expect(checkPayment(500000, split({ card: "5000", cash: "0" }))).toMatchObject({ ok: false, problem: "parts" });
    expect(checkPayment(500000, split({ card: "30,00.5", cash: "2000" }))).toMatchObject({ ok: false, problem: "invalid" });
    expect(checkPayment(500000, split({ card: "3000", cash: "2000" }, " "))).toMatchObject({ ok: false, problem: "note" });
  });

  test("an amount converted from another display currency is rounded to the cent", () => {
    expect(checkPayment(500000, split({ card: "2999.996", cash: "2000" }))).toMatchObject({ ok: true, remainingCents: 0 });
  });

  test("«the rest here» fills what is still due, never below zero", () => {
    expect(fillRemaining(500000, split({ card: "3000" }), "cash").amounts.cash).toBe("2000.00");
    expect(fillRemaining(500000, split({ card: "6000" }), "cash").amounts.cash).toBe("");
  });
});
