import type { CSSProperties, ReactNode } from "react";

/** The rows and cards a shift report is laid out in, shared by its blocks. */
export const Row = ({ label, hint, value, strong, muted, testId }: {
  label: ReactNode; hint?: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; testId?: string;
}) => (
  <div className="row-between" style={rowStyle} data-testid={testId}>
    {/* The count sits under the label, never beside the amount: "продаж: 2"
        printed next to "3 000" read as "23 000" (2026-10-19). */}
    <span className={muted ? "muted" : undefined} style={{ minWidth: 0 }}>
      {label}
      {hint !== undefined && <span className="muted" style={hintStyle}>{hint}</span>}
    </span>
    {strong ? <strong style={valueStyle}>{value}</strong> : <span style={valueStyle}>{value}</span>}
  </div>
);

export const Section = ({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) => (
  <section className="card col" style={{ gap: 2, minWidth: 0 }} data-testid={testId}>
    <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{title}</h3>
    {children}
  </section>
);

export const rowStyle: CSSProperties = { padding: "5px 0", gap: 16, alignItems: "baseline" };
const hintStyle: CSSProperties = { display: "block", fontSize: 12 };
export const valueStyle: CSSProperties = { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
export const divider: CSSProperties = { borderTop: "1px solid var(--color-border, rgba(255,255,255,0.12))", margin: "6px 0" };
