import { CSSProperties, DragEventHandler, ReactNode } from "react";
import { ISessionApi } from "@/types/sessions";
import type { SessionCellState } from "@/domain/SessionCellState";
import { SessionUrgency, useSessionUrgency } from "./sessionUrgency";

interface Props {
  /** The running session on this seat, or undefined for a free one. */
  session?: ISessionApi;
  /**
   * The seat's own state colour (free / reserved / offline / busy), as
   * `SESSION_CELL_COLOR` resolves it. Urgency overrides it on a running seat.
   */
  baseColor: string;
  /**
   * The seat's state as `resolveSessionCellState` decides it. Styles key off
   * it: an offline device gets a dashed frame, a free seat a readable status.
   */
  seatState: SessionCellState;
  dragging?: boolean;
  dropBefore?: boolean;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  children: ReactNode;
}

/** The frame colour for an urgency, or null to keep the seat's own. */
const accentFor = (urgency: SessionUrgency | null): string | null => {
  switch (urgency) {
    case "crit": return "var(--color-danger)";
    case "warn": return "var(--color-warning)";
    case "paused": return "var(--color-muted)";
    default: return null;
  }
};

/**
 * The frame of one seat on the sessions board — presentation only.
 *
 * It owns exactly one decision: what colour the frame is. A running seat's
 * frame follows `useSessionUrgency` (amber in its last five minutes, red in its
 * last one, muted while paused), so "act now" is readable from across the room
 * and not only in the digits. Everything inside is the caller's; the colour is
 * handed down as `--card-accent` so the status dot and line can use it without
 * props.
 *
 * Keeps the `place-cell` class and the drag classes the board, its tests and
 * the e2e suite rely on; everything new is scoped under `session-card`, because
 * `.place-cell` itself is shared with the places and live boards.
 */
const SessionCard = ({
  session, baseColor, seatState, dragging = false, dropBefore = false, onDragOver, onDrop, children,
}: Props) => {
  const urgency = useSessionUrgency(session);
  const accent = accentFor(urgency) ?? baseColor;

  const className = [
    "place-cell",
    "session-card",
    session ? "session-card--running" : "session-card--idle",
    urgency && urgency !== "none" && urgency !== "normal" ? `session-card--${urgency}` : "",
    `session-card--seat-${seatState}`,
    dragging ? "is-dragging" : "",
    dropBefore ? "is-drop-before" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      data-urgency={urgency ?? undefined}
      style={{ borderColor: accent, "--card-accent": accent } as CSSProperties}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
};

export default SessionCard;
