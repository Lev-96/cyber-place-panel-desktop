import { preciseWhenSmall } from "@/i18n/currency";
import { ISessionApi } from "@/types/sessions";
import { autoResumeAtOf, playedSecondsBetween, sessionAmountAt } from "./sessionAmount";
import { useEffect, useState } from "react";
import { sessionUrgency } from "./sessionUrgency";

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

interface Props {
  /**
   * The whole session, not the three or four fields the clock happens to need.
   *
   * It used to take `endsAt` / `startedAt` / `hourlyRate` / `isFree` loose, and
   * that shape is what let a fixed-package session render no money at all: the
   * caller passed an hourly rate the session does not have, so the countdown
   * branch had nothing to price from and quietly showed a clock and nothing
   * else. With the row itself, {@see sessionAmountAt} can answer for every mode.
   */
  session: ISessionApi;
  /**
   * Money formatter from LanguageContext. When provided, the running cost is
   * rendered in the user's display currency instead of as a raw decimal.
   */
  formatMoney?: (amountInBaseAmd: number, options?: { maximumFractionDigits?: number }) => string;
}

/**
 * The clock on a session tile, and what the seat is worth beside it.
 *
 * Two shapes, decided by whether the session has an end:
 *
 *   no end     counts UP from `started_at` — an open session, or a fixed one
 *              switched to unlimited.
 *   an end     counts DOWN to `ends_at`, which is what a cashier needs from a
 *              package: how long before the seat locks itself.
 *
 * The money is the same question in both, and {@see sessionAmountAt} is the one
 * place it is answered — mirroring the backend's `timeCostStringAt`. Before
 * this, only the count-up branch showed an amount and it computed its own.
 */
/** A clock that is not running: neither the live cyan nor a warning colour. */
const PAUSED_COLOR = "var(--color-muted)";

const SessionTimer = ({ session, formatMoney }: Props) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const amount = sessionAmountAt(session, now);
  // Whether to quote a figure at all, decided ONCE for both branches. A waived
  // session states its zero, because that zero is a decision somebody made; a
  // session with nothing to price from — an open one on a seat with no
  // configured rate — quotes nothing, because there is nothing to quote.
  const showCost = session.is_free || amount > 0;
  // A running total is the one place whole units are wrong. A venue charging
  // twelve an hour earns two hundredths of a unit in the first minute, so a
  // counter rounded to whole units reads "0" for five minutes while the clock
  // moves beside it — which looks like the money is not being counted at all.
  // Prices elsewhere are untouched: this asks for the precision, nothing else
  // does.
  const cost = showCost ? (
    <span className="session-timer__cost" style={{ marginLeft: 8, color: "var(--color-accent-purple)" }}>
      {formatMoney ? formatMoney(amount, preciseWhenSmall(amount)) : amount.toFixed(2)}
    </span>
  ) : null;

  const isOpen = !session.ends_at && !!session.started_at;
  // PAUSED: every figure here holds still — the SERVER's instants decide it,
  // not a stopped interval, so a reload or a dropped socket shows the same
  // frozen clock. The money already holds (the open pause runs to `now` and
  // is subtracted); the countdown holds at `ends_at − paused_at`, which is
  // exactly the time the player gets back on resume.
  const pausedAt = session.paused_at ? Date.parse(session.paused_at) : NaN;
  const paused = !Number.isNaN(pausedAt);
  const pausedMark = paused ? <span aria-hidden="true">⏸ </span> : null;
  // A LIMITED pause counts down to the instant the server resumes it. Shown
  // beside the frozen clock, never instead of it; past zero it holds at 0:00
  // until the board's next read brings the resumed row.
  const autoResumeAt = autoResumeAtOf(session);
  const autoResume = autoResumeAt !== null ? (
    <span data-testid="auto-resume" style={{ marginLeft: 8, color: "var(--color-warning)" }}>
      ▶ {fmt(Math.max(0, autoResumeAt - now))}
    </span>
  ) : null;

  if (isOpen) {
    // Time PLAYED, which is what the bill charges for — not wall time.
    const elapsedMs = playedSecondsBetween(session, session.started_at, now) * 1000;
    return (
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: paused ? PAUSED_COLOR : "var(--color-primary)" }}>
        {pausedMark}▲ {fmt(elapsedMs)}
        {autoResume}
        {cost}
      </span>
    );
  }

  if (!session.ends_at) return null;
  const remaining = new Date(session.ends_at).getTime() - (paused ? pausedAt : now);
  // The one urgency rule the card's frame reads too (sessionUrgency.ts).
  const urgency = sessionUrgency(session, now);
  const color = paused
    ? PAUSED_COLOR
    : urgency === "crit" ? "var(--color-danger)"
    : urgency === "warn" ? "var(--color-warning)"
    : "var(--color-primary)";
  return (
    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
      <span style={{ color }}>{pausedMark}{fmt(remaining)}</span>
      {autoResume}
      {cost}
    </span>
  );
};

export default SessionTimer;
