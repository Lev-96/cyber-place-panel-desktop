import { useEffect, useState } from "react";

/**
 * Below this, a running total is shown with decimals.
 *
 * Above it the fraction is noise — nobody reads the hundredths on a four-figure
 * bill — and whole units are what every other price in the panel uses.
 */
const SMALL_AMOUNT = 100;

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
   * Money formatter from LanguageContext. When provided, the running cost is
   * rendered in the user's display currency instead of as a raw decimal.
   */
  formatMoney?: (amountInBaseAmd: number, options?: { maximumFractionDigits?: number }) => string;
}

const SessionTimer = ({ endsAt, startedAt, hourlyRate, formatMoney }: Props) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isOpen = !endsAt && !!startedAt;

  if (isOpen) {
    const elapsedMs = now - new Date(startedAt!).getTime();
    const rate = Number(hourlyRate ?? 0);
    const cost = rate > 0 ? (elapsedMs / 3_600_000) * rate : 0;
    // A running total is the one place whole units are wrong. A venue charging
    // twelve an hour earns two hundredths of a unit in the first minute, so a
    // counter rounded to whole units reads "0" for five minutes while the clock
    // moves beside it — which looks like the money is not being counted at all.
    // Prices elsewhere are untouched: this asks for the precision, nothing
    // else does.
    const costLabel = formatMoney
      ? formatMoney(cost, cost < SMALL_AMOUNT ? { maximumFractionDigits: 2 } : undefined)
      : cost.toFixed(2);
    return (
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#07ddf1" }}>
        ▲ {fmt(elapsedMs)}
        {rate > 0 && <span style={{ marginLeft: 8, color: "#d152fa" }}>{costLabel}</span>}
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
