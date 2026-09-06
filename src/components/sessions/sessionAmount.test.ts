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

describe("a fixed tariff is an hourly rate with an auto-stop", () => {
  // 1500 for 60 minutes IS 1500/hour. The package states the rate; the player
  // owes for the minutes played. This reversed on 2026-09-06 — it used to be
  // a block owed in full from its first second.
  const pkg = (minutesIn: number, over: Partial<ISessionApi> = {}) => session({
    mode: "fixed",
    started_at: ago(minutesIn),
    ends_at: ahead(60 - minutesIn),
    committed_amount: 1500,
    total_paid: 1500,
    time_package: { duration_minutes: 60, price: 1500 } as ISessionApi["time_package"],
    ...over,
  });

  test.each([
    [15, 375],
    [30, 750],
    [45, 1125],
    [59, 1475],
    [60, 1500],
  ])("at %s minutes in the seat is worth %s", (minutesIn, expected) => {
    expect(sessionAmountAt(pkg(minutesIn), AT)).toBe(expected);
  });

  test("a tariff whose block is not an hour still states a rate", () => {
    // 1000 for 30 minutes is 2000/hour, so a quarter of an hour is 500.
    const s = pkg(15, {
      committed_amount: 1000,
      total_paid: 1000,
      time_package: { duration_minutes: 30, price: 1000 } as ISessionApi["time_package"],
    });

    expect(sessionAmountAt(s, AT)).toBe(500);
  });

  test("past the block the same rate keeps running", () => {
    // Reached by granting time, which is the only way a fixed session outlives
    // its own end.
    const s = pkg(90, { ends_at: ahead(0), committed_amount: 2250, total_paid: 2250 });

    expect(sessionAmountAt(s, AT)).toBe(2250);
  });

  test("with no tariff to derive a rate from it falls back to what was committed", () => {
    // A package row deleted out from under a running session. The last figure
    // anybody agreed to beats billing the seat nothing — same fallback, same
    // rows, as the backend's.
    const s = pkg(30, { time_package: null, committed_amount: 1500 });

    expect(sessionAmountAt(s, AT)).toBe(1500);
  });

  test("it falls back to total_paid when no block was recorded either", () => {
    const s = session({
      mode: "fixed",
      committed_amount: undefined,
      total_paid: 900,
      ends_at: ahead(10),
    });

    expect(sessionAmountAt(s, AT)).toBe(900);
  });
});

describe("unlimited only removes the end, it does not reprice", () => {
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

  test("every minute played, at one rate, from the start", () => {
    // Two hours at 1500. Until 2026-09-06 this was "1500 sold + one hour of
    // overflow", which happened to be the same figure here and was NOT the
    // same figure anywhere the switch landed mid-block.
    expect(sessionAmountAt(converted(), AT)).toBe(3000);
  });

  test("a switch made mid-block does not charge the whole block", () => {
    // The case the old rule got wrong: still inside the committed window, so
    // it used to read a flat 1500 no matter how long the seat had run.
    expect(sessionAmountAt(converted({ committed_until: ahead(30) }), AT)).toBe(3000);
  });

  test("committed_until no longer takes part in the price at all", () => {
    // Same session, boundary moved anywhere: the figure does not move with it.
    const at = converted({ committed_until: ago(0) });
    const ahead30 = converted({ committed_until: ahead(30) });

    expect(sessionAmountAt(at, AT)).toBe(3000);
    expect(sessionAmountAt(at, AT)).toBe(sessionAmountAt(ahead30, AT));
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

/**
 * What is on the bill besides the clock.
 *
 * The backend composes `subtotal = time + joysticks + items`
 * (`SessionPricingCalculator::bill`). The tile has always shown the first term
 * only, so a cashier looking at a seat with two drinks on it saw a figure that
 * was short by the price of two drinks — and the difference appeared out of
 * nowhere at the stop receipt.
 */
describe("drinks on the seat are on the seat's figure", () => {
  const withItems = (over: Partial<ISessionApi>, items: ISessionApi["items"]) =>
    session({ ...over, items });

  const cola = [{ id: 1, name: "Coca-Cola", price: 300, qty: 1, product_id: 7 }];

  // The requirement's table: an open session at 1500/h with one 300 drink.
  test.each([
    [15, 675],
    [30, 1050],
    [45, 1425],
    [60, 1800],
    [90, 2550],
  ])("at %s minutes with a 300 drink the seat is worth %s", (minutes, expected) => {
    const s = withItems({ hourly_rate: 1500, started_at: ago(minutes) }, cola);

    expect(sessionAmountAt(s, AT)).toBe(expected);
  });

  test("a sold package carries its drinks too", () => {
    // The block is 1500 whatever the clock says — that rule is untouched — and
    // the drink is 300 on top of it, not instead of it.
    const s = withItems(
      { mode: "fixed", started_at: ago(30), ends_at: ahead(30), committed_amount: 1500 },
      cola,
    );

    expect(sessionAmountAt(s, AT)).toBe(1800);
  });

  test("quantity is a multiplier, not a row count", () => {
    const s = withItems({ hourly_rate: 1500, started_at: ago(60) }, [
      { id: 1, name: "Coca-Cola", price: 300, qty: 3, product_id: 7 },
    ]);

    expect(sessionAmountAt(s, AT)).toBe(2400);
  });

  test("prices arrive as decimal strings and still add up exactly", () => {
    // `decimal(10,2)` reaches this payload as a string. 0.1 + 0.2 territory:
    // the assertion is `toBe`, so a float artefact fails it.
    const s = withItems({ hourly_rate: 1500, started_at: ago(30) }, [
      { id: 1, name: "Water", price: "150.50", qty: 2, product_id: 8 },
      { id: 2, name: "Bar", price: "0.10", qty: 3, product_id: 9 },
    ]);

    expect(sessionAmountAt(s, AT)).toBe(1051.3);
  });

  test("a waived session gives the drinks away with the time", () => {
    // `SessionPricingCalculator` zeroes the TOTAL, which the items are inside
    // of — free is not "free seat, paid drinks".
    const s = withItems(
      { hourly_rate: 1500, started_at: ago(60), is_free: true },
      cola,
    );

    expect(sessionAmountAt(s, AT)).toBe(0);
  });

  test("no items is the figure it always was", () => {
    const s = session({ hourly_rate: 1500, started_at: ago(30) });

    expect(sessionAmountAt(s, AT)).toBe(750);
    expect(sessionAmountAt({ ...s, items: [] }, AT)).toBe(750);
  });

  test("the clock's own cost stays the clock's own cost", () => {
    // `sessionTimeCostAt` mirrors `timeCostStringAt`, which knows nothing about
    // drinks. Keeping the two apart is what lets each be checked against its
    // counterpart on the server.
    const s = withItems({ hourly_rate: 1500, started_at: ago(30) }, cola);

    expect(sessionTimeCostAt(s, AT)).toBe(750);
  });
});
