import { describe, expect, test } from "vitest";
import { ISessionApi, IMinimumChargeRule } from "@/types/sessions";
import { applyMinimumCharge, sessionMinimumChargeAt, sessionTimeCostAt } from "./sessionAmount";

/**
 * The VIP minimum charge (2026-10-31) on the tile — the mirror of
 * `MinimumChargeRule::apply()`. The boundary table is the SAME table the
 * backend pins in `VipMinimumChargeTest::boundaries` (threshold 20 min,
 * minimum 1 h, 3000/h), so the two sides are held to the same figures.
 */

const RULE: IMinimumChargeRule = { after_minutes: 20, minimum_minutes: 60, mode: "minimum" };
const perSecond = (rate: number, s: number) => Math.round((rate * s) / 3600 * 100) / 100;

describe("the boundaries at 3000/h (same table as the backend)", () => {
  test.each([
    [0, 0],
    [300, 250],
    [599, 499.17],
    [600, 500],
    [1199, 999.17],
    [1200, 3000],
    [1201, 3000],
    [1800, 3000],
    [3599, 3000],
    [3600, 3000],
    [3601, 3000.83],
    [4200, 3500],
    [5400, 4500],
    [7200, 6000],
  ])("%i s played → %f", (played, expected) => {
    expect(applyMinimumCharge(RULE, perSecond(3000, played), played, 3000).amount).toBe(expected);
  });
});

describe("other rules", () => {
  test("round up bills whole blocks once past the threshold", () => {
    const rule: IMinimumChargeRule = { after_minutes: 20, minimum_minutes: 60, mode: "round_up" };
    const at = (m: number) => applyMinimumCharge(rule, perSecond(3000, m * 60), m * 60, 3000).amount;
    expect([at(19), at(20), at(60), at(61), at(121)]).toEqual([950, 3000, 3000, 6000, 9000]);
  });

  test("no rule, or no rate to price at: the clock unchanged", () => {
    expect(applyMinimumCharge(null, 1250, 1500, 3000)).toEqual({ amount: 1250, applied: false, billedSeconds: 1500 });
    expect(applyMinimumCharge(RULE, 1250, 1500, null)).toEqual({ amount: 1250, applied: false, billedSeconds: 1500 });
  });
});

const AT = Date.parse("2026-10-31T15:25:00.000Z");
const ago = (minutes: number) => new Date(AT - minutes * 60_000).toISOString();
const session = (over: Partial<ISessionApi>): ISessionApi => ({
  mode: "open",
  started_at: ago(25),
  ends_at: null,
  hourly_rate: 3000,
  total_paid: 0,
  is_free: false,
  ...over,
} as ISessionApi);

describe("on a running session", () => {
  test("a VIP visit past the threshold shows the minimum, and says so", () => {
    const s = session({ min_charge: RULE });
    expect(sessionTimeCostAt(s, AT)).toBe(3000);
    expect(sessionMinimumChargeAt(s, AT).applied).toBe(true);
  });

  test("a session without a rule is exactly what it was", () => {
    expect(sessionTimeCostAt(session({}), AT)).toBe(1250);
    expect(sessionTimeCostAt(session({ min_charge: null }), AT)).toBe(1250);
  });

  test("after a move to a 4000/h seat the top-up runs at the CURRENT rate (backend: 3800)", () => {
    const s = session({
      min_charge: RULE,
      hourly_rate: 4000,
      rate_changed_at: ago(13),
      amount_before_rate_change: 600,
    });
    expect(sessionTimeCostAt(s, AT)).toBe(3800);
  });

  test("paused time does not count towards the threshold (backend: 950 at 19 played)", () => {
    const s = session({
      started_at: ago(49),
      min_charge: RULE,
      pauses: [{ paused_at: ago(34), resumed_at: ago(4) }],
    } as Partial<ISessionApi>);
    expect(sessionTimeCostAt(s, AT)).toBe(950);
  });
});
