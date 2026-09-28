import { useEffect, useRef } from "react";
import { autoResumeAtOf } from "./sessionAmount";
import { ISessionApi } from "@/types/sessions";

/**
 * Ask the server the moment a seat's paid time runs out.
 *
 * ## The delay this removes
 *
 * `SessionExpiryService` is exact — it ends every session whose `ends_at` has
 * passed, at `<=`, priced at `ends_at` itself. What it is not is SCHEDULED:
 * it rides a request. Three things carry it — the board's own read, the kiosk
 * agent's heartbeat, and a once-a-minute command gated behind
 * `SCHEDULER_ENABLED`, which is off on this deployment.
 *
 * So nothing fires AT the expiry instant. The tile's countdown reached 00:00
 * and the seat stayed busy until somebody's next poll thirty seconds later.
 *
 * ## What this does instead
 *
 * One timeout, aimed at an absolute instant the client already knows to the
 * second, which calls back and lets the caller re-read. Not a poll and not a
 * second clock: it sleeps until exactly `ends_at` and then asks once.
 *
 * The backend remains the only thing that decides. This asks the question;
 * `SessionExpiryService` answers it, under the row lock that makes a cashier's
 * Stop landing at the same instant produce exactly one ending.
 *
 * ## Why the earliest one is enough
 *
 * Waking for the soonest seat and re-reading returns a fresh list, which arms
 * the next one. A room of twenty seats therefore costs twenty wake-ups spread
 * across the evening, not twenty timers running at once.
 *
 * ⚠️ This is a panel with a board open. A venue whose panels are all closed
 * still relies on the next read or on `SCHEDULER_ENABLED` — that is the
 * deployment's guarantee and this cannot substitute for it.
 */
export const useExpiryNudge = (
  sessions: ISessionApi[] | null | undefined,
  onDue: () => void,
): void => {
  // Held in a ref so a caller that rebuilds its callback each render does not
  // re-arm the timeout on every render — the same reason the realtime hooks do
  // it, and here it would also mean never actually reaching the deadline.
  const dueRef = useRef(onDue);
  useEffect(() => { dueRef.current = onDue; }, [onDue]);

  // The instant to wake at, as a primitive.
  //
  // A performance nicety and NOT a correctness rule, which is worth saying
  // because it looks like one: the delay below is computed from an absolute
  // instant, so re-arming sleeps until the same wall-clock moment however often
  // it happens. Depending on the array instead would merely churn a timer on
  // every thirty-second poll. There is no behaviour here to pin, and no test
  // below pretends otherwise.
  const active = (sessions ?? []).filter((s) => s.status === "active");
  const soonest = [
    // A PAUSED seat's end is not due: it moves on resume, and the server will
    // not expire it however far the old one lies behind.
    ...active
      .filter((s) => s.ends_at !== null && s.is_unlimited !== true && !s.paused_at)
      .map((s) => new Date(s.ends_at as string).getTime()),
    // …but a LIMITED pause is due at its limit: the board read that follows
    // is what lets the server resume it on the spot (`sweepDuePauses`).
    ...active.map(autoResumeAtOf).filter((t): t is number => t !== null),
  ]
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];

  useEffect(() => {
    if (soonest === undefined) return;

    // A few hundred milliseconds PAST the deadline rather than exactly on it:
    // the browser's clock and the server's are not the same clock, and waking a
    // shade early means asking about a seat the server still considers active —
    // which achieves nothing and arms again immediately.
    //
    // A deadline already gone yields a non-positive delay, and `setTimeout`
    // fires those on the next tick. That is the wanted behaviour — the board is
    // showing a seat nobody has asked the server about yet — so it is left to
    // the platform rather than clamped here, where a clamp would be a rule
    // nothing could observe.
    const delay = soonest - Date.now() + 300;

    const timer = setTimeout(() => dueRef.current(), delay);
    return () => clearTimeout(timer);
  }, [soonest]);
};
