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
 * The three branches below are that function, in the same order, reading the
 * fields `SessionResource` already ships. Change one and change the other, or
 * the tile and the receipt start telling a cashier different stories.
 *
 * ## What "fixed tariff" means here, since it is the case this exists for
 *
 * It is a PACKAGE — a block of time bought up front (`time_packages`:
 * duration + price), after which the kiosk agent locks the seat by itself. The
 * player who buys an hour for 1 500 and leaves at 00:30 has still bought the
 * hour, so the figure is 1 500 from the first second and does not tick.
 *
 * That is the venue's rule and not an oversight: pro-rating the block would
 * make a package into an hourly rate with an auto-stop, and every early
 * departure would collect less than the player agreed to. `committed_amount`
 * exists to hold exactly this number — see CLAUDE.md §8.9.6.
 *
 * What WAS an oversight is that the tile showed no amount at all for such a
 * session: the countdown branch of `SessionTimer` rendered a clock and nothing
 * else, so a cashier could not see what the seat was worth without opening the
 * stop receipt.
 *
 * ## Not the whole bill
 *
 * The clock only — drinks and extra joysticks are not in it, exactly as they
 * were never in the open-mode counter. The full bill is the stop receipt, which
 * comes from the server.
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

  // Fixed: the block that was SOLD. `total_paid` is the fallback for a session
  // that closed before `committed_amount` existed — the same fallback the
  // backend uses, for the same rows.
  const committed = toNumber(session.committed_amount ?? session.total_paid);

  if (!session.unlimited_at || !session.committed_until) {
    return round2(committed);
  }

  // Switched to unlimited: the sold block plus whatever ran PAST it. Nothing
  // before that boundary is recomputed — the player bought that hour, and a
  // switch made halfway through it must not make the hour cheaper.
  return round2(committed + perSecond(rate, secondsBetween(session.committed_until, at)));
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
