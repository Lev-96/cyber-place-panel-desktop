import { ISessionApi } from "@/types/sessions";

/**
 * What a running session's CLOCK is worth right now.
 *
 * ## This mirrors one backend function, deliberately and exactly
 *
 * `App\Models\Sessions\Session::timeCostStringAt()` is the source of truth —
 * `preview` and `stop` both go through it, which is what keeps the receipt on
 * screen and the money in the books the same figure. A ticking counter cannot
 * ask the server every second, so the panel has always extrapolated locally
 * between polls; what it did NOT do was extrapolate the same way.
 *
 * The branches below are that function, in the same order, reading the fields
 * `SessionResource` already ships. Change one and change the other, or the
 * tile and the receipt start telling a cashier different stories.
 *
 * ## What "fixed tariff" means here, since it is the case this exists for
 *
 * An HOURLY RATE with an auto-stop attached. `time_packages` states the rate
 * by stating a price for a duration — 1500 for 60 minutes is 1500/hour — and
 * the kiosk agent locks the seat when the duration is up. A player who leaves
 * at 00:30 owes 750, and the figure ticks all the way there.
 *
 * This REVERSED on 2026-09-06. Until then a package was a block bought up
 * front, owed in full from its first second, and `committed_amount` was what
 * the clock cost. It is now only what has been committed to, and the one thing
 * still billed from it is a session whose package row was deleted underneath
 * it.
 *
 * Going UNLIMITED reversed with it: removing a session's end is a decision
 * about the auto-stop, not about the bill, so `unlimited_at` and
 * `committed_until` take no part in the price. See CLAUDE.md §8.9.6.
 *
 * ## Not the whole bill
 *
 * The clock plus the items on the seat. Extra joysticks and the branch's
 * rounding step are not in it, so a seat with pads under-reads. The full bill
 * is the stop receipt, which comes from the server.
 *
 * @param at Milliseconds since the epoch to price at; `Date.now()` in the UI,
 *           a fixed instant in tests.
 */
export const sessionTimeCostAt = (session: ISessionApi, at: number): number => {
  const rate = toNumber(session.hourly_rate);

  // Open / count-up: per second at the assigned rate, from the first second.
  if (session.mode === "open") {
    return perSecond(rate, secondsBetween(session.started_at, at));
  }

  // `total_paid` is the fallback for a session that closed before
  // `committed_amount` existed — the same fallback the backend uses, for the
  // same rows.
  const committed = toNumber(session.committed_amount ?? session.total_paid);

  // Fixed, unlimited or not: per second at the tariff's implied rate, from the
  // first second. Removing a session's end is a decision about the auto-stop
  // and not about the bill, so `unlimited_at` and `committed_until` take no
  // part in this any more.
  //
  // A tariff whose rate cannot be established at all — a package row deleted
  // under a running session — bills what was committed, which is the last
  // figure anybody agreed to and is safer than billing the seat nothing.
  const tariff = tariffHourlyRate(session);

  return tariff === null
    ? round2(committed)
    : perSecond(tariff, secondsBetween(session.started_at, at));
};

/**
 * The tariff's hourly rate, whatever shape the tariff was chosen in.
 *
 * Mirrors `Session::tariffHourlyRate()`. A package states a rate by stating a
 * price for a duration: 1500 for 60 minutes IS 1500/hour, and 1000 for 30
 * minutes is 2000/hour. `hourly_rate` wins when it is set — the count-up mode
 * and any session made unlimited, both of which carry a resolved one.
 *
 * `null` means no rate can be established: a fixed session whose package the
 * backend did not load, or whose package row is gone. The caller decides, and
 * must not read that as a zero.
 */
const tariffHourlyRate = (session: ISessionApi): number | null => {
  if (session.hourly_rate !== null && session.hourly_rate !== undefined) {
    return toNumber(session.hourly_rate);
  }

  const pkg = session.time_package;
  const minutes = toNumber(pkg?.duration_minutes);
  if (!pkg || minutes <= 0) return null;

  return (toNumber(pkg.price) * 60) / minutes;
};

/**
 * What has been put ON the seat — drinks, snacks, anything sold to it.
 *
 * Mirrors the `itemsTotal` term of `SessionPricingCalculator::bill()`: each
 * line is `price × qty` settled to cents on its own, and the lines are then
 * summed. Per line rather than once at the end because that is the order the
 * backend's bcmath does it in, and the two must not disagree by a cent.
 *
 * These do not tick. They change when a cashier adds or corrects a line, and
 * every one of those paths already replaces the session row with the server's
 * answer — so this reads `items` and never accumulates, which is what stops a
 * realtime refresh from charging the same drink twice.
 */
export const sessionItemsTotal = (session: ISessionApi): number => {
  const lines = session.items ?? [];
  if (lines.length === 0) return 0;

  return round2(
    lines.reduce((sum, line) => sum + round2(toNumber(line.price) * toNumber(line.qty)), 0),
  );
};

/**
 * What the session will COLLECT — the clock, plus what is on the seat, or
 * nothing at all.
 *
 * Mirrors `SessionPricingCalculator`, which builds `subtotal = time +
 * joysticks + items` and then zeroes the TOTAL for a waived session. Free is
 * applied here, to the composed figure, for that reason: a waived session
 * gives the drinks away with the hour, and `gross_total` keeps what was given.
 *
 * Two terms of the server's subtotal are still missing, and both make this
 * figure LOWER than the receipt rather than higher:
 *
 *  - extra joysticks. The periods DO travel on the payload with their own
 *    rates and intervals, so this is a decision and not a limit: they tick,
 *    and mirroring a second per-second charge here is a bigger change than
 *    the one that was asked for. A seat with pads still under-reads.
 *  - the branch's rounding step, which does not travel at all — the tile has
 *    nothing to apply and a receipt on a rounding branch will differ by up to
 *    one step.
 *
 * See CLAUDE.md §9.6.
 */
export const sessionAmountAt = (session: ISessionApi, at: number): number =>
  session.is_free ? 0 : round2(sessionTimeCostAt(session, at) + sessionItemsTotal(session));

/**
 * Whole seconds from an ISO instant to a moment, never negative.
 *
 * The negative case is the one that matters: an unlimited session inside its
 * paid block has not overflowed by minus twenty minutes, it has overflowed by
 * nothing. Same guard as `Session::secondsBetween()`.
 */
const secondsBetween = (fromIso: string | null | undefined, at: number): number => {
  if (!fromIso) return 0;
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;

  return Math.max(0, Math.floor((at - from) / 1000));
};

/**
 * `rate × seconds ÷ 3600`, rounded to cents once.
 *
 * One expression rather than a per-minute rate multiplied up: dividing first
 * gives 25.000000000000004 for 1 500/h and compounds from there. Rounding at
 * the end is what keeps 1 500 over 1 800 seconds reading as 750 and not as
 * 749.9999999999999.
 */
const perSecond = (rate: number, seconds: number): number => {
  // Only the rate is guarded here. "An interval is never negative" is
  // `secondsBetween`'s rule and lives there alone — asserting it in both places
  // means neither can be proved, because breaking one leaves the other
  // silently covering for it.
  if (rate <= 0) return 0;

  return round2((rate * seconds) / 3600);
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** `decimal(10,2)` arrives as a string on some payloads and a number on others. */
const toNumber = (v: number | string | null | undefined): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
};
