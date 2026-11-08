import type { IStaffReservationApi } from "@/types/api";

/**
 * A row of the bookings calendar with its window as `Date`s (2026-11-07).
 *
 * The window is the server's: `starts_at` / `ends_at` carry the offset, and
 * `ends_at` is the EFFECTIVE end (the guest's "I'm late" extension included),
 * so nothing here adds minutes up. The panel runs on venue machines in
 * Asia/Yerevan, so a local `Date` is the venue clock (as `Booking.parseStart`
 * assumes).
 */
export interface StaffReservation extends IStaffReservationApi {
  start: Date;
  end: Date;
}

/**
 * The window from the ISO instants; a row whose ISO is unreadable (an older
 * backend) falls back to its naive local date + time and length.
 */
export const toStaffReservation = (raw: IStaffReservationApi): StaffReservation => {
  const isoStart = new Date(raw.starts_at);
  const start = Number.isNaN(isoStart.getTime()) ? new Date(`${raw.booking_date}T${raw.start_time}`) : isoStart;
  const isoEnd = new Date(raw.ends_at);
  const end = Number.isNaN(isoEnd.getTime()) ? new Date(start.getTime() + raw.duration_minutes * 60_000) : isoEnd;
  return { ...raw, start, end };
};

/** Statuses a reservation is still waiting in: the ones a cancel applies to. */
const AWAITING: ReadonlySet<IStaffReservationApi["status"]> = new Set(["pending", "confirmed", "rescheduled"]);

/** Whether «Отменить бронь» applies: still awaiting the player and nobody has sat down on it. */
export const isCancellable = (r: IStaffReservationApi): boolean => AWAITING.has(r.status) && r.session_id === null;

/** Who is coming, as the calendar names them: what staff typed, else the app guest's name. */
export const reservationWho = (r: IStaffReservationApi): string | null => r.contact_name ?? r.guest_name ?? null;
