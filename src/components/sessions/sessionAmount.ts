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
/** One line of a session's bill, as `SessionResource` ships it. */
export type SessionItemLine = NonNullable<ISessionApi["items"]>[number];

/**
 * What ONE line on the bill is worth.
 *
 * An HOURLY line is a rate and a duration, not a price and a count: the server
 * counts its minutes and ships `line_total` already computed against the
 * instant the payload was built. Recomputing it here would mean mirroring a
 * clock the panel does not own, and quoting `price x qty` instead would print
 * a cue rented at 700/h as a flat 700 — which is what the summary, the history
 * row and the "already on this session" list each did, one screen at a time.
 *
 * Every other line is still `price x qty`, and a payload from a backend that
 * never heard of an hourly extra is priced exactly as it always was.
 */
export const sessionItemLineTotal = (line: SessionItemLine): number =>
  line.is_hourly
    ? round2(toNumber(line.line_total ?? 0))
    : round2(toNumber(line.price) * toNumber(line.qty));

export const sessionItemsTotal = (session: ISessionApi): number => {
  const lines = session.items ?? [];
  if (lines.length === 0) return 0;

  return round2(lines.reduce((sum, line) => sum + sessionItemLineTotal(line), 0));
};

/**
 * What the extra joysticks on this seat have earned.
 *
 * Two strategies, and the SERVER says which priced each pad: `is_hourly` on
 * the period itself, frozen when the pad was handed out.
 *
 * FIXED — a flat fee per pad, carried as `price` + `is_charged`. It sums, it
 * never multiplies by a duration and it never ticks, which is why it can live
 * on a tile that re-renders every second without the figure moving.
 * `is_charged` is then the only thing consulted, and a pad handed BACK is
 * still charged: removal ends the use, it is not a refund, so this counts
 * periods and not pads in play. Rows from before that rule carry `false` and
 * are correctly worth nothing.
 *
 * HOURLY — the pad is priced like the seat, for the time it was actually out,
 * so this term DOES tick while a pad is in play. The period is the interval,
 * clamped to `at`, which is exactly what the backend does.
 *
 * A payload without the flags (an older backend) contributes nothing rather
 * than guessing, which keeps the tile under the receipt instead of over it.
 */
export const sessionJoysticksTotalAt = (session: ISessionApi, at: number): number => {
  const pads = session.joysticks ?? [];
  if (pads.length === 0) return 0;

  return round2(
    pads.reduce((sum, pad) => {
      // An HOURLY pad is priced like the seat: for the time it was actually
      // out. The row is the interval, so this mirrors
      // `SessionPricingCalculator` exactly — the end is clamped to the instant
      // being shown, so a pad still in play ticks and one handed back stopped
      // ticking when it was handed back. `Money::forSeconds` is
      // rate × seconds / 3600, and rounding is deliberately NOT applied per
      // term on either side: a bill is rounded once, on its total.
      if (pad.is_hourly) {
        const from = Date.parse(pad.started_at);
        if (Number.isNaN(from)) return sum;
        const stopped = pad.stopped_at ? Date.parse(pad.stopped_at) : NaN;
        const to = Number.isNaN(stopped) ? at : Math.min(stopped, at);
        const seconds = Math.max(0, Math.floor((to - from) / 1000));
        return sum + (toNumber(pad.price) * seconds) / 3600;
      }

      return sum + (pad.is_charged ? toNumber(pad.price) : 0);
    }, 0),
  );
};

/**
 * The pads as of now.
 *
 * Every caller that is not the ticking tile wants this: the history row, the
 * summary, anything rendering a session that has already stopped. A stopped
 * session's pads are all closed, so "now" cannot make one of them accrue.
 */
export const sessionJoysticksTotal = (session: ISessionApi): number =>
  sessionJoysticksTotalAt(session, Date.now());

/**
 * What the seat costs an hour RIGHT NOW, pads included.
 *
 * The base rate plus every hourly pad currently out. Only meaningful under the
 * hourly model: a one-off fee does not move the rate, and this deliberately
 * returns the base rate unchanged there rather than inventing a number.
 */
export const sessionCurrentHourlyRate = (session: ISessionApi): number => {
  const base = toNumber(session.hourly_rate ?? session.tariff_hourly_rate ?? 0);
  const extra = (session.joysticks ?? [])
    .filter((pad) => pad.is_hourly && pad.stopped_at === null)
    .reduce((sum, pad) => sum + toNumber(pad.price), 0);

  return round2(base + extra);
};

/**
 * What the session will COLLECT — the clock, the pads, what is on the seat, or
 * nothing at all.
 *
 * Mirrors `SessionPricingCalculator`, which builds `subtotal = time +
 * joysticks + items` and then zeroes the TOTAL for a waived session. Free is
 * applied here, to the composed figure, for that reason: a waived session
 * gives the drinks away with the hour, and `gross_total` keeps what was given.
 *
 * One term of the server's subtotal is still missing, and it makes this figure
 * LOWER than the receipt rather than higher: the branch's rounding step does
 * not travel at all, so the tile has nothing to apply and a receipt on a
 * rounding branch will differ by up to one step.
 *
 * Joysticks used to be missing too, for a good reason at the time — mirroring
 * a second ticking charge here was a bigger change than the one being asked
 * for. They are in now under both strategies, because the arithmetic is the
 * backend's own and is stated once, in `sessionJoysticksTotalAt`.
 *
 * See CLAUDE.md §9.6.
 */
export const sessionAmountAt = (session: ISessionApi, at: number): number =>
  session.is_free
    ? 0
    : applyRounding(
      round2(
        sessionTimeCostAt(session, at) + sessionJoysticksTotalAt(session, at) + sessionItemsTotal(session),
      ),
      session.rounding_step ?? 0,
      session.rounding_mode ?? "up",
    );

/**
 * The venue's rounding policy, applied ONCE to a composed subtotal.
 *
 * Mirrors `Money::applyRounding`, including the detail that decides real
 * money: a remainder of exactly half a step goes UP, which is the venue's
 * favour and what every cash register in the country already does.
 *
 * A step of 0 is "no policy" and returns the amount untouched — the default
 * every branch starts on, and the reason this cannot move an existing venue's
 * figures by itself.
 *
 * Here because the tile was the only screen that did NOT round: the receipt
 * rounds and the card did not, so on a venue rounding to 100 the two disagreed
 * by up to a step, constantly, on every seat.
 */
export const applyRounding = (
  amount: number,
  step: number,
  mode: "up" | "nearest" | "down",
): number => {
  if (step <= 0 || amount === 0) return round2(amount);

  const floorUnits = Math.floor(round2(amount) / step);
  const floor = round2(floorUnits * step);
  const remainder = round2(round2(amount) - floor);

  if (remainder === 0) return floor;

  if (mode === "down") return floor;
  if (mode === "up") return round2(floor + step);

  return remainder * 2 >= step ? round2(floor + step) : floor;
};

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
