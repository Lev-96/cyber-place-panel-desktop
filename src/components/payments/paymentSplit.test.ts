import { describe, expect, test } from "vitest";
import { checkPayment, emptyPaymentDraft, fillRemaining, paymentBody, prepaidPaymentFields } from "./paymentSplit";

// An `other` part is typed only after «+ Свой вариант» (2026-11-18): the
// helper presses it whenever one is given.
const split = (amounts: Partial<Record<"cash" | "card" | "other", string>>, note = "картой и наличными", label = "") => ({
  ...emptyPaymentDraft(), split: true, note, amounts: { cash: "", card: "", other: "", ...amounts },
  own: { shown: amounts.other !== undefined, label },
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

describe("«Свой вариант» in a split (2026-11-18, owner)", () => {
  test("hidden until pressed: an amount left in the hidden row is never sent", () => {
    const d = { ...split({ cash: "5000" }), amounts: { cash: "5000", card: "", other: "999" }, own: { shown: false, label: "" } };
    expect(checkPayment(500000, d)).toMatchObject({ ok: true, lines: [{ method: "cash", amount: 5000 }] });
  });

  test("named: cash 2000 + «Hovo Card» 3000 sends the name on that part only", () => {
    const d = split({ cash: "2000", other: "3000" }, "", "  Hovo Card ");
    const c = checkPayment(500000, d);
    expect(c.ok).toBe(true);
    expect(paymentBody(d, c)).toEqual({ payments: [{ method: "cash", amount: 2000 }, { method: "other", amount: 3000, label: "Hovo Card" }] });
  });

  test("alone, the name goes as the «Другое» text; a name is cut to 64", () => {
    const d = split({ other: "5000" }, "", "Idram");
    expect(paymentBody(d, checkPayment(500000, d))).toEqual({ payment_method: "other", payment_method_other: "Idram" });
    const long = split({ cash: "1", other: "4999" }, "", "x".repeat(80));
    expect(checkPayment(500000, long).lines[1].label).toBe("x".repeat(64));
  });

  test("«Остаток сюда» ignores the hidden row", () => {
    const d = { ...split({ cash: "" }), amounts: { cash: "", card: "", other: "4000" }, own: { shown: false, label: "" } };
    expect(fillRemaining(500000, d, "cash").amounts.cash).toBe("5000.00");
  });

  test("nothing chosen yet (2026-11-18): not ok, problem «method», and never a body without a method", () => {
    const d = emptyPaymentDraft(null);
    const c = checkPayment(340000, d);
    expect(c).toMatchObject({ ok: false, problem: "method", lines: [] });
    expect(() => paymentBody(d, c)).toThrow();
    expect(() => prepaidPaymentFields(d, c)).toThrow();
    // A split needs no single method: its parts are the answer.
    const parts = { ...split({ cash: "1000", card: "2400" }, ""), method: null };
    expect(checkPayment(340000, parts)).toMatchObject({ ok: true, problem: null });
    expect(paymentBody(parts, checkPayment(340000, parts))).toEqual({ payments: [{ method: "cash", amount: 1000 }, { method: "card", amount: 2400 }] });
  });

  test("the default draft is still cash (the till, Start, «+ Время» keep it)", () => {
    expect(emptyPaymentDraft().method).toBe("cash");
    expect(checkPayment(100, emptyPaymentDraft())).toMatchObject({ ok: true, problem: null });
  });
});

