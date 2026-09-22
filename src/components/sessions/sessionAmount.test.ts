import { describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import { IExtraItem } from "@/types/sessions";
import { extraItemQuote, sessionAmountAt, sessionCurrentHourlyRate, sessionJoysticksTotalAt, sessionTimeCostAt } from "./sessionAmount";

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
describe("extra joysticks are on the seat's figure too", () => {
  /**
   * A FLAT fee per pad handed out, decided by the server. The tile sums the
   * periods it was sent and multiplies nothing — which is why the figure below
   * is the same at one minute and at four hours, and why a tile that
   * re-renders every second does not move it.
   */
  const pad = (id: number, slot: number, price: number, over = {}) => ({
    id, slot, price, is_charged: true,
    started_at: ago(30), stopped_at: null, ...over,
  });

  const withPads = (over: Partial<ISessionApi>, joysticks: unknown[]) =>
    session({ ...over, joysticks } as Partial<ISessionApi>);

  test("one pad adds its fee once, whatever the clock says", () => {
    const at15 = withPads({ hourly_rate: 1500, started_at: ago(15) }, [pad(1, 2, 300)]);
    const at90 = withPads({ hourly_rate: 1500, started_at: ago(90) }, [pad(1, 2, 300)]);

    expect(sessionAmountAt(at15, AT)).toBe(675);    // 375 clock + 300
    expect(sessionAmountAt(at90, AT)).toBe(2550);   // 2250 clock + 300
  });

  test("two pads are two fees", () => {
    const s = withPads(
      { hourly_rate: 1500, started_at: ago(60) },
      [pad(1, 2, 300), pad(2, 3, 300)],
    );

    // 1500 + 600. The requirement's own worked example.
    expect(sessionAmountAt(s, AT)).toBe(2100);
  });

  /**
   * ⚠️ A pad handed BACK keeps its fee. Removal ends the use; it is not a
   * refund, and the server says so with `is_charged`, which stays true.
   */
  test("a pad that was handed back is still on the figure", () => {
    const s = withPads(
      { hourly_rate: 1500, started_at: ago(60) },
      [pad(1, 2, 300, { stopped_at: ago(10) })],
    );

    expect(sessionAmountAt(s, AT)).toBe(1800);
  });

  /** …and a row the SERVER marked uncharged contributes nothing. */
  test("an uncharged period is worth nothing", () => {
    const s = withPads(
      { hourly_rate: 1500, started_at: ago(60) },
      [pad(1, 2, 300, { is_charged: false })],
    );

    expect(sessionAmountAt(s, AT)).toBe(1500);
  });

  test("a payload with no flag guesses nothing", () => {
    // An older backend. Under-reading the tile is the safe direction; inventing
    // a charge the receipt will not have is not.
    const s = withPads(
      { hourly_rate: 1500, started_at: ago(60) },
      [{ id: 1, slot: 2, price: 300, started_at: ago(30), stopped_at: null }],
    );

    expect(sessionAmountAt(s, AT)).toBe(1500);
  });

  test("a waived seat gives the pads away with the hour", () => {
    const s = withPads(
      { hourly_rate: 1500, started_at: ago(60), is_free: true },
      [pad(1, 2, 300), pad(2, 3, 300)],
    );

    expect(sessionAmountAt(s, AT)).toBe(0);
  });

  test("a fixed tariff carries its pads on top of the block", () => {
    const s = withPads(
      { mode: "fixed", started_at: ago(30), ends_at: ahead(30), committed_amount: 1500 },
      [pad(1, 2, 300)],
    );

    expect(sessionAmountAt(s, AT)).toBe(1800);
  });
});

describe("an hourly extra is taken from the server, not recomputed", () => {
  /**
   * A room may rent its extra by the hour, and the minutes belong to the
   * server: the payload carries `line_total` already counted against the
   * instant it was built. The mirror must take that figure rather than
   * multiply a rate by a count — the second is a different number and the
   * tile would disagree with the receipt, which is the exact failure the
   * hourly PADS already taught this file.
   */
  const cue = (over: Record<string, unknown> = {}) => [{
    id: 9, name: "Кий", price: 700, qty: 2, product_id: null,
    is_extra: true, is_hourly: true, minutes: 90, line_total: 2100, ...over,
  }] as ISessionApi["items"];

  test("the server's figure is what lands on the tile", () => {
    const s = session({ hourly_rate: 0, started_at: ago(90), items: cue() });

    expect(sessionAmountAt(s, AT)).toBe(2100);
  });

  test("a rate times a count is NOT what lands on the tile", () => {
    // 700 × 2 = 1400 is the fixed-price answer, and it is the wrong one here.
    const s = session({ hourly_rate: 0, started_at: ago(90), items: cue() });

    expect(sessionAmountAt(s, AT)).not.toBe(1400);
  });

  test("a fixed extra is still price × qty", () => {
    const s = session({
      hourly_rate: 0,
      started_at: ago(90),
      items: cue({ is_hourly: false, minutes: null, line_total: 1400 }),
    });

    expect(sessionAmountAt(s, AT)).toBe(1400);
  });

  test("a line the server never flagged is priced the way it always was", () => {
    const s = session({
      hourly_rate: 0,
      started_at: ago(90),
      items: [{ id: 1, name: "Coca-Cola", price: 300, qty: 3, product_id: 7 }],
    });

    expect(sessionAmountAt(s, AT)).toBe(900);
  });
});

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

  // ── the hourly model ──────────────────────────────────────────────────

  /**
   * An hourly pad is priced for the time it was actually out, and the tile has
   * to agree with the receipt about that, or the cashier reads one number
   * while the player is charged another.
   */
  test("an hourly pad bills the time it was out, not a flat fee", () => {
    const s = session({
      hourly_rate: 1000,
      started_at: ago(120),
      joysticks: [
        // Out for half an hour: 250, a figure no flat fee can produce.
        { id: 1, slot: 3, price: 500, is_charged: true, is_hourly: true,
          started_at: ago(120), stopped_at: ago(90) },
      ],
    } as Partial<ISessionApi>);

    expect(sessionJoysticksTotalAt(s, AT)).toBeCloseTo(250, 2);
  });

  test("a pad still out keeps ticking, and one handed back stopped when it did", () => {
    const s = session({
      hourly_rate: 1000,
      started_at: ago(60),
      joysticks: [
        { id: 1, slot: 3, price: 500, is_charged: true, is_hourly: true,
          started_at: ago(60), stopped_at: null },
      ],
    } as Partial<ISessionApi>);

    expect(sessionJoysticksTotalAt(s, AT)).toBeCloseTo(500, 2);
    expect(sessionJoysticksTotalAt(s, AT + 3600_000)).toBeCloseTo(1000, 2);
  });

  test("a flat fee is untouched by the clock", () => {
    const s = session({
      hourly_rate: 1000,
      started_at: ago(60),
      joysticks: [
        { id: 1, slot: 3, price: 500, is_charged: true, is_hourly: false,
          started_at: ago(60), stopped_at: null },
      ],
    } as Partial<ISessionApi>);

    expect(sessionJoysticksTotalAt(s, AT)).toBeCloseTo(500, 2);
    expect(sessionJoysticksTotalAt(s, AT + 36000_000)).toBeCloseTo(500, 2);
  });

  test("the rate shown is the seat plus the pads currently out", () => {
    const s = session({
      hourly_rate: 1000,
      joysticks: [
        { id: 1, slot: 3, price: 500, is_charged: true, is_hourly: true,
          started_at: ago(60), stopped_at: null },
        // Handed back, so it no longer moves the rate.
        { id: 2, slot: 4, price: 500, is_charged: true, is_hourly: true,
          started_at: ago(60), stopped_at: ago(30) },
      ],
    } as Partial<ISessionApi>);

    expect(sessionCurrentHourlyRate(s)).toBeCloseTo(1500, 2);
  });

  test("a flat fee never moves the rate", () => {
    const s = session({
      hourly_rate: 1000,
      joysticks: [
        { id: 1, slot: 3, price: 500, is_charged: true, is_hourly: false,
          started_at: ago(60), stopped_at: null },
      ],
    } as Partial<ISessionApi>);

    expect(sessionCurrentHourlyRate(s)).toBeCloseTo(1000, 2);
  });
});

