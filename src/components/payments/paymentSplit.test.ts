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

  test("«other» needs no words (2026-11-15, owner); its text is sent only when typed", () => {
    const d = { ...emptyPaymentDraft("other"), note: "  " };
    const c = checkPayment(100, d);
    expect(c).toMatchObject({ ok: true, problem: null });
    expect(paymentBody(d, c)).toEqual({ payment_method: "other" });
    const named = { ...d, note: " Idram " };
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

  test("split: too little, too much, nothing typed, an unreadable part", () => {
    expect(checkPayment(500000, split({ card: "3000", cash: "1000" }))).toMatchObject({ ok: false, problem: "sum", remainingCents: 100000 });
    expect(checkPayment(500000, split({ card: "3000", cash: "3000" }))).toMatchObject({ ok: false, problem: "sum", remainingCents: -100000 });
    expect(checkPayment(500000, split({}))).toMatchObject({ ok: false, problem: "parts" });
    expect(checkPayment(500000, split({ cash: "0" }))).toMatchObject({ ok: false, problem: "parts" });
    expect(checkPayment(500000, split({ card: "30,00.5", cash: "2000" }))).toMatchObject({ ok: false, problem: "invalid" });
    // One part short of the bill is still a sum problem.
    expect(checkPayment(500000, split({ card: "4000" }))).toMatchObject({ ok: false, problem: "sum", remainingCents: 100000 });
  });

  test("split: no note is fine (2026-11-15, owner) and none is sent", () => {
    const d = split({ card: "600", cash: "400" }, " ");
    const c = checkPayment(100000, d);
    expect(c).toMatchObject({ ok: true, problem: null, remainingCents: 0 });
    expect(paymentBody(d, c)).toEqual({ payments: [{ method: "cash", amount: 400 }, { method: "card", amount: 600 }] });
  });

  test("split with exactly one part above zero is sent as that one method", () => {
    const card = split({ card: "5000", cash: "0" }, "");
    const c = checkPayment(500000, card);
    expect(c).toMatchObject({ ok: true, problem: null, remainingCents: 0 });
    expect(paymentBody(card, c)).toEqual({ payment_method: "card" });
    // A prepaid seat's DUE (500 of 2 500): one card part for the due.
    const due = split({ card: "500" }, "");
    expect(paymentBody(due, checkPayment(50000, due))).toEqual({ payment_method: "card" });
    // «Другое» alone: its note becomes the text, cut to the column's 120.
    const other = split({ other: "5000" }, "Voucher");
    expect(paymentBody(other, checkPayment(500000, other))).toEqual({ payment_method: "other", payment_method_other: "Voucher" });
    const long = split({ other: "5000" }, "a".repeat(200));
    expect(paymentBody(long, checkPayment(500000, long))).toEqual({ payment_method: "other", payment_method_other: "a".repeat(120) });
    const bare = split({ other: "5000" }, "");
    expect(paymentBody(bare, checkPayment(500000, bare))).toEqual({ payment_method: "other" });
  });

  test("an amount converted from another display currency is rounded to the cent", () => {
    expect(checkPayment(500000, split({ card: "2999.996", cash: "2000" }))).toMatchObject({ ok: true, remainingCents: 0 });
  });

  test("«the rest here» fills what is still due, never below zero", () => {
    expect(fillRemaining(500000, split({ card: "3000" }), "cash").amounts.cash).toBe("2000.00");
    expect(fillRemaining(500000, split({ card: "6000" }), "cash").amounts.cash).toBe("");
  });
});
