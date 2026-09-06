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
 * What the session will COLLECT — the figure above, or nothing at all.
 *
 * Mirrors `SessionPricingCalculator`, which zeroes the total for a waived
 * session and leaves the clock's own cost intact as `gross_total`. Kept as a
 * separate step for that reason: free is a decision about the total, not about
 * what the clock is worth.
 */
export const sessionAmountAt = (session: ISessionApi, at: number): number =>
  session.is_free ? 0 : sessionTimeCostAt(session, at);

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
