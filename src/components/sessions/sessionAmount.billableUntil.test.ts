import { describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { billableUntilOf, sessionAmountAt, sessionJoysticksTotalAt, sessionTimeCostAt } from "./sessionAmount";

/**
 * A running seat is never billed past its end (backend 2026-11-15,
 * `Session::billableUntil` + `SessionPricingCalculator::clampToEnd`,
 * SessionBilledToItsEndTest). The tile mirrors it: an hour at 1000 on a branch
 * rounding up to 100 read 1100 for the seconds between its end and the sweep.
 *
 *   billableUntil = ends_at                                   running, not paused
 *                 = ends_at + (auto_resume_at − paused_at)   paused with a limit
 *                 = null                                     no end, paused with no limit, closed
 */
const T0 = Date.parse("2026-11-15T08:00:00.000Z"); // 12:00 in Yerevan
const at = (min: number, sec = 0) => T0 + min * 60_000 + sec * 1000;
const iso = (min: number, sec = 0) => new Date(at(min, sec)).toISOString();

/** A planned hour at 1000 (duration / until / «На сумму» all store this shape). */
const plannedHour = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 5, status: "active", mode: "fixed", started_at: iso(0), ends_at: iso(60), committed_until: iso(60),
  committed_amount: 1000, hourly_rate: 1000, time_package: null, time_package_id: null, total_paid: 0,
  is_free: false, rounding_step: 100, rounding_mode: "up", ...over,
} as ISessionApi);

describe("billableUntilOf", () => {
  test("a running seat with an end: its ends_at", () => {
    expect(billableUntilOf(plannedHour())).toBe(at(60));
  });
  test("paused with a limit: the end moved by the pause's whole length", () => {
    const s = plannedHour({ paused_at: iso(20), pauses: [{ paused_at: iso(20), resumed_at: null, auto_resume_at: iso(30) }] });
    expect(billableUntilOf(s)).toBe(at(70));
  });
  test("paused with no limit: no end yet", () => {
    const s = plannedHour({ paused_at: iso(20), pauses: [{ paused_at: iso(20), resumed_at: null, auto_resume_at: null }] });
    expect(billableUntilOf(s)).toBeNull();
  });
  test("no end (count-up, unlimited) and a closed row: null", () => {
    expect(billableUntilOf(plannedHour({ ends_at: null }))).toBeNull();
    expect(billableUntilOf(plannedHour({ mode: "open", ends_at: null, is_unlimited: true }))).toBeNull();
    expect(billableUntilOf(plannedHour({ status: "stopped" }))).toBeNull();
  });
});

describe("the tile after the end", () => {
  test("a planned hour at 1000, rounding up to 100: 1000 at the end and 30 s past it, not 1100", () => {
    expect(sessionAmountAt(plannedHour(), at(60))).toBe(1000);
    expect(sessionAmountAt(plannedHour(), at(60, 30))).toBe(1000);
    expect(sessionAmountAt(plannedHour(), at(61))).toBe(1000);
  });
  test("before the end nothing moves (pro rata, rounded up)", () => {
    expect(sessionAmountAt(plannedHour(), at(30))).toBe(500);
    expect(sessionAmountAt(plannedHour(), at(30, 1))).toBe(600);
  });
  test("a package of an hour at 1000: capped the same way", () => {
    const pkg = plannedHour({ hourly_rate: null, time_package_id: 3, time_package: { id: 3, duration_minutes: 60, price: 1000 } as ISessionApi["time_package"] });
    expect(sessionAmountAt(pkg, at(60, 45))).toBe(1000);
  });
  test("paused with a limit, read after the moved end: 1000", () => {
    const s = plannedHour({
      paused_at: iso(20),
      pauses: [{ paused_at: iso(20), resumed_at: null, auto_resume_at: iso(30) }],
    });
    expect(sessionTimeCostAt(s, at(70, 30))).toBe(1000);
  });
  test("an hourly pad stops at the end too (12:30 to 13:00 at 600/h = 300)", () => {
    const s = plannedHour({ rounding_step: 0, joysticks: [{ slot: 3, price: 600, is_hourly: true, is_charged: true, started_at: iso(30), stopped_at: null }] as ISessionApi["joysticks"] });
    expect(sessionJoysticksTotalAt(s, at(60, 45))).toBe(300);
  });
  test("an unlimited seat and a count-up seat keep billing every second, as before", () => {
    const open = plannedHour({ mode: "open", ends_at: null, committed_until: null, committed_amount: null, rounding_step: 0 });
    expect(sessionAmountAt(open, at(61))).toBeCloseTo(1016.67, 2);
    const unlimited = plannedHour({ ends_at: null, is_unlimited: true, unlimited_at: iso(60), committed_until: iso(60), committed_amount: 1000, rounding_step: 0 });
    expect(sessionAmountAt(unlimited, at(66))).toBe(1100);
  });
});
