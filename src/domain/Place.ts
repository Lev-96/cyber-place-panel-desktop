import { IBranchPlace, PlatformType, PlaceType } from "@/types/api";
import { Booking } from "./Booking";
import { PlaceLiveStatus } from "./PlaceStatus";

export class Place {
  readonly id: number;
  readonly branchId: number;
  readonly type: PlaceType;
  readonly platform: PlatformType;
  readonly active: boolean;
  readonly raw: IBranchPlace;

  constructor(raw: IBranchPlace) {
    this.raw = raw;
    this.id = raw.id;
    this.branchId = raw.branch_id;
    this.type = raw.type;
    this.platform = raw.platform;
    this.active = raw.status === "active";
  }

  /**
   * Booking-side status only — the caller (`RealtimeService`) is
   * responsible for promoting "reserved" to "busy" when an
   * actual session is running on the place. That separation
   * means a booked seat without a live session shows orange
   * (reserved) instead of red, which is the cashier-facing
   * signal: "this seat is held, but the guest hasn't checked
   * in yet — convert their booking via confirm-by-code".
   *
   * Uses `Booking.isReservingAt` so the predicate matches the
   * backend's `BLOCKING_STATUSES + end > t` exactly — every
   * non-cancelled booking with an open window counts, including
   * `rescheduled` extensions and `pending` rows whose start has
   * passed (the previous `isActiveAt || isUpcoming` combo
   * silently dropped both cases and left the tile green).
   */
  computeStatus(bookings: readonly Booking[], at: Date): PlaceLiveStatus {
    if (!this.active) return "maintenance";
    if (bookings.some((b) => b.isReservingAt(at))) return "reserved";
    return "free";
  }
}
