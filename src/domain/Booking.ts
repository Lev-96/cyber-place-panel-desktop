import { BookingStatusType, IBookingApi } from "@/types/api";

/**
 * Statuses where a booking is still holding the places listed in
 * its `place_bookings` pivot — must mirror the backend's
 * `App\Services\Booking\ConflictDetector::BLOCKING_STATUSES`. If
 * the two drift, a freshly placed booking can be invisible to
 * the Sessions board (which filters by this set) while the
 * backend still rejects overlapping submits.
 */
const BLOCKING_STATUSES: readonly BookingStatusType[] = [
  "pending",
  "confirmed",
  "rescheduled",
];

/**
 * How long before a reservation starts the seat stops being offered to a
 * walk-in.
 *
 * ⚠️ This constant exists because the rule used to have NO horizon at all:
 * `isReservingAt` asked only whether the booking's end was still ahead, which
 * is true of a reservation next Saturday. One booking made a week out painted
 * the seat orange today and `canStartSession` refused every walk-in on it
 * until the booking played out — six days of a seat a venue could not sell.
 *
 * Two hours is a judgement, and it is written down rather than derived because
 * there is nothing to derive it from. It is bounded on both sides:
 *
 *  - `Place.test.ts` pins "an upcoming booking reserves the seat" with an hour
 *    to go, so the horizon cannot be shorter than that without changing a
 *    decision somebody made on purpose;
 *  - and it has to be short enough that an evening reservation does not cost
 *    the venue the afternoon.
 *
 * Change it here and every screen that asks "is this seat spoken for" changes
 * with it.
 */
export const RESERVATION_LEAD_MS = 2 * 60 * 60_000;

export class Booking {
  readonly id: number;
  readonly branchId: number;
  readonly gameId: number;
  readonly companyId: number;
  readonly status: BookingStatusType;
  readonly start: Date;
  readonly end: Date;
  readonly placeCount: number;
  /**
   * Actual `places.id` values this booking holds — from the
   * `place_bookings` pivot. Empty array when the backend payload
   * pre-dates the enrichment (older deploys); consumers must
   * handle the empty case gracefully.
   */
  readonly placeIds: readonly number[];
  /** Human-readable seat numbers, parallel to `placeIds`. */
  readonly placeNumbers: readonly number[];
  readonly platform: string;
  readonly raw: IBookingApi;

  constructor(raw: IBookingApi) {
    this.raw = raw;
    this.id = raw.id;
    this.branchId = raw.branch_id;
    this.gameId = raw.game_id;
    this.companyId = raw.company_id;
    this.status = raw.status;
    this.placeCount = raw.place_booking_count ?? 1;
    this.placeIds = Object.freeze([...(raw.place_ids ?? [])]);
    this.placeNumbers = Object.freeze([...(raw.place_numbers ?? [])]);
    this.platform = raw.game?.platform ?? "";
    this.start = Booking.parseStart(raw);
    this.end = new Date(this.start.getTime() + (raw.duration_minutes + (raw.rescheduled_minutes ?? 0)) * 60_000);
  }

  private static parseStart(raw: IBookingApi): Date {
    const date = Booking.normalizeDate(raw.booking_date);
    return new Date(`${date}T${raw.start_time}`);
  }

  /** Accepts "YYYY-MM-DD" or "DD-MM-YYYY", returns "YYYY-MM-DD". */
  private static normalizeDate(s: string): string {
    if (!s) return s;
    const parts = s.split("-");
    if (parts[0]?.length === 4) return s;
    const [d, m, y] = parts;
    return `${y}-${m}-${d}`;
  }

  durationHours(): number {
    return (this.end.getTime() - this.start.getTime()) / 3_600_000;
  }

  isActiveAt(t: Date): boolean {
    return this.status === "confirmed" && this.start <= t && t <= this.end;
  }

  isUpcoming(t: Date): boolean {
    return (this.status === "pending" || this.status === "confirmed") && this.start > t;
  }

  isCompletedBy(t: Date): boolean {
    return this.status === "confirmed" && this.end < t;
  }

  /**
   * Authoritative "is this booking holding its places at moment t".
   * Mirrors the backend's blocking-statuses contract exactly:
   * a row is blocking when its status is one of
   * pending/confirmed/rescheduled AND its window has not yet
   * closed (`end > t`).
   *
   * Use this — not the union of `isUpcoming || isActiveAt` — to
   * decide whether to mark the booking's places as reserved on
   * the Sessions board. The legacy union missed two real cases:
   *   1. status `rescheduled` (an extension via PUT
   *      /guest-bookings/{id}) — neither helper checks for it.
   *   2. status `pending` while `start <= t <= end` — `isActive
   *      At` requires `confirmed`, `isUpcoming` requires
   *      `start > t`. A pending booking that has already
   *      crossed its start (e.g. guest hasn't checked in yet
   *      but is en route) fell through both filters and the
   *      tile silently went grey on every screen remount.
   */
  isReservingAt(t: Date): boolean {
    if (!BLOCKING_STATUSES.includes(this.status)) return false;

    // Already over — it holds nothing.
    if (this.end <= t) return false;

    // ⚠️ …and it has to be near. This used to be `end > t` alone, which is
    // true of a reservation next Saturday — see `RESERVATION_LEAD_MS` for what
    // that cost and why the horizon is the length it is.
    //
    // The backend never agreed with the unbounded reading either:
    // `PlaceAvailabilityService` and `ConflictDetector` both answer for a
    // WINDOW, and the window this tile is asking about is the one in front of
    // the cashier.
    return this.start.getTime() - t.getTime() <= RESERVATION_LEAD_MS;
  }

  /**
   * The seat is free now, but somebody has it later today — what a cashier
   * needs in order to sell the gap without selling into the reservation.
   *
   * Deliberately separate from {@see isReservingAt}: "you cannot start here"
   * and "you can, but be aware" are different answers, and collapsing them is
   * what produced the week-long block above.
   */
  isUpcomingAt(t: Date): boolean {
    return (
      BLOCKING_STATUSES.includes(this.status) &&
      this.start.getTime() - t.getTime() > RESERVATION_LEAD_MS
    );
  }
}
