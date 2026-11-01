import type { StatusTone } from "@/domain/statusTone";
import { toneLook } from "@/domain/statusTone";
import type { CSSProperties } from "react";

/**
 * A seat's state said three ways at once (2026-10-27): its colour, an icon of
 * its own shape, and the word. Read from across the room by the colour, and by
 * anyone who cannot tell green from amber by the icon and the word.
 */
interface Props {
  tone: StatusTone;
  label: string;
  /** Full sentence for the tooltip / screen reader, when the chip is short. */
  title?: string;
  className?: string;
}

/** 12 px glyphs drawn in the chip's own colour; each tone a different shape. */
export const StatusIcon = ({ tone }: { tone: StatusTone }) => {
  const common = { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": true as const, focusable: false as const };
  switch (tone) {
    case "free":
      return <svg {...common}><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
    case "playing":
      return <svg {...common}><path d="M3.5 2.2v7.6L10 6z" fill="currentColor" /></svg>;
    case "booked":
      return <svg {...common}><rect x="1.8" y="2.6" width="8.4" height="7.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M1.8 5h8.4M4 1.4v2.2M8 1.4v2.2" stroke="currentColor" strokeWidth="1.4" /></svg>;
    case "ending":
      return <svg {...common}><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 3.2V6l2 1.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
    case "critical":
      return <svg {...common}><path d="M6 1.2 11 10.4H1z" fill="currentColor" /><path d="M6 4.6v2.8" style={{ stroke: "var(--color-bg)" }} strokeWidth="1.5" strokeLinecap="round" /><circle cx="6" cy="8.9" r=".8" style={{ fill: "var(--color-bg)" }} /></svg>;
    case "paused":
      return <svg {...common}><path d="M3.4 2.4h1.8v7.2H3.4zM6.8 2.4h1.8v7.2H6.8z" fill="currentColor" /></svg>;
    case "offline":
      return <svg {...common}><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.6" /><path d="M4 4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
  }
};

const StatusChip = ({ tone, label, title, className }: Props) => {
  const look = toneLook(tone);
  return (
    <span
      className={["status-chip", `status-chip--${tone}`, className ?? ""].filter(Boolean).join(" ")}
      style={{ "--chip-fg": look.fg, "--chip-bg": look.bg, "--chip-border": look.border } as CSSProperties}
      title={title ?? label}
      data-tone={tone}
    >
      <StatusIcon tone={tone} />
      <span className="status-chip__text">{label}</span>
    </span>
  );
};

export default StatusChip;
