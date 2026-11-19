import { describe, expect, test } from "vitest";
import {
  addOwnPart, checkPayment, duplicateOwnIds, emptyPaymentDraft, fillRemaining, hasOwnLabel, paymentBody, prepaidPaymentFields,
  type PaymentDraft,
} from "./paymentSplit";

// An `other` part is a «+ Свой вариант» row (2026-11-18): the helper adds one
// whenever an `other` amount is given.
const split = (amounts: Partial<Record<"cash" | "card" | "other", string>>, note = "картой и наличными", label = ""): PaymentDraft => ({
  ...emptyPaymentDraft(), split: true, note, amounts: { cash: amounts.cash ?? "", card: amounts.card ?? "" },
  own: amounts.other === undefined ? [] : [{ id: 1, label, amount: amounts.other }],
});
/** A split of cash/card plus several own rows, each [name, amount]. */
const withOwn = (cash: string, rows: [string, string][], note = ""): PaymentDraft => ({
  ...split({ cash }, note), own: rows.map(([label, amount], i) => ({ id: i + 1, label, amount })),
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
  test("a removed row is gone with its amount: nothing of it is sent", () => {
    const d = { ...split({ cash: "5000" }), own: [] };
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

  test("«Остаток сюда» on cash counts every own row", () => {
    const d = withOwn("", [["Idram", "1000"], ["Telcell", "1500"]]);
    expect(fillRemaining(500000, d, "cash").amounts.cash).toBe("2500.00");
  });
});

describe("several «Свой вариант» in one split (2026-11-19, owner)", () => {
  test("cash + Idram + Telcell: every part sent, each own one as {method: other, amount, label}", () => {
    const d = withOwn("1000", [["Idram", "1500"], ["Telcell", "2500"]]);
    const c = checkPayment(500000, d);
    expect(c).toMatchObject({ ok: true, problem: null, remainingCents: 0 });
    expect(paymentBody(d, c)).toEqual({
      payments: [
        { method: "cash", amount: 1000 },
        { method: "other", amount: 1500, label: "Idram" },
        { method: "other", amount: 2500, label: "Telcell" },
      ],
    });
    // The same body at Start / «+ Время» (only plain cash is left out there).
    expect(prepaidPaymentFields(d, c)).toEqual(paymentBody(d, c));
  });

  test("two own parts and nothing else: still a split, never one method", () => {
    const d = withOwn("", [["Idram", "2000"], ["Telcell", "3000"]]);
    expect(paymentBody(d, checkPayment(500000, d))).toEqual({
      payments: [{ method: "other", amount: 2000, label: "Idram" }, { method: "other", amount: 3000, label: "Telcell" }],
    });
  });

  test("all parts are summed: short, too much, exact", () => {
    expect(checkPayment(500000, withOwn("1000", [["Idram", "1500"], ["Telcell", "1500"]]))).toMatchObject({ ok: false, problem: "sum", remainingCents: 100000 });
    expect(checkPayment(500000, withOwn("1000", [["Idram", "1500"], ["Telcell", "3500"]]))).toMatchObject({ ok: false, problem: "sum", remainingCents: -100000 });
    expect(checkPayment(500000, withOwn("", [["Idram", "2500"], ["Telcell", "2500"]]))).toMatchObject({ ok: true, remainingCents: 0 });
  });

  test("an unreadable own amount is «invalid»", () => {
    expect(checkPayment(500000, withOwn("1000", [["Idram", "4x"]]))).toMatchObject({ ok: false, problem: "invalid" });
  });

  test("a repeated name (any case, spaces) is refused; the first keeps it", () => {
    const d = withOwn("", [["Idram", "2500"], [" idram ", "2500"]]);
    expect([...duplicateOwnIds(d.own)]).toEqual([2]);
    expect(checkPayment(500000, d)).toMatchObject({ ok: false, problem: "duplicate" });
  });

  test("an unnamed option at most once", () => {
    const d = withOwn("", [["", "2500"], ["  ", "2500"]]);
    expect([...duplicateOwnIds(d.own)]).toEqual([2]);
    expect(checkPayment(500000, d)).toMatchObject({ ok: false, problem: "duplicate" });
    // One unnamed and one named: fine.
    expect(checkPayment(500000, withOwn("", [["", "2500"], ["Idram", "2500"]]))).toMatchObject({ ok: true });
  });

  test("«Остаток сюда» on an own row fills that row only", () => {
    const d = withOwn("1000", [["Idram", "1500"], ["Telcell", ""]]);
    const next = fillRemaining(500000, d, { own: 2 });
    expect(next.own.map((p) => p.amount)).toEqual(["1500", "2500.00"]);
    expect(next.amounts.cash).toBe("1000");
  });

  test("adding rows: each gets its own id and the name given; a name is looked up case-insensitively", () => {
    let d = addOwnPart({ ...emptyPaymentDraft(), split: true });
    d = addOwnPart(d, "Telcell");
    d = addOwnPart(d);
    expect(d.own).toEqual([{ id: 1, label: "", amount: "" }, { id: 2, label: "Telcell", amount: "" }, { id: 3, label: "", amount: "" }]);
    expect(hasOwnLabel(d, "telcell ")).toBe(true);
    expect(hasOwnLabel(d, "Idram")).toBe(false);
  });
});
