import { ButtonHTMLAttributes, CSSProperties, DragEventHandler, ReactNode, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { ISessionApi } from "@/types/sessions";
import type { SessionCellState } from "@/domain/SessionCellState";
import { SESSION_CELL_TONE } from "@/domain/SessionCellState";
import type { StatusTone } from "@/domain/statusTone";
import { StatusIcon } from "@/components/ui/StatusChip";
import { SessionUrgency, useSessionUrgency } from "./sessionUrgency";
import type { DropSide } from "@/utils/reorder";

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
  /**
   * The word for the seat's state (2026-10-27), shown as the tooltip and the
   * accessible name of the state icon in the corner. The board passes its
   * translation; the card decides which state it is.
   */
  stateLabel?: (tone: StatusTone) => string;
  dragging?: boolean;
  /** The drop will land on this edge of the seat (`utils/reorder.ts` `dropSideOf`). */
  dropSide?: DropSide | null;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  children: ReactNode;
}

/** The tone of a running seat by its urgency, or null for an ordinary one. */
const urgencyTone = (urgency: SessionUrgency | null): StatusTone | null => {
  switch (urgency) {
    case "crit": return "critical";
    case "warn": return "ending";
    case "paused": return "paused";
    default: return null;
  }
};

/**
 * Which state the seat is in, as one of the shared tones (2026-10-27): a
 * running seat by its urgency, an idle one by its seat state.
 */
export const seatTone = (hasSession: boolean, urgency: SessionUrgency | null, seatState: SessionCellState): StatusTone =>
  (hasSession ? urgencyTone(urgency) ?? "playing" : null) ?? SESSION_CELL_TONE[seatState];

/** The frame colour for a tone: the full colour of its status token. */
export const accentOf = (tone: StatusTone): string =>
  `rgb(var(--status-${tone === "paused" ? "offline" : tone}-rgb))`;

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
  session, baseColor, seatState, stateLabel, dragging = false, dropSide = null, onDragOver, onDrop, children,
}: Props) => {
  const urgency = useSessionUrgency(session);
  const tone = seatTone(Boolean(session), urgency, seatState);
  // An urgent seat's frame is its urgency; otherwise the seat's own colour.
  const urgent = session ? urgencyTone(urgency) : null;
  const accent = urgent ? accentOf(urgent) : baseColor;
  const label = stateLabel?.(tone);

  const className = [
    "place-cell",
    "session-card",
    session ? "session-card--running" : "session-card--idle",
    urgency && urgency !== "none" && urgency !== "normal" ? `session-card--${urgency}` : "",
    `session-card--seat-${seatState}`,
    dragging ? "is-dragging" : "",
    dropSide ? `is-drop-${dropSide}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      data-urgency={urgency ?? undefined}
      data-tone={tone}
      style={{ borderColor: accent, "--card-accent": accent } as CSSProperties}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* The state, said by shape as well as colour (2026-10-27): a stripe
          down the edge in the seat's colour, and an icon in the corner whose
          shape is the state's own — ▶ playing, ‖ paused, a clock ending, ⚠
          critical, a dashed ring offline. Never colour alone. */}
      <span className="session-card__stripe" aria-hidden />
      <span className="session-card__state" role="img" aria-label={label} title={label}>
        <StatusIcon tone={tone} />
        {/* The word itself, shown where the interface asks for it (Simple,
            list); the accessible name is already the label above. */}
        {label && <span className="session-card__state-word" aria-hidden>{label}</span>}
      </span>
      {children}
    </div>
  );
};

interface ActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title" | "aria-label"> {
  /** What the button SHOWS: short, one line, so every button is one height. */
  label: string;
  /**
   * What it DOES, in full — its accessible name and its tooltip. The card
   * shows "+ Время"; a screen reader, a hover and every test that finds the
   * button by name get "Добавить время".
   */
  fullLabel: string;
  /** Destructive (Stop): red, and it spans the row. */
  danger?: boolean;
  /** Spans the whole row, like Stop (e.g. «Пересадить»). */
  wide?: boolean;
}

/**
 * One button in a card's action grid. Every action on a session card goes
 * through this, which is what keeps them one height, one line and one style.
 */
export const SessionCardAction = ({ label, fullLabel, danger = false, wide = false, className, ...rest }: ActionProps) => (
  <Button
    variant="secondary"
    {...rest}
    title={fullLabel}
    aria-label={fullLabel}
    className={[
      "session-card__btn",
      danger || wide ? "session-card__btn--wide" : "",
      danger ? "is-danger" : "",
      className ?? "",
    ].filter(Boolean).join(" ")}
  >
    {label}
  </Button>
);

export default SessionCard;

interface OverflowProps {
  /** Folded into «Ещё» (the Simple interface), or laid out as they always were. */
  collapsed: boolean;
  /** The menu button's words: shown, and its accessible name. */
  label: string;
  children: ReactNode;
}

/**
 * The card's less frequent actions (2026-10-27). In the Simple interface they
 * fold into one «Ещё» menu so the card shows its main actions only; in every
 * other interface they render exactly as before, inline, so nothing moves.
 *
 * The SAME buttons either way — same handlers, same disabled states, same
 * names — so no action is lost or duplicated by folding. The menu closes on
 * Escape, on a click outside, and after an action is chosen.
 */
export const CardOverflow = ({ collapsed, label, children }: OverflowProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!collapsed) return <>{children}</>;
  return (
    <div className="session-card__more" ref={root}>
      <Button
        variant="secondary"
        className="session-card__btn session-card__btn--wide"
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        aria-label={label}
        data-action="more"
        onClick={() => setOpen((v) => !v)}
      >
        {label} ▾
      </Button>
      {open && (
        // A click on any action inside closes the menu after it has run.
        <div className="session-card__menu" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
};
