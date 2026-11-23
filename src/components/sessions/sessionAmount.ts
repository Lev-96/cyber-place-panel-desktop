import { IMinimumChargeRule, ISessionApi } from "@/types/sessions";
import { billCents } from "@/components/payments/cashChange";

/**
 * What a running session's CLOCK is worth right now.
 *
 * ## This mirrors one backend function, deliberately and exactly
 *
 * `App\Models\Sessions\Session::timeCostExactAt()` is the source of truth —
 * `preview` and `stop` both go through it, which is what keeps the receipt on
 * screen and the money in the books the same figure. A ticking counter cannot
 * ask the server every second, so the panel has always extrapolated locally
 * between polls; what it did NOT do was extrapolate the same way.
 *
 * The branches below are that function, in the same order, reading the fields
 * `SessionResource` already ships. Change one and change the other, or the
 * tile and the receipt start telling a cashier different stories.
 *
 * ## Exact, and rounded ONCE (2026-11-16, owner: «расчет должен быть 100%
 * гарантировано правильным»)
 *
 * Every part — the clock, each pad, each hourly line — is held EXACTLY, as a
 * ratio of whole numbers of cents ({@link Exact}, the server's `ExactAmount`),
 * the parts are summed, and the sum is rounded half-up to the cent once, then
 * the branch's step. A float cannot do this: 833.33 × 5400 / 3600 is 1249.995,
 * which a double holds as 1249.9949999… and rounds DOWN, while the server
 * rounds it up — the tile read 1200 against a receipt of 1300 under "nearest
 * 100". With integers both sides reach the same cent, at every instant.
 *
 * A package's rate is its price for its length (2500 for 10800 s), never
 * 833.33 an hour; a plan sold in periods ("+ Время", an extension) reads each
 * period at its own price (`plan_period_ends`).
 *
 * ## What "fixed tariff" means here, since it is the case this exists for
 *
 * An HOURLY RATE with an auto-stop attached. `time_packages` states the rate
 * by stating a price for a duration — 1500 for 60 minutes is 1500/hour — and
 * the kiosk agent locks the seat when the duration is up. A player who leaves
 * at 00:30 owes 750, and the figure ticks all the way there.
 *
 * Going UNLIMITED: removing a session's end is a decision about the
 * auto-stop, not about the bill. What the switch DOES keep is a rate
 * boundary: the backend freezes what the clock had earned at that instant
 * into `committed_amount` (with `committed_until` = the switch) and prices
 * only the time after it at the seat's rate — so a new price named at the
 * switch is "from now on". Invisible when the rate does not change.
 *
 * A MOVE to a seat priced differently (2026-09-25) sets the same kind of
 * boundary in its own pair, `rate_changed_at` + `amount_before_rate_change`;
 * when both exist the LATER one decides, exactly as on the server.
 *
 * @param at Milliseconds since the epoch to price at; `Date.now()` in the UI,
 *           a fixed instant in tests.
 */
/**
 * The least time figure worth resetting (2026-11-05): one whole unit. Right
 * after a reset the clock reads a few hundredths again within seconds; a
 * reset control beside "0.11" would only waive cents. The server takes any
 * positive figure — this decides only where the control is offered.
 */
export const RESET_MIN_AMOUNT = 1;

export const sessionTimeCostAt = (session: ISessionApi, at: number): number =>
  sessionMinimumChargeAt(session, at).amount;

/**
 * The clock with the session's minimum charge applied — the same step
 * `SessionPricingCalculator::bill()` takes before adding anything
 * (`Session::minimumChargeAt`), branch for branch: from the threshold to the
 * minimum exactly the CURRENT seat's price for the minimum, past it that plus
 * what the clock earned since the visit reached it (2026-11-07); a bill pinned
 * past the minimum by a move / "+ Время" / unlimited → its total, then the
 * clock on from the pin; a visit settled before 2026-11-07, or rounding up,
 * read as they were billed. `amount` is to the cent; the bill adds the exact
 * figure.
 */
