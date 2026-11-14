import { describe, expect, test } from "vitest";
import { validateAdjustment, validateExtend, validatePayment, venueToday } from "./invoiceActions";

/**
 * The admin's three writes are checked before a confirm is even asked
 * (2026-11-09): a payment is positive, an adjustment is non-zero and has a
 * reason, an extension is after today and has a reason. Amounts stay strings.
 */
describe("validatePayment", () => {
  const base = { amount: "1500.50", method: "bank_transfer", reference: "", note: "" };

  test("a positive amount with up to two decimals, sent as typed", () => {
    expect(validatePayment(base)).toEqual({
      ok: true,
      payload: { amount: "1500.50", method: "bank_transfer", reference: undefined, note: undefined },
    });
  });

  test("a decimal comma is read as a point; reference and note are trimmed", () => {
    const r = validatePayment({ ...base, amount: " 12,5 ", reference: " TX-1 ", note: " cash at desk " });
    expect(r).toEqual({ ok: true, payload: { amount: "12.5", method: "bank_transfer", reference: "TX-1", note: "cash at desk" } });
  });

  test.each(["", "0", "0.00", "-5", "abc", "1.234", "1e3"])("refuses %j", (amount) => {
    expect(validatePayment({ ...base, amount })).toEqual({ ok: false, errorKey: "platformBilling.admin.invalidAmount" });
  });
});

describe("validateAdjustment", () => {
  test("a signed amount and a reason", () => {
    expect(validateAdjustment({ amount: "-2000", reason: " waived: outage " })).toEqual({
      ok: true, payload: { amount: "-2000", reason: "waived: outage" },
    });
  });

  test("zero is not an adjustment", () => {
    expect(validateAdjustment({ amount: "-0.00", reason: "x" })).toEqual({ ok: false, errorKey: "platformBilling.admin.invalidSigned" });
  });

  test("a reason is required", () => {
    expect(validateAdjustment({ amount: "100", reason: "   " })).toEqual({ ok: false, errorKey: "platformBilling.admin.reasonRequired" });
  });
});

describe("validateExtend", () => {
  test("a date after today and a reason", () => {
    expect(validateExtend({ newDueOn: "2026-11-20", reason: "agreed by phone" }, "2026-11-09")).toEqual({
      ok: true, payload: { new_due_on: "2026-11-20", reason: "agreed by phone" },
    });
  });

  test.each(["2026-11-09", "2026-11-08", "", "20.11.26"])("refuses %j as the new date", (newDueOn) => {
    expect(validateExtend({ newDueOn, reason: "x" }, "2026-11-09")).toEqual({ ok: false, errorKey: "platformBilling.admin.dateAfterToday" });
  });

  test("a reason is required", () => {
    expect(validateExtend({ newDueOn: "2026-11-20", reason: "" }, "2026-11-09")).toEqual({ ok: false, errorKey: "platformBilling.admin.reasonRequired" });
  });
});

describe("venueToday", () => {
  test("is the calendar day in Yerevan (UTC+4), not the machine's", () => {
    // 21:30 UTC on the 9th is already 01:30 on the 10th in Yerevan.
    expect(venueToday(new Date("2026-11-09T21:30:00Z"))).toBe("2026-11-10");
    expect(venueToday(new Date("2026-11-09T10:00:00Z"))).toBe("2026-11-09");
  });
});
