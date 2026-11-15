import { describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { billableUntilOf, sessionAmountAt, sessionTimeCostAt } from "./sessionAmount";

/**
 * The tile mirrors what «Задать время» writes (backend 2026-11-15,
 * `SessionTimeService::limitPlan`, figures from `SessionLimitTest`). Two shapes,
 * both already read by `sessionTimeCostAt`, checked here with the server's own
 * columns so a change on either side shows:
 *
 *  - ONE rate so far: the seat a planned start of that length is — the plan
 *    shared from the start (from the reset when the counter was reset);
 *  - another rate earlier (a move): what was played frozen at the press as a
 *    rate change, the rest per second at the current rate.
 *
 * Production seat #258: count-up at 1000/h from 18:15:37, "1 hour in all" at
 * 18:15:47 → ends 19:15:37, exactly 1000 — rounding up to 100 included.
 */
const T0 = Date.parse("2026-11-15T14:15:37.000Z"); // 18:15:37 in Yerevan
const at = (sec: number) => T0 + sec * 1000;
const iso = (sec: number) => new Date(at(sec)).toISOString();

/** Seat #258 after "1 hour in all": the plan from the start, no boundary left. */
const hourInAll = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 258, status: "active", mode: "fixed", started_at: iso(0), ends_at: iso(3600), committed_until: iso(3600),
  committed_amount: 1000, hourly_rate: 1000, time_package: null, time_package_id: null, total_paid: 0,
  is_free: false, is_unlimited: false, unlimited_at: null, rate_changed_at: null, amount_before_rate_change: null,
  plan_rebased_at: null, amount_before_plan_rebase: null, rounding_step: 100, rounding_mode: "up", ...over,
} as ISessionApi);

describe("one rate so far: the hour in all is the planned hour", () => {
  test("seat #258: 2.78 at ten seconds, 999.72 a second before the end, 1000 at it", () => {
    expect(sessionTimeCostAt(hourInAll(), at(10))).toBe(2.78);
    expect(sessionTimeCostAt(hourInAll(), at(3599))).toBe(999.72);
    expect(sessionTimeCostAt(hourInAll(), at(3600))).toBe(1000);
  });

  test("the end is the start + the hour, and the tile stops there: 1000 «up to 100», not 1100", () => {
    expect(billableUntilOf(hourInAll())).toBe(at(3600));
    expect(sessionAmountAt(hourInAll(), at(3600))).toBe(1000);
    expect(sessionAmountAt(hourInAll(), at(3630))).toBe(1000);
  });

  test("after a reset: shared from the reset, the waiver taken off once", () => {
    // Open at 15:00, reset at 15:10 (166.67 waived), "1 hour in all" at 15:20:
    // the plan is the hour from the reset, frozen = the offset the reset stored.
    const reset = hourInAll({
      started_at: iso(0), time_reset_at: iso(600), time_reset_offset: 166.67,
      plan_rebased_at: iso(600), amount_before_plan_rebase: 166.67,
      committed_amount: 1166.67, committed_until: iso(4200), ends_at: iso(4200), rounding_step: 0,
    });
    expect(sessionTimeCostAt(reset, at(1200))).toBe(166.67);
    expect(sessionTimeCostAt(reset, at(3600))).toBe(833.33);
    expect(sessionTimeCostAt(reset, at(4200))).toBe(1000);
  });
});

describe("another rate earlier: frozen at the press, the rest at this rate", () => {
  test("20 min at 1500 then 40 at 1000: 666.67 at the press, 916.67 at a quarter to, 1166.67 at the hour", () => {
    // Moved to the 1000 seat at +20 min, "1 hour in all" at +30 min.
    const moved = hourInAll({
      rate_changed_at: iso(1800), amount_before_rate_change: 666.67,
      committed_amount: 1166.67, rounding_step: 0,
    });
    expect(sessionTimeCostAt(moved, at(1800))).toBe(666.67);
    expect(sessionTimeCostAt(moved, at(2700))).toBe(916.67);
    expect(sessionTimeCostAt(moved, at(3600))).toBe(1166.67);
    expect(sessionAmountAt(moved, at(3660))).toBe(1166.67);
  });
});