export const sessionMinimumChargeAt = (session: ISessionApi, atRaw: number): MinimumChargeResult => {
  const result = minimumChargeExactAt(session, billableAt(session, atRaw));
  return { amount: toMoney(result.exact), applied: result.applied, billedSeconds: result.billedSeconds };
};

/** {@link sessionMinimumChargeAt}, exactly. */
const minimumChargeExactAt = (session: ISessionApi, at: number): ExactMinimumCharge => {
  const rule = session.min_charge ?? null;
  const clock = clockExactAt(session, at);
  const played = playedSecondsBetween(session, session.started_at, at);
  // Reset to zero (2026-11-05) — `SessionPricingCalculator::timeCharge`: the
  // clock minus the clock at the reset, never below zero, and no VIP minimum
  // after it. The raw clock is what every boundary above froze, so this one
  // subtraction is exact across all of them.
  const offset = session.time_reset_at ? session.time_reset_offset : null;
  if (offset !== null && offset !== undefined) {
    return { exact: nonNegative(minus(clock, exactOf(offset))), applied: false, billedSeconds: played };
  }
  if (!rule) return { exact: clock, applied: false, billedSeconds: played };
  const covering = (total: number, covered: number): ExactMinimumCharge => ({
    exact: played <= covered
      ? exactOf(total)
      : plus(exactOf(total), nonNegative(minus(clock, clockExactAt(session, instantAtPlayed(session, covered, at))))),
    applied: (rule.settled_amount ?? 0) > 0,
    billedSeconds: Math.max(covered, played),
  });
  const oldTopUp = (): ExactMinimumCharge => ({
    exact: plus(clock, exactOf(rule.settled_amount ?? 0)),
    applied: (rule.settled_amount ?? 0) > 0,
    billedSeconds: (rule.settled_billed_minutes ?? 0) * 60,
  });

  // Rounding up — frozen before 2026-11-06 — reads as it did.
  if (rule.mode === "round_up") {
    if (rule.settled_total != null && rule.settled_seconds != null) return covering(rule.settled_total, rule.settled_seconds);
    if (rule.settled_amount != null) return oldTopUp();
    return applyMinimumChargeExact(rule, clock, played, tariffRateOf(session));
  }
  // Settled on a move before 2026-11-07 (no total): read as it was then.
  if (rule.settled_amount != null && rule.settled_total == null) return oldTopUp();

  // Pinned past the minimum by a re-basing (a move, "+ Время", unlimited).
  const minimum = rule.minimum_minutes * 60;
  if (rule.settled_total != null && rule.settled_seconds != null && rule.settled_seconds > minimum) {
    return covering(rule.settled_total, rule.settled_seconds);
  }

  // The minimum at the seat the visit is on NOW, exactly (2026-11-07, owner:
  // "1498 must be 1500") — `MinimumChargeRule::applyAtCurrentRateExact`; past
  // it the clock from the instant the visit reached it.
  const rate = tariffRateOf(session);
  if (played < rule.after_minutes * 60 || rate === null) return { exact: clock, applied: false, billedSeconds: played };
  const hour = rateFor(rate, minimum);
  const exact = played <= minimum
    ? hour
    : plus(hour, nonNegative(minus(clock, clockExactAt(session, instantAtPlayed(session, minimum, at)))));
  return { exact, applied: compare(exact, clock) > 0, billedSeconds: Math.max(minimum, played) };
};

/** What a minimum-charge rule did to a clock. */
export interface MinimumChargeResult {
  /** The clock as billed, to the cent. */
  amount: number;
  /** True when the rule added something. */
  applied: boolean;
  /** The seconds billed (played time when nothing was added). */
  billedSeconds: number;
}

interface ExactMinimumCharge {
  exact: Exact;
  applied: boolean;
  billedSeconds: number;
}

/**
 * The seconds billed for `playedSeconds` under a rule — mirrors
 * `MinimumChargeRule::billedSeconds()`: below the threshold what was played;
 * from it (inclusive, whole seconds) the minimum, or played time rounded up
 * to whole blocks.
 */
export const minimumChargeBilledSeconds = (rule: IMinimumChargeRule, playedSeconds: number): number => {
  const played = Math.max(0, playedSeconds);
  if (played < rule.after_minutes * 60) return played;
  const block = rule.minimum_minutes * 60;
  return rule.mode === "round_up" ? Math.ceil(played / block) * block : Math.max(played, block);
};

