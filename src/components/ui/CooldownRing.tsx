interface Props {
  /** Seconds remaining. */
  remaining: number;
  /** Total seconds the ring represents (drives the depletion). */
  total: number;
}

const mmss = (s: number): string => {
  const v = Math.max(0, s);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

/**
 * A small neon ring that depletes as the countdown runs, with the remaining
 * time in the centre-right. Reusable next to any "resend after cooldown"
 * control (email code, password reset code, …).
 */
const CooldownRing = ({ remaining, total }: Props) => {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" stroke="#1f2a44" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="#07ddf1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{mmss(remaining)}</span>
    </span>
  );
};

export default CooldownRing;
