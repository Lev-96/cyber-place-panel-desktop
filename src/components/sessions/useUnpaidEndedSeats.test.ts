import { describe, expect, test } from "vitest";
import type { ISessionApi } from "@/types/sessions";
import { isUnpaidEndedSeat } from "./useUnpaidEndedSeats";

const row = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 1, branch_id: 7, status: "expired", total_paid: 1500, payment_method: null, payments: [],
  is_free: false, cancelled_at: null, ...over,
} as unknown as ISessionApi);

describe("an ended seat that still owes its way of paying (2026-11-18)", () => {
  test("expired or stopped, nothing on record, billed: asked", () => {
    expect(isUnpaidEndedSeat(row())).toBe(true);
    expect(isUnpaidEndedSeat(row({ status: "stopped" }))).toBe(true);
    // An older row may not carry the fields at all.
    expect(isUnpaidEndedSeat(row({ payment_method: undefined, payments: undefined }))).toBe(true);
    // The server sends money as a string on some rows.
    expect(isUnpaidEndedSeat(row({ total_paid: "0.50" as unknown as number }))).toBe(true);
  });

  test("running, paid, split-paid, waived, cancelled or zero: not asked", () => {
    expect(isUnpaidEndedSeat(row({ status: "active" }))).toBe(false);
    expect(isUnpaidEndedSeat(row({ payment_method: "card" }))).toBe(false);
    expect(isUnpaidEndedSeat(row({ payments: [{ method: "cash", amount: 1500 }] }))).toBe(false);
    expect(isUnpaidEndedSeat(row({ is_free: true }))).toBe(false);
    expect(isUnpaidEndedSeat(row({ cancelled_at: "2026-11-18T10:00:00Z" }))).toBe(false);
    expect(isUnpaidEndedSeat(row({ total_paid: 0 }))).toBe(false);
  });
});
