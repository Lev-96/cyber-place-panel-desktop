import { Booking } from "@/domain/Booking";
import { Place } from "@/domain/Place";

/**
 * Maps each `place.id` to the list of bookings currently holding
 * it. The Live screen calls `Place.computeStatus(list, at)` per
 * tile to decide free/reserved/busy.
 */
export interface IPlaceAssignmentPolicy {
  assign(places: readonly Place[], bookings: readonly Booking[], at: Date): Map<number, Booking[]>;
}

/**
 * Direct pivot-based assignment: each booking carries the actual
 * `places.id` values it holds (via the `place_bookings` pivot,
 * surfaced as `Booking.placeIds`), so we walk the list of bookings
 * and attach each one to exactly the seats the guest selected.
 *
 * Replaced the previous heuristic
 * `PlatformAwareSequentialAssignment`, which sorted bookings by
 * start time and assigned them to the first N free places of
 * matching platform — that worked when `place_ids` weren't on
 * the API, but routinely painted the wrong tile orange. Once the
 * `IndexResource` started emitting `place_ids` (commit 7d8ac9b
 * on cyber-place), the heuristic could be retired.
 *
 * Filtering uses `Booking.isReservingAt` so it mirrors the
 * backend's `BLOCKING_STATUSES + end > t` predicate exactly —
 * `rescheduled` and `pending` bookings whose start has passed
 * but whose window is still open are correctly counted in.
 *
 * O(B + ΣP) where B is bookings, ΣP is sum of place_ids per
 * booking — typical input is dozens of bookings × 1-2 seats, so
 * effectively linear.
 */
export class PivotPlaceAssignment implements IPlaceAssignmentPolicy {
  assign(_places: readonly Place[], bookings: readonly Booking[], at: Date): Map<number, Booking[]> {
    const map = new Map<number, Booking[]>();
    for (const b of bookings) {
      if (!b.isReservingAt(at)) continue;
      for (const placeId of b.placeIds) {
        const list = map.get(placeId) ?? [];
        list.push(b);
        map.set(placeId, list);
      }
    }
    return map;
  }
}
