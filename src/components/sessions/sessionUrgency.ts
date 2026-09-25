import { useEffect, useState } from "react";
import { ISessionApi } from "@/types/sessions";

/**
 * How urgently a running seat needs the cashier — ONE rule for every place
 * that shows it (the timer's digits, the card's frame), so the two can never
 * disagree about whether a seat is "ending soon".
 *
 *   none     no end to count down to: an open or unlimited session
 *   normal   an end, more than five minutes away
 *   warn     five minutes or less
 *   crit     one minute or less
 *   paused   the clock is stopped; its end moves on resume, nothing is urgent
 *
 * These are the thresholds `SessionTimer` has always coloured its digits by.
 */
export type SessionUrgency = "none" | "normal" | "warn" | "crit" | "paused";

export const URGENCY_WARN_MS = 5 * 60_000;
export const URGENCY_CRIT_MS = 60_000;

export const sessionUrgency = (session: ISessionApi, now: number): SessionUrgency => {
  if (session.paused_at) return "paused";
  if (!session.ends_at) return "none";

  const end = Date.parse(session.ends_at);
  if (Number.isNaN(end)) return "none";

  const remaining = end - now;
  if (remaining <= URGENCY_CRIT_MS) return "crit";
  if (remaining <= URGENCY_WARN_MS) return "warn";
  return "normal";
};

/**
 * `sessionUrgency` kept current without a per-second tick: it sleeps until the
 * next threshold (five minutes out, then one) and wakes once for each. A board
 * of forty seats re-renders a card twice in its last five minutes, not forty
 * times a second. A new `ends_at` (time added, a resume) re-aims it.
 */
export const useSessionUrgency = (session: ISessionApi | undefined): SessionUrgency | null => {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = session?.ends_at ?? null;
  const pausedAt = session?.paused_at ?? null;

  useEffect(() => {
    if (endsAt === null || pausedAt !== null) return;
    const end = Date.parse(endsAt);
    if (Number.isNaN(end)) return;

    const current = Date.now();
    const next = [end - URGENCY_WARN_MS, end - URGENCY_CRIT_MS].find((at) => at > current);
    // Re-read now even when no threshold is ahead, so a re-aimed end is
    // reflected at once rather than at the next unrelated render.
    if (next === undefined) {
      setNow(current);
      return;
    }

    setNow(current);
    const timer = setTimeout(() => setNow(Date.now()), next - current + 50);
    return () => clearTimeout(timer);
  }, [endsAt, pausedAt, now]);

  return session === undefined ? null : sessionUrgency(session, now);
};