/**
 * A clock with a VIP minimum-charge rule applied — mirrors
 * `MinimumChargeRule::applyExact()`: `clock + (rate × billed − rate × played)`,
 * exact and rounded once, so a single-rate visit is exactly `rate × billed`.
 * No rule, nothing to add, or no rate → the clock unchanged. Also what the
 * owner's settings preview prices its examples with, so the preview cannot
 * promise what the till would not charge.
 */
export const applyMinimumCharge = (
  rule: IMinimumChargeRule | null,
  clockCost: number,
  playedSeconds: number,
  rate: number | null,
): MinimumChargeResult => {
  const played = Math.max(0, playedSeconds);
  if (!rule || rule.after_minutes < 1 || rule.minimum_minutes < 1) {
    return { amount: clockCost, applied: false, billedSeconds: played };
  }
  const result = applyMinimumChargeExact(rule, exactOf(clockCost), played, rate === null ? null : perHour(rate));
  return { amount: toMoney(result.exact), applied: result.applied, billedSeconds: result.billedSeconds };
};

const applyMinimumChargeExact = (
  rule: IMinimumChargeRule,
  clock: Exact,
  playedSeconds: number,
  rate: Rate | null,
): ExactMinimumCharge => {
  const played = Math.max(0, playedSeconds);
  const billed = minimumChargeBilledSeconds(rule, played);
  if (billed <= played || rate === null) return { exact: clock, applied: false, billedSeconds: played };
  return { exact: plus(clock, minus(rateFor(rate, billed), rateFor(rate, played))), applied: true, billedSeconds: billed };
};

/** The clock as played — `Session::timeCostExactAt()`, no minimum — exactly. */
const clockExactAt = (session: ISessionApi, at: number): Exact => {
  const rate = tariffRateOf(session);

  // A PLAN (2026-10-25) — a package or a planned hourly start — bills its
  // share of the plan from the last re-base, each period at its own price
  // (2026-11-16), the rate past its end. A seat moved before re-basing
  // existed keeps the move's rule below.
  if (session.mode === "fixed" && !session.unlimited_at && rate !== null
      && session.committed_amount !== null && session.committed_amount !== undefined && session.committed_until
      && (!session.rate_changed_at || (session.plan_rebased_at
        && !(Date.parse(session.plan_rebased_at) < Date.parse(session.rate_changed_at))))) {
    return planShareExactAt(session, rate, at);
  }

  // A rate change mid-way (a move): what was earned is frozen, only the time
  // after it runs at the rate. Outranks the unlimited boundary unless that
  // one came later.
  if (session.rate_changed_at && session.amount_before_rate_change !== null
      && session.amount_before_rate_change !== undefined
      && (!session.unlimited_at || !session.committed_until
        || !(Date.parse(session.rate_changed_at) < Date.parse(session.committed_until)))) {
    return plus(exactOf(session.amount_before_rate_change),
      paidAheadRunning(session, rate, playedSecondsBetween(session, session.rate_changed_at, at)));
  }

  // The unlimited switch's boundary: frozen at the switch, the rest at the rate.
  if (session.unlimited_at && session.committed_until
      && session.committed_amount !== null && session.committed_amount !== undefined) {
    return plus(exactOf(session.committed_amount),
      runningOn(rate, playedSecondsBetween(session, session.committed_until, at)));
  }

  // Open / count-up: per second at the seat's rate, from the first second.
  if (session.mode === "open") {
    return runningOn(rate, playedSecondsBetween(session, session.started_at, at));
  }

  // Fixed: per second at the tariff's rate, from the first second. A tariff
  // whose rate cannot be established at all — a package row deleted under a
  // running session — bills what was committed (`total_paid` for a session
  // that closed before `committed_amount` existed), the backend's fallback.
  return rate === null
    ? exactOf(session.committed_amount ?? session.total_paid)
    : rateFor(rate, playedSecondsBetween(session, session.started_at, at));
};

