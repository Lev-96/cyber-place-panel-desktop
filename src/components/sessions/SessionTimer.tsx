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
   * Money formatter from LanguageContext. When provided, the running cost is
   * rendered in the user's display currency instead of as a raw decimal.
   */
  formatMoney?: (amountInBaseAmd: number) => string;
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
    const costLabel = formatMoney ? formatMoney(cost) : cost.toFixed(2);
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
