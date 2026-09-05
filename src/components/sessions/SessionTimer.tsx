import { preciseWhenSmall } from "@/i18n/currency";
import { useEffect, useState } from "react";

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

interface Props {
  // Fixed-package session: counts down from `endsAt`.
  // Open session: pass `startedAt` + `hourlyRate`, leave `endsAt` null/undefined.
  endsAt?: string | null;
  startedAt?: string | null;
  hourlyRate?: number | string | null;
  /**
   * The bill is waived. The clock is NOT: it keeps counting up exactly as it
   * would for a paying session, because how long the seat has been in play is
   * a fact the floor needs whoever is paying for it. Only the money is zero.
   *
   * Without this the tile showed a free session's cost ticking up at the
   * venue's rate — a number that was never going to be charged, sitting next to
   * a "Free" pill that contradicted it.
   */
  isFree?: boolean;
  /**
   * Money formatter from LanguageContext. When provided, the running cost is
   * rendered in the user's display currency instead of as a raw decimal.
   */
  formatMoney?: (amountInBaseAmd: number, options?: { maximumFractionDigits?: number }) => string;
}

const SessionTimer = ({ endsAt, startedAt, hourlyRate, formatMoney, isFree = false }: Props) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isOpen = !endsAt && !!startedAt;

  if (isOpen) {
    const elapsedMs = now - new Date(startedAt!).getTime();
    // Timer and billing are separate questions, and this is where they part:
    // `elapsedMs` above is computed the same way for every session, and only
    // the amount below knows what "free" means.
    const rate = Number(hourlyRate ?? 0);
    const cost = isFree || rate <= 0 ? 0 : (elapsedMs / 3_600_000) * rate;
    // Whether to quote an amount at all, decided ONCE. A waived session states
    // its zero, because that zero is a decision somebody made; a paying session
    // with no configured rate quotes nothing, because there is nothing to
    // quote. Deciding this a second time in the markup below is how the two
    // halves come to disagree.
    const showCost = isFree || rate > 0;
    // A running total is the one place whole units are wrong. A venue charging
    // twelve an hour earns two hundredths of a unit in the first minute, so a
    // counter rounded to whole units reads "0" for five minutes while the clock
    // moves beside it — which looks like the money is not being counted at all.
    // Prices elsewhere are untouched: this asks for the precision, nothing
    // else does.
    const costLabel = formatMoney
      ? formatMoney(cost, preciseWhenSmall(cost))
      : cost.toFixed(2);
    return (
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#07ddf1" }}>
        ▲ {fmt(elapsedMs)}
        {showCost && <span style={{ marginLeft: 8, color: "#d152fa" }}>{costLabel}</span>}
      </span>
    );
  }

  if (!endsAt) return null;
  const remaining = new Date(endsAt).getTime() - now;
  const warn = remaining <= 5 * 60_000;
  const crit = remaining <= 60_000;
  const color = crit ? "#ef4444" : warn ? "#f59e0b" : "#07ddf1";
  return (
    <span style={{ color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
      {fmt(remaining)}
    </span>
  );
};

export default SessionTimer;