/** `seconds` at the rate the seat runs on — nothing when it has none (a free start with no price). */
const runningOn = (rate: Rate | null, seconds: number): Exact => (rate === null ? ZERO : rateFor(rate, seconds));

/**
 * The fewest whole seconds whose price at `rate` reaches `cents` —
 * `Rate::secondsToReach()`.
 */
const secondsToReach = (rate: Rate, cents: bigint): number => {
  if (cents <= 0n || rate.priceCents <= 0n) return 0;
  const num = cents * BigInt(rate.seconds);
  const whole = num / rate.priceCents;
  return Number(whole + (whole * rate.priceCents < num ? 1n : 0n));
};

/**
 * After a move made while paid ahead (2026-11-22) — `Session::paidAheadRunning()`:
 * the carried money buys whole seconds at the new rate and the last of them
 * completes it exactly (3 000 paid → 3 000 at the end); before then, after
 * it, and on any other seat, the rate by the second.
 */
const paidAheadRunning = (session: ISessionApi, rate: Rate | null, seconds: number): Exact => {
  const carried = session.paid_ahead_amount;
  if (carried === null || carried === undefined || rate === null) return runningOn(rate, seconds);
  const cents = centsOfAmount(carried);
  if (cents <= 0n) return runningOn(rate, seconds);
  const bought = secondsToReach(rate, cents);
  if (seconds < bought) return runningOn(rate, seconds);
  return plus({ n: cents, d: 1n }, runningOn(rate, seconds - bought));
};

/**
 * The plan's share, exactly — `Session::planShareAt`: from the last re-base
 * (or the start) through the end of each earlier period to the plan, each
 * stretch in proportion to the PLAYED seconds it holds; past the plan's end,
 * the rate per second. Only pauses resumed before `at` come out of the plan's
 * length: a resume moves the end; a running pause, or one closed by the stop,
 * has not.
 */
const planShareExactAt = (session: ISessionApi, rate: Rate, at: number): Exact => {
  const from = session.plan_rebased_at ?? session.started_at;
  const fromMs = Date.parse(from as string);
  const frozen = session.plan_rebased_at ? exactOf(session.amount_before_plan_rebase ?? 0) : ZERO;
  const plan = exactOf(session.committed_amount);
  const untilMs = Date.parse(session.committed_until as string);
  const planned = untilMs > fromMs
    ? Math.max(0, Math.floor((untilMs - fromMs) / 1000) - pausedSecondsBetween(session, fromMs, untilMs, at))
    : 0;
  const played = playedSecondsBetween(session, from, at);
  if (planned <= 0) return plus(frozen, rateFor(rate, played));
  if (played > planned) return plus(plan, rateFor(rate, played - planned));

  let fromSeconds = 0;
  let fromAmount = frozen;
  for (const end of planPeriodEnds(session)) {
    if (end.seconds >= planned) break;
    if (played <= end.seconds) {
      return plus(fromAmount, scaled(minus(end.amount, fromAmount), played - fromSeconds, end.seconds - fromSeconds));
    }
    fromSeconds = end.seconds;
    fromAmount = end.amount;
  }
  return plus(fromAmount, scaled(minus(plan, fromAmount), played - fromSeconds, planned - fromSeconds));
};

/** `Session::planPeriodEnds`: only rising, positive seconds count. */
const planPeriodEnds = (session: ISessionApi): { seconds: number; amount: Exact }[] => {
  const ends: { seconds: number; amount: Exact }[] = [];
  let last = 0;
  for (const end of session.plan_period_ends ?? []) {
    const seconds = Math.trunc(Number(end?.seconds ?? 0));
    if (!(seconds > last) || end?.amount === undefined || end.amount === null) continue;
    ends.push({ seconds, amount: exactOf(end.amount) });
    last = seconds;
  }
  return ends;
};

/**
 * The tariff's rate EXACTLY, as it was sold — `Session::tariffRate()`: the
 * pair the seat carries (`rate_price` for `rate_seconds`), else `hourly_rate`
 * per hour, else the package's price for its length. Null: no rate.
 */
