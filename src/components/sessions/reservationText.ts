import type { Booking } from "@/domain/Booking";
import { formatArmenianPhone } from "@/utils/armenianPhone";

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "15:00–16:00": a reserved seat's line on its card (2026-11-07). */
export const reservationWindow = (b: Booking): string => `${hm(b.start)}–${hm(b.end)}`;

/**
 * A reserved seat's tooltip: what it is, who is coming, how to reach them and
 * when — one fact per line. A reservation made without a name says so.
 */
export const reservationTip = (b: Booking, t: (key: string) => string): string =>
  [
    t("session.reserved"),
    b.contactName ?? (b.raw.guest_id == null ? t("reserve.noName") : null),
    b.contactPhone ? formatArmenianPhone(b.contactPhone) : null,
    reservationWindow(b),
  ].filter(Boolean).join("\n");
