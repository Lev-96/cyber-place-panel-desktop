import type { IBookingEvent } from "@/api/bookings";

const hm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const KNOWN_REASONS = new Set(["no_show", "expired_at_scan"]);

/** The step's verb ("создана", "отменена"…). */
export const bookingEventActionKey = (e: IBookingEvent): string => `bookingHistory.action.${e.action}`;

/** Who did it: the staff member, the guest in the app, or the system (a sweep, the scheduler). */
export const bookingEventActor = (e: IBookingEvent, t: (k: string) => string): string => {
  if (e.user) return e.user.name;
  const by = e.meta?.by;
  return t(by === "guest" ? "bookingHistory.byGuest" : by === "staff" ? "bookingHistory.byStaff" : "bookingHistory.bySystem");
};

/** "№4 · 16:00–17:00 · Арам": which booking the step was about. */
export const bookingEventSubject = (e: IBookingEvent, t: (k: string) => string): string => {
  const b = e.booking;
  if (!b) return `#${e.booking_id}`;
  const seats = b.place_numbers.length > 0 ? b.place_numbers.map((n) => `№${n}`).join(", ") : `#${b.id}`;
  return [seats, `${hm(b.starts_at)}–${hm(b.ends_at)}`, b.who ?? t("reserve.noName")].join(" · ");
};

/** The step's own detail, when it has one: a reason, what was moved. Never a raw phone. */
export const bookingEventDetail = (e: IBookingEvent, t: (k: string) => string): string | null => {
  const m = e.meta ?? {};
  if (e.action === "cancelled" && typeof m.reason === "string") {
    // The reasons the server writes itself are worded; a guest's own slug is shown as sent.
    return KNOWN_REASONS.has(m.reason) ? t(`bookingHistory.reason.${m.reason}`) : m.reason;
  }
  if (e.action === "updated" && m.changes && typeof m.changes === "object") {
    const c = m.changes as Record<string, { from?: unknown; to?: unknown } | string[]>;
    const parts: string[] = [];
    const start = c.starts_at as { from?: string; to?: string } | undefined;
    if (start?.from && start.to) parts.push(`${t("bookingHistory.field.time")} ${hm(start.from)} → ${hm(start.to)}`);
    const mins = c.minutes as { from?: number; to?: number } | undefined;
    if (mins?.from !== undefined && mins.to !== undefined) parts.push(`${t("bookingHistory.field.minutes")} ${mins.from} → ${mins.to}`);
    if (c.place_ids) parts.push(t("bookingHistory.field.seat"));
    if (Array.isArray(c.contact)) parts.push(t("bookingHistory.field.contact"));
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  if (e.action === "started" && typeof m.place_number === "number") return `№${m.place_number}`;
  return null;
};