const tariffRateOf = (session: ISessionApi): Rate | null => {
  const pairSeconds = Math.trunc(Number(session.rate_seconds ?? 0));
  if (session.rate_price !== null && session.rate_price !== undefined && pairSeconds > 0) {
    return { priceCents: centsOfAmount(session.rate_price), seconds: pairSeconds };
  }
  if (session.hourly_rate !== null && session.hourly_rate !== undefined) return perHour(toNumber(session.hourly_rate));
  const pkg = session.time_package;
  const minutes = Math.trunc(toNumber(pkg?.duration_minutes));
  if (!pkg || minutes <= 0) return null;
  return { priceCents: centsOfAmount(pkg.price), seconds: minutes * 60 };
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
    ? toMoney(exactOf(line.line_total ?? 0))
    : toMoney(times(exactOf(line.price), Math.trunc(toNumber(line.qty))));

/**
 * What the bill's lines are worth AT a given instant.
 *
 * The pads' own pair, one domain over: {@see sessionJoysticksTotalAt} ticks and
 * {@see sessionJoysticksTotal} is its "now" wrapper, and a rented extra needs
 * exactly the same treatment for exactly the same reason.
 *
 * ## Why this is not just `line_total`
 *
 * `line_total` is what the SERVER counted when the payload was built. On a
 * ticking tile that froze the chips' share between polls and then jumped it,
 * beside a seat figure moving every second — two numbers on one card
 * disagreeing about what time it is. The row carries `created_at`, so this
 * extrapolates from the same instant the backend measures from, and
 * `SessionPricingCalculator::itemSeconds()` is the function it mirrors.
 *
 * The clamps are that function's, in its order: the clock stops at
 * `returned_at` when the thing came back BEFORE the instant being shown — a
 * preview drawn at 20:00 must not know about 20:30 — and a row dated before
 * the session bills from the session, so a clock skew cannot charge for a
 * night nobody was here for.
 *
 * Every other line is a price and a count and takes no part in any of this.
 */
export const sessionItemsTotalAt = (session: ISessionApi, atRaw: number): number =>
  toMoney(itemsExactAt(session, billableAt(session, atRaw)));

/** {@link sessionItemsTotalAt}, exactly: each line's own worth, never cut to the cent. */
/** Which lines to sum: all of them, only those billed by the hour, or only those at a fixed price. */
type LineKind = "all" | "hourly" | "fixed";

const itemsExactAt = (session: ISessionApi, at: number, kind: LineKind = "all"): Exact => {
  const startedAt = session.started_at ? Date.parse(session.started_at) : NaN;

  return (session.items ?? []).reduce((sum: Exact, line) => {
    if (kind === "hourly" && !line.is_hourly) return sum;
    if (kind === "fixed" && line.is_hourly) return sum;
    const qty = Math.trunc(toNumber(line.qty));
    if (!line.is_hourly) return plus(sum, times(exactOf(line.price), qty));

    const created = line.created_at ? Date.parse(line.created_at) : NaN;
    if (Number.isNaN(created)) {
      // No instant to measure from: fall back to the server's own figure
      // rather than to zero, which would read as "this is free".
      return plus(sum, exactOf(line.line_total ?? 0));
    }

    const from = !Number.isNaN(startedAt) && created < startedAt ? startedAt : created;
    const returned = line.returned_at ? Date.parse(line.returned_at) : NaN;
    const to = Number.isNaN(returned) ? at : Math.min(returned, at);
    // A pause stops this meter with the seat's, as the calculator does.
    const seconds = Math.max(0, Math.floor((to - from) / 1000) - pausedSecondsBetween(session, from, to));

    return plus(sum, times(rateFor(perHourOf(line.price), seconds), qty));
  }, ZERO);
};

export const sessionItemsTotal = (session: ISessionApi): number =>
  toMoney((session.items ?? []).reduce(
    (sum: Exact, line) => plus(sum, line.is_hourly
      ? exactOf(line.line_total ?? 0)
      : times(exactOf(line.price), Math.trunc(toNumber(line.qty)))),
    ZERO,
  ));



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
export const sessionJoysticksTotalAt = (session: ISessionApi, atRaw: number): number =>
  toMoney(padsExactAt(session, billableAt(session, atRaw)));

/** {@link sessionJoysticksTotalAt}, exactly. */
const padsExactAt = (session: ISessionApi, at: number): Exact =>
  (session.joysticks ?? []).reduce((sum: Exact, pad) => {
    // An HOURLY pad is priced like the seat: for the time it was actually
    // out. The row is the interval, so this mirrors
    // `SessionPricingCalculator` exactly — the end is clamped to the instant
    // being shown, so a pad still in play ticks and one handed back stopped
    // ticking when it was handed back. Exactly rate × seconds / 3600, and
    // rounding is deliberately NOT applied per term on either side: a bill
    // is rounded once, on its total.
    if (pad.is_hourly) {
      const from = Date.parse(pad.started_at);
      if (Number.isNaN(from)) return sum;
      const stopped = pad.stopped_at ? Date.parse(pad.stopped_at) : NaN;
      const to = Number.isNaN(stopped) ? at : Math.min(stopped, at);
      // A pause stops this meter with the seat's, as the calculator does.
      const seconds = Math.max(0, Math.floor((to - from) / 1000) - pausedSecondsBetween(session, from, to));
      return plus(sum, rateFor(perHourOf(pad.price), seconds));
    }

    return pad.is_charged ? plus(sum, exactOf(pad.price)) : sum;
  }, ZERO);

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
  const pads = (session.joysticks ?? [])
    .filter((pad) => pad.is_hourly && pad.stopped_at === null)
    .reduce((sum, pad) => sum + toNumber(pad.price), 0);

  /**
   * ⚠️ The room's own extra moves the rate too, on the pads' own rule.
   *
   * A poker table at 1 000/h lending 500/h chips IS a 1 500/h seat while they
   * are out, and the cashier quotes what the tile says. The money already came
   * to 1 500 — the chips accrue on their own bill line — so this was never a
   * pricing bug; the tile simply did not say the sentence, and a cashier
   * reading "1 000/h" beside a bill growing at 1 500 has to work out why.
   *
   * `qty` multiplies, because two cues out is two rates running. `returned_at`
   * is this table's `stopped_at`: handed back, the rate goes with it. A FIXED
   * extra is a price and never a tariff, exactly as a pad's flat fee is not.
   */
  const rented = (session.items ?? [])
    .filter((line) => line.is_hourly && !line.returned_at)
    .reduce((sum, line) => sum + billCents(toNumber(line.price)) * Math.trunc(toNumber(line.qty)), 0);

  // Rates to the cent, added as whole cents: no float drift.
  return (billCents(base) + billCents(pads) + rented) / 100;
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
export const sessionAmountAt = (session: ISessionApi, atRaw: number): number => {
  if (session.is_free) return 0;
  const at = billableAt(session, atRaw);
  const step = session.rounding_step ?? 0;
  const mode = session.rounding_mode ?? "up";
  const seatExact = plus(minimumChargeExactAt(session, at).exact, padsExactAt(session, at));

  // The current rule (2026-11-24, owner): the step rounds the SEAT — time,
  // pads and lines billed by the hour — and each fixed-price line (a cola)
  // is added at exactly its price. `SessionPricingCalculator::seatRoundedTotal`.
  if (session.rounding_covers_products === false) {
    const seat = applyRounding(toMoney(plus(seatExact, itemsExactAt(session, at, "hourly"))), step, mode);
    const fixed = toMoney(itemsExactAt(session, at, "fixed"));
    return (billCents(seat) + billCents(fixed)) / 100;
  }

  // A bill banked before it (and an older backend): every part exact,
  // summed, rounded to the cent ONCE, then the step on the whole sum —
  // `SessionPricingCalculator::bill()` under the `exact` rule.
  const subtotal = toMoney(plus(seatExact, itemsExactAt(session, at)));
  return applyRounding(subtotal, step, mode);
};

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
  // In whole cents, so no float ever decides which side of a step a bill falls.
  const cents = billCents(amount);
  if (step <= 0 || cents === 0) return cents / 100;

  const stepCents = Math.round(step * 100);
  const floor = Math.floor(cents / stepCents) * stepCents;
  const remainder = cents - floor;

  if (remainder === 0) return floor / 100;

  if (mode === "down") return floor / 100;
  if (mode === "up") return (floor + stepCents) / 100;

  return remainder * 2 >= stepCents ? (floor + stepCents) / 100 : floor / 100;
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
 * How many seconds of `[from, to)` fell inside a pause.
 *
 * Mirrors `Session::pausedSecondsBetween()` — THE one answer every time-based
 * term subtracts (the seat, an hourly pad, an hourly extra), each over its
 * OWN interval, which is why the pauses travel as intervals. An open pause
 * runs to `to`, which is what holds every figure still while the session is
 * paused. A payload that carries `paused_at` but not the intervals (a partial
 * answer) is read as that one open pause, so it never under-states a pause
 * the server says is running.
 *
 * 0 for a session never paused — nothing that existed before moves.
 */
export const pausedSecondsBetween = (
  session: ISessionApi,
  from: number,
  to: number,
  /** Only pauses resumed before this instant (a plan's length). */
  resumedBefore?: number,
): number => {
  if (!(to > from)) return 0;

  const pauses = session.pauses
    ?? (session.paused_at ? [{ paused_at: session.paused_at, resumed_at: null }] : []);

  let paused = 0;
  for (const pause of pauses) {
    const pausedAt = Date.parse(pause.paused_at);
    if (Number.isNaN(pausedAt)) continue;
    if (resumedBefore !== undefined
      && (!pause.resumed_at || !(Date.parse(pause.resumed_at) < resumedBefore))) continue;

    const start = Math.max(pausedAt, from);
    // An open pause ends at its limit even before anyone presses Resume:
    // the server resumes it there (`auto_resume_at`) and bills from there.
    const until = pause.resumed_at ?? pause.auto_resume_at ?? null;
    const resumed = until ? Date.parse(until) : NaN;
    const end = !Number.isNaN(resumed) && resumed < to ? resumed : to;

    if (end > start) paused += Math.floor((end - start) / 1000);
  }

  return paused;
};

/**
 * The instant a RUNNING seat's time runs out, or null when nothing ends it by
 * itself — `Session::billableUntil()` on the server (2026-11-15), the same
 * three answers. No running seat is billed later than this
 * (`SessionPricingCalculator::clampToEnd`): an hour at 1000 on a branch
 * rounding up to 100 read 1100 for the seconds between its end and the sweep.
 *
 *  - running, not paused: `ends_at`;
 *  - paused with a limit: `ends_at` moved by the whole pause (the server
 *    resumes it AT the limit, the same arithmetic);
 *  - paused with no limit, no end (count-up, unlimited), or closed: null.
 */
export const billableUntilOf = (session: ISessionApi): number | null => {
  if (session.status !== "active" || !session.ends_at) return null;
  const endsAt = Date.parse(session.ends_at);
  if (Number.isNaN(endsAt)) return null;
  if (!session.paused_at) return endsAt;
  const pausedAt = Date.parse(session.paused_at);
  const limit = autoResumeAtOf(session);
  return limit !== null && limit > pausedAt ? endsAt + Math.floor((limit - pausedAt) / 1000) * 1000 : null;
};

/** `at`, never past the seat's billable end (`clampToEnd`). */
const billableAt = (session: ISessionApi, at: number): number => {
  const end = billableUntilOf(session);
  return end !== null && end < at ? end : at;
};

/**
 * When the SERVER will resume this paused session by itself, or null.
 *
 * The open pause's `auto_resume_at`, fixed when the pause began from the
 * branch's limit. Null when the session is not paused or the branch sets no
 * limit. The panel only shows it and wakes up at it — the resume itself is
 * the backend's, and happens whether or not any panel is open.
 */
export const autoResumeAtOf = (session: ISessionApi): number | null => {
  if (!session.paused_at) return null;
  const open = (session.pauses ?? []).find((p) => p.resumed_at === null);
  const at = open?.auto_resume_at ? Date.parse(open.auto_resume_at) : NaN;
  return Number.isNaN(at) ? null : at;
};

/**
 * The first moment (whole seconds), no later than `at`, at which the visit had
 * PLAYED `seconds` — `Session::instantAtPlayed()` on the server, the same
 * search: played time only grows, so the first second it reaches `seconds`.
 */
export const instantAtPlayed = (session: ISessionApi, seconds: number, at: number): number => {
  const start = Math.floor(new Date(session.started_at as string).getTime() / 1000);
  let lo = start + Math.max(0, seconds);
  let hi = Math.floor(at / 1000);
  if (lo >= hi) return at;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (playedSecondsBetween(session, session.started_at, mid * 1000) >= seconds) hi = mid;
    else lo = mid + 1;
  }
  return lo * 1000;
};

