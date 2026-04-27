import { useEffect, useState } from "react";

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const SessionTimer = ({ endsAt }: { endsAt: string }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
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
