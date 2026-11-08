import { PC_STATUS_COLOR, type PcStatus } from "@/types/pc";
import { ISessionApi } from "@/types/sessions";
import { fmt } from "@/i18n/translations";
import type { CSSProperties, DragEventHandler } from "react";

/**
 * The parts of a seat card that are only markup (2026-11-03), moved out of
 * `SessionsBoard.renderCell` word for word, so the board and the interface
 * preview (`AppearancePreview`) draw a seat from the SAME pieces and can never
 * look different again. Nothing here reads data, holds state or runs a timer;
 * every value is the caller's, every handler is the caller's.
 */

interface GripProps {
  label: string;
  /** The board's reorder handlers; the preview passes none (not draggable). */
  onDragStart?: DragEventHandler<HTMLSpanElement>;
  onDragEnd?: DragEventHandler<HTMLSpanElement>;
}

/** The drag handle in the card's corner. */
export const SeatGrip = ({ label, onDragStart, onDragEnd }: GripProps) => (
  <span
    className="cell-grip"
    draggable={onDragStart !== undefined}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    title={label}
    aria-label={label}
  >
    ⠿
  </span>
);

interface PlatformProps {
  /** The DEVICE's connectivity (green reachable, red offline): the dot. */
  deviceStatus: PcStatus;
  platformName: string;
  tierName: string;
}

/**
 * Line 1 — WHAT this seat is: platform and tier, the same "PS5 · STANDARD"
 * wording the places board uses, so an operator reading both screens sees one
 * vocabulary. The agent dot keeps its place at the head of the line and is
 * `flexShrink: 0`, so it cannot be squeezed out by a long label.
 */
export const SeatPlatformLine = ({ deviceStatus, platformName, tierName }: PlatformProps) => (
  <span className="platform" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 18 }}>
    <span
      title={deviceStatus}
      style={{ width: 8, height: 8, borderRadius: 4, background: PC_STATUS_COLOR[deviceStatus], flexShrink: 0 }}
    />
    {/* Nested so the platform is the only thing that can shrink, and the
        4px gap reads as the single space in "PS5 · VIP". */}
    <span style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
      <span className="cell-line" title={platformName || undefined}>{platformName || " "}</span>
      {tierName && <span style={{ flexShrink: 0 }}>· {tierName}</span>}
    </span>
  </span>
);

/**
 * Line 2 — WHICH seat it is, at the card's identity size: one line, ellipsis,
 * the full text on hover. The NUMBER leads (`№5 · name`), the same value the
 * player is given on their phone.
 */
export const SeatNameLine = ({ text }: { text: string }) => (
  <span className="id cell-line" title={text}>{text}</span>
);

/**
 * What a running seat earns, in words, for its secondary line: "free", "no
 * limit", "800 / h", "800 / h · plan 1 600", or the package's name. The
 * tariff line answers "what is this seat earning per hour", and for a waived
 * session that is not the venue's rate.
 */
export const sessionTariffLine = (
  sess: ISessionApi,
  money: (amount: number) => string,
  t: (key: string) => string,
): string | null | undefined =>
  sess.is_free
    ? t("session.freeBill")
    : sess.is_unlimited
      ? t("session.unlimited")
      : sess.mode === "open"
        ? `${money(Number(sess.hourly_rate ?? 0))} / ${t("time.hourShort") || "h"}`
        // A planned hourly start (2026-10-25) has no package: it says its
        // rate and its plan, both the server's — the plan grows with
        // "+ Время"; the bill is still the clock's.
        : sess.package_name == null && sess.hourly_rate != null
          ? `${money(Number(sess.hourly_rate))} / ${t("time.hourShort") || "h"}`
            + (sess.committed_amount != null
              ? ` · ${fmt(t("session.planLine"), money(Number(sess.committed_amount)))}`
              : "")
          : sess.package_name;

/**
 * The pad line of a PlayStation seat (the frame; what goes in it is the
 * board's). Drawn on every PlayStation seat, empty until an extra pad is out
 * or a pad charge exists, so a seat's lines never jump when one appears.
 */
export const PAD_LINE_STYLE: CSSProperties = { gap: 6, fontSize: 12, flexWrap: "wrap" };
/**
 * Its first part, the count with its glyph. It wraps, and has to: once an
 * extra pad is out the line carries the identity AND what it earned, and that
 * plus the menu plus the take-back button wants 252px on a 160px tile. Nowrap
 * made the menu the only thing that could give, so it was squeezed to 21px.
 * The glyph and what it says stay together (the span inside is `nowrap`).
 */
export const PAD_COUNT_STYLE: CSSProperties = {
  gap: 4,
  alignItems: "center",
  flexWrap: "wrap",
  rowGap: 4,
  whiteSpace: "nowrap",
};