/**
 * Seconds PLAYED from an ISO instant to a moment: elapsed minus paused.
 * `Session::secondsBetween()` on the server, pauses and all.
 */
export const playedSecondsBetween = (
  session: ISessionApi,
  fromIso: string | null | undefined,
  at: number,
): number => {
  const elapsed = secondsBetween(fromIso, at);
  if (elapsed === 0) return 0;

  return Math.max(0, elapsed - pausedSecondsBetween(session, new Date(fromIso as string).getTime(), at));
};

/**
 * An amount held EXACTLY — `ExactAmount` on the server: `n / d` CENTS, whole
 * numbers, `d > 0`. Never a float: a float cannot hold 1/3 of a cent, and
 * cannot hold 1249.995 either (it reads 1249.9949999…).
 */
interface Exact {
  n: bigint;
  d: bigint;
}

const ZERO: Exact = { n: 0n, d: 1n };

/**
 * A rate as it was sold — `Rate` on the server: `priceCents` for `seconds` of
 * play. 1000 an hour is 100000 for 3600; a 2500 / 180 min deal 250000 for
 * 10800, never 833.33 an hour.
 */
interface Rate {
  priceCents: bigint;
  seconds: number;
}

/** A stored amount (`decimal(10,2)`, string or number) in whole cents — the panel's one cents helper. */
const centsOfAmount = (v: number | string | null | undefined): bigint => BigInt(billCents(toNumber(v)));

