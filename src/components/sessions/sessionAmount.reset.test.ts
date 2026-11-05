import { describe, expect, test } from "vitest";
import { ISessionApi, IMinimumChargeRule } from "@/types/sessions";
import { sessionAmountAt, sessionMinimumChargeAt, sessionTimeCostAt } from "./sessionAmount";

/**
 * The clock reset to zero (2026-11-05) on the tile — the mirror of
 * `SessionPricingCalculator::timeCharge`. The figures are the backend's own
 * (`SessionTimeResetTest`): 1500/h started 15:00, reset at 15:16 (400 waived),
 * so the tile and the receipt tell a cashier the same thing.
 */
const START = Date.parse("2026-11-05T15:00:00Z");
const at = (minutes: number) => START + minutes * 60_000;

const seat = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 1, branch_id: 1, pc_id: 1, mode: "open", status: "active", is_free: false,
  started_at: new Date(START).toISOString(), ends_at: null, hourly_rate: 1500, total_paid: 0,
  ...over,
} as unknown as ISessionApi);

const reset = (minute: number, offset: number, waived = offset): Partial<ISessionApi> => ({
  time_reset_at: new Date(at(minute)).toISOString(), time_reset_offset: String(offset), time_waived_total: String(waived),
});

describe("a reset clock on the tile", () => {
  test("never reset: exactly as before", () => {
    expect(sessionTimeCostAt(seat(), at(16))).toBe(400);
  });

  test("0 at the reset, then on from zero at the seat's rate", () => {
    const s = seat(reset(16, 400));
    expect(sessionTimeCostAt(s, at(16))).toBe(0);
    expect(sessionTimeCostAt(s, at(26))).toBe(250);
  });

  test("never below zero for a reading before the reset", () => {
    expect(sessionTimeCostAt(seat(reset(16, 400)), at(10))).toBe(0);
  });

  test("goods stay on the tile's figure", () => {
    const s = seat({ ...reset(10, 250), items: [{ id: 1, name: "Cola", price: 300, qty: 1 }] } as Partial<ISessionApi>);
    expect(sessionAmountAt(s, at(10))).toBe(300);
  });

  test("the VIP minimum does not apply again after a reset", () => {
    const rule: IMinimumChargeRule = { after_minutes: 20, minimum_minutes: 60, mode: "minimum" };
    const vip = seat({ hourly_rate: 3000, min_charge: rule });
    expect(sessionTimeCostAt(vip, at(25))).toBe(3000);
    // Reset at 15:25: the raw clock then was 1 250; ten minutes on, 500 by the minute.
    const after = seat({ hourly_rate: 3000, min_charge: rule, ...reset(25, 1250, 3000) });
    expect(sessionTimeCostAt(after, at(35))).toBe(500);
    expect(sessionMinimumChargeAt(after, at(35)).applied).toBe(false);
  });

  test("an offset without a reset time is ignored", () => {
    expect(sessionTimeCostAt(seat({ time_reset_offset: "400" }), at(16))).toBe(400);
  });
});
