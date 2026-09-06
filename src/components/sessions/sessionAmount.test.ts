import { describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { sessionAmountAt, sessionTimeCostAt } from "./sessionAmount";

/**
 * The one place the panel decides what a running session's clock is worth.
 *
 * Every case here has a counterpart in the backend's `timeCostStringAt` /
 * `SessionPricingCalculator`, which is the source of truth — `preview` and
 * `stop` both go through it. A ticking counter cannot ask the server every
 * second, so this extrapolates; what it must never do is extrapolate a
 * DIFFERENT rule, because then the tile and the receipt tell a cashier two
 * stories about the same seat.
 */

const AT = Date.parse("2026-09-06T18:00:00.000Z");
const ago = (minutes: number) => new Date(AT - minutes * 60_000).toISOString();
const ahead = (minutes: number) => new Date(AT + minutes * 60_000).toISOString();

const session = (over: Partial<ISessionApi>): ISessionApi => ({
  mode: "open",
  started_at: ago(0),
  ends_at: null,
  hourly_rate: null,
  total_paid: 0,
  is_free: false,
  ...over,
} as ISessionApi);

describe("an open session is billed per second at its rate", () => {
  // The table from the requirement, at 1500/h. Nothing rounds up to a whole
  // hour: 30 minutes is half the rate, not the rate.
  test.each([
    [0.0167, 0.42],   // one second
    [0.5, 12.5],      // thirty seconds
    [1, 25],
    [5, 125],
    [15, 375],
    [30, 750],
    [45, 1125],
    [59, 1475],
    [60, 1500],
    [61, 1525],
    [90, 2250],
    [120, 3000],
    [1440, 36000],    // a full day, if a venue ever runs one
  ])("%s minutes at 1500/h is %s", (minutes, expected) => {
    const s = session({ mode: "open", hourly_rate: 1500, started_at: ago(minutes) });

    expect(sessionAmountAt(s, AT)).toBeCloseTo(expected, 2);
  });

  test("1500 over exactly 1800 seconds is 750, not 749.9999999999999", () => {
    const s = session({ mode: "open", hourly_rate: 1500, started_at: ago(30) });

    // Strict equality, not a delta: the display formatter would round the
    // artifact away and this is the one place it can be caught.
    expect(sessionAmountAt(s, AT)).toBe(750);
  });

  test("a rate arriving as a decimal string is read as a number", () => {
    const s = session({ mode: "open", hourly_rate: "1500.00", started_at: ago(30) });

    expect(sessionAmountAt(s, AT)).toBe(750);
  });

  test("a session that has not started earning yet is worth nothing", () => {
    const s = session({ mode: "open", hourly_rate: 1500, started_at: ahead(5) });

    // A clock in the future has not run backwards for five minutes.
    expect(sessionAmountAt(s, AT)).toBe(0);
  });

  test("no configured rate is worth nothing rather than NaN", () => {
    const s = session({ mode: "open", hourly_rate: null, started_at: ago(30) });

    expect(sessionAmountAt(s, AT)).toBe(0);
  });
});

describe("a fixed package is the block that was sold", () => {
  const pkg = (minutesIn: number) => session({
    mode: "fixed",
    started_at: ago(minutesIn),
    ends_at: ahead(60 - minutesIn),
    committed_amount: 1500,
    total_paid: 1500,
  });

  // The rule this feature exists to preserve: the player bought an hour, so
  // the figure is 1500 from the first second and does not move. Pro-rating it
  // would turn a package into an hourly rate with an auto-stop and collect
  // less than the player agreed to on every early departure.
  test.each([1, 15, 30, 45, 59, 60])("at %s minutes in it is still 1500", (minutesIn) => {
    expect(sessionAmountAt(pkg(minutesIn), AT)).toBe(1500);
  });

  test("it falls back to total_paid when no block was recorded", () => {
    const s = session({ mode: "fixed", committed_amount: undefined, total_paid: 900, ends_at: ahead(10) });

    // Sessions that closed before `committed_amount` existed — the same
    // fallback, for the same rows, as the backend's.
    expect(sessionAmountAt(s, AT)).toBe(900);
  });
});

describe("unlimited keeps what was already sold", () => {
  const converted = (over: Partial<ISessionApi> = {}) => session({
    mode: "fixed",
    ends_at: null,
    started_at: ago(120),
    unlimited_at: ago(90),
    committed_until: ago(60),
    committed_amount: 1500,
    total_paid: 1500,
    hourly_rate: 1500,
    ...over,
  });

  test("the block plus only what ran past it", () => {
    // 1500 sold, then one hour of overflow at 1500 — never two hours from
    // `started_at`, which is what the tile used to compute.
    expect(sessionAmountAt(converted(), AT)).toBe(3000);
  });

  test("inside the paid block it has overflowed by nothing", () => {
    expect(sessionAmountAt(converted({ committed_until: ahead(30) }), AT)).toBe(1500);
  });

  test("at the exact boundary the overflow is zero", () => {
    expect(sessionAmountAt(converted({ committed_until: ago(0) }), AT)).toBe(1500);
  });
});

describe("a waived session collects nothing, whatever it would have cost", () => {
  test.each([
    ["an hourly one", session({ mode: "open", hourly_rate: 1500, started_at: ago(90), is_free: true })],
    ["a package", session({ mode: "fixed", committed_amount: 1500, total_paid: 1500, ends_at: ahead(30), is_free: true })],
    ["an unlimited one", session({
      mode: "fixed", ends_at: null, started_at: ago(120), unlimited_at: ago(90),
      committed_until: ago(60), committed_amount: 1500, hourly_rate: 1500, is_free: true,
    })],
  ])("%s", (_name, s) => {
    expect(sessionAmountAt(s, AT)).toBe(0);

    // …and what was given away is still knowable, which is what the receipt
    // reports as `gross_total`. Free is a decision about the TOTAL, not about
    // what the clock was worth.
    expect(sessionTimeCostAt(s, AT)).toBeGreaterThan(0);
  });
});