/**
 * What one hand-out of the room's extra costs, allowance and all.
 *
 * The room may include the first few in its rate - chips on a poker table, a
 * cue on a billiard table - exactly the way a branch includes the first pads
 * in a PlayStation's. The rule is the server's; this is the panel's one
 * mirror of it, and every figure the hand-out dialog draws comes from here.
 *
 * Two of these cases are the ones that would be silent when they break: a
 * hand-out that STRADDLES the boundary (part free, part paid, which no
 * `unit x qty` can express), and a payload with no allowance at all, which
 * must price exactly as it priced before the field existed.
 */
describe("what a hand-out of the room's extra costs", () => {
  const chips = (over: Partial<IExtraItem> = {}): IExtraItem => ({
    name: "Chips",
    price: "500.00",
    charge_mode: "each",
    fee_taken: false,
    unit_price: "500.00",
    max_qty: 999,
    ...over,
  });

  test("a room with no allowance charges every unit", () => {
    const q = extraItemQuote(chips(), 3);

    expect(q).toMatchObject({ qty: 3, freeQty: 0, paidQty: 3, chargedQty: 3, total: 1500 });
  });

  test("a payload that predates the allowance prices exactly as it always did", () => {
    // The no-regression invariant, stated as a case: no `included`, no
    // `included_remaining`, and the figure is the old `unit x qty`.
    const older = chips();

    expect("included_remaining" in older).toBe(false);
    expect(extraItemQuote(older, 4).total).toBe(2000);
  });

  test("the allowance covers the whole hand-out and nothing is owed", () => {
    const q = extraItemQuote(chips({ included: 3, included_remaining: 3 }), 3);

    expect(q).toMatchObject({ freeQty: 3, paidQty: 0, chargedQty: 0, total: 0 });
  });

  test("a hand-out that straddles the boundary is part free and part paid", () => {
    // One left in the rate, three going out: one free, two charged. This is
    // the case `unit x qty` cannot say at all.
    const q = extraItemQuote(chips({ included: 2, included_remaining: 1 }), 3);

    expect(q).toMatchObject({ freeQty: 1, paidQty: 2, chargedQty: 2, total: 1000 });
  });

  test("an allowance bigger than the hand-out frees only what went out", () => {
    const q = extraItemQuote(chips({ included: 10, included_remaining: 10 }), 2);

    expect(q).toMatchObject({ qty: 2, freeQty: 2, paidQty: 0, total: 0 });
  });

  test("once for the session takes ONE charge once the allowance runs out", () => {
    const q = extraItemQuote(chips({ charge_mode: "once", included: 2, included_remaining: 1 }), 3);

    expect(q).toMatchObject({ freeQty: 1, paidQty: 2, chargedQty: 1, total: 500 });
  });

  test("once reports the surplus as zero-priced, matching what the server writes", () => {
    // `freeQty` answers "how many did the rate cover" and `zeroQty` answers
    // "how many will print at 0.00". Under `once` they differ, because
    // `ExtraItemRule::split()` moves the unsold surplus into the zero row.
    const q = extraItemQuote(chips({ charge_mode: "once", included: 2, included_remaining: 1 }), 3);

    expect(q).toMatchObject({ freeQty: 1, paidQty: 2, chargedQty: 1, zeroQty: 2, total: 500 });
  });

  test("each keeps zeroQty and freeQty the same number", () => {
    const q = extraItemQuote(chips({ charge_mode: "each", included: 2, included_remaining: 1 }), 3);

    expect(q).toMatchObject({ freeQty: 1, zeroQty: 1, chargedQty: 2, total: 1000 });
  });

  test("once for the session takes nothing while the allowance still covers it", () => {
    const q = extraItemQuote(chips({ charge_mode: "once", included: 2, included_remaining: 2 }), 2);

    expect(q).toMatchObject({ chargedQty: 0, total: 0 });
  });

  test("a seat that already paid the one-off is quoted zero, allowance or not", () => {
    // The server has already zeroed `unit_price`; nothing here needs to know
    // why, which is the point of quoting the server's figure.
    const q = extraItemQuote(chips({ charge_mode: "once", fee_taken: true, unit_price: "0.00" }), 4);

    expect(q.total).toBe(0);
  });

  test("an hourly extra quotes no total, only the units that are charged", () => {
    const q = extraItemQuote(
      chips({ pricing_mode: "hourly", unit_price: "700.00", included: 1, included_remaining: 1 }),
      3,
    );

    // A rate is not a bill: the minutes belong to the backend. What the
    // allowance changes is how many units that rate is owed on.
    expect(q).toMatchObject({ hourly: true, total: 0, freeQty: 1, chargedQty: 2, unit: 700 });
  });

  test("an hourly extra covered by the allowance owes no rate at all", () => {
    const q = extraItemQuote(
      chips({ pricing_mode: "hourly", unit_price: "700.00", included: 2, included_remaining: 2 }),
      2,
    );

    expect(q).toMatchObject({ hourly: true, chargedQty: 0, total: 0 });
  });

  test("a count below one costs nothing", () => {
    expect(extraItemQuote(chips(), 0)).toMatchObject({ qty: 0, chargedQty: 0, total: 0 });
    expect(extraItemQuote(chips(), -5)).toMatchObject({ qty: 0, chargedQty: 0, total: 0 });
  });

  test("a nonsense allowance is read as none rather than as free units", () => {
    // Money: guessing wrong here gives the room's stock away.
    expect(extraItemQuote(chips({ included_remaining: -3 }), 2).total).toBe(1000);
    expect(extraItemQuote(chips({ included_remaining: Number.NaN }), 2).total).toBe(1000);
  });

  test("a fractional count is truncated before anything is priced", () => {
    expect(extraItemQuote(chips(), 3.9)).toMatchObject({ qty: 3, total: 1500 });
  });
});