const exactOf = (v: number | string | null | undefined): Exact => ({ n: centsOfAmount(v), d: 1n });

const perHour = (rate: number): Rate => ({ priceCents: BigInt(billCents(rate)), seconds: 3600 });

const perHourOf = (v: number | string | null | undefined): Rate => ({ priceCents: centsOfAmount(v), seconds: 3600 });

/** What `seconds` of play cost at `rate`, exactly; nothing for none. */
const rateFor = (rate: Rate, seconds: number): Exact =>
  seconds > 0 && rate.seconds > 0 ? reduce(rate.priceCents * BigInt(seconds), BigInt(rate.seconds)) : ZERO;

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};

const reduce = (n: bigint, d: bigint): Exact => {
  if (n === 0n) return ZERO;
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};

const plus = (a: Exact, b: Exact): Exact => reduce(a.n * b.d + b.n * a.d, a.d * b.d);

const minus = (a: Exact, b: Exact): Exact => reduce(a.n * b.d - b.n * a.d, a.d * b.d);

const times = (a: Exact, k: number): Exact => reduce(a.n * BigInt(k), a.d);

/** `× part ÷ whole`; nothing when `whole` is not positive. */
const scaled = (a: Exact, part: number, whole: number): Exact =>
  whole > 0 ? reduce(a.n * BigInt(part), a.d * BigInt(whole)) : ZERO;

const nonNegative = (a: Exact): Exact => (a.n < 0n ? ZERO : a);

const compare = (a: Exact, b: Exact): number => {
  const diff = a.n * b.d - b.n * a.d;
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
};

/**
 * To the cent, halves away from zero — `Money::round` / `ExactAmount::toMoney`
 * — as a number of drams with two decimals (whole cents ÷ 100).
 */
const toMoney = (a: Exact): number => {
  const negative = a.n < 0n;
  const abs = negative ? -a.n : a.n;
  const cents = (abs * 2n + a.d) / (2n * a.d);
  return Number(negative ? -cents : cents) / 100;
};

/** `decimal(10,2)` arrives as a string on some payloads and a number on others. */
const toNumber = (v: number | string | null | undefined): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
};
