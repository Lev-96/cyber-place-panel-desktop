import { Booking } from "@/domain/Booking";
import { useBookingChanged } from "@/realtime/useBookingChanged";
import { bookingRepository } from "@/repositories/BookingRepository";
import { useCallback, useEffect, useState } from "react";

/**
 * `d-m-Y` clock-time-of-day stamp — matches what the booking
 * `IndexRequest` validator accepts (rule `date_format:d-m-Y`).
 * Local time on purpose: the cashier's machine and the backend's
 * app timezone (Asia/Yerevan) are aligned.
 */
const toDMY = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/**
 * Polling fallback for cases where the WebSocket dropped silently
 * (Reverb restart, network change, OS-level tab throttling). The
 * Reverb delta is the primary realtime path; this just guarantees
 * eventual consistency. 30s is imperceptible on the happy path.
 */
const SANITY_SWEEP_MS = 30_000;

const fetchReservedPlaceIds = async (branchId: number): Promise<Set<number>> => {
  const now = new Date();
  const bookings = await bookingRepository.listAll({
    branch_id: branchId,
    // Today + future. Past bookings on `booking_date < today` can't
    // still be holding their seats (their end is in the past).
    date_from: toDMY(now),
  });
  const ids = new Set<number>();
  for (const b of bookings) {
    if (!b.isReservingAt(now)) continue;
    for (const id of b.placeIds) ids.add(id);
  }
  return ids;
};

/**
 * Single source of truth for "which `places.id` on `branchId`
 * are currently held by a non-cancelled booking whose window is
 * still open". Pairs a REST snapshot (so every (re)mount and the
 * periodic sanity sweep restore the full set) with the
 * `booking.changed` Reverb delta on the constant `bookings.global`
 * channel — the same channel `GlobalBookingNotifier` uses, so we
 * inherit its proven delivery rather than re-introducing a per-
 * branch subscription that previously went silent.
 *
 * Consumers (Sessions board, Branch places grid, future kiosk
 * overlays) read the returned `Set` and decide their own UX.
 * They MUST NOT re-implement any part of the snapshot/delta
 * plumbing — keeping it here is what guarantees the two screens
 * agree on which seats are reserved at any given moment.
 *
 * Returns an empty Set when `branchId` is non-finite (e.g.
 * during initial route-param resolution) so callers can still
 * dereference `.has(...)` safely without a null guard.
 */
export const useReservedPlaceIds = (branchId: number): Set<number> => {
  const [ids, setIds] = useState<Set<number>>(new Set());

  const reload = useCallback(async () => {
    if (!Number.isFinite(branchId)) return;
    try {
      const fresh = await fetchReservedPlaceIds(branchId);
      setIds(fresh);
    } catch {
      // Intentionally swallowed: Reverb keeps the set warm and the
      // next sweep retries. Surfacing this would clutter every
      // screen with transient errors that auto-resolve.
    }
  }, [branchId]);

  // Snapshot on mount / branch change.
  useEffect(() => {
    void reload();
  }, [reload]);

  // Realtime delta. `kind`-aware so a `cancelled` event removes
  // the place_ids it carries; `created` / `extended` / `confirmed`
  // add them. Filter by `branch_id` because the channel is global.
  useBookingChanged(
    "bookings.global",
    useCallback((evt) => {
      if (evt.branch_id !== branchId) return;
      setIds((prev) => {
        const next = new Set(prev);
        if (evt.kind === "cancelled") {
          for (const id of evt.place_ids) next.delete(id);
        } else {
          for (const id of evt.place_ids) next.add(id);
        }
        return next;
      });
    }, [branchId]),
  );

  // Sanity sweep: drops bookings that quietly expired between
  // events and recovers from a silently-dropped WebSocket.
  useEffect(() => {
    const handle = setInterval(() => { void reload(); }, SANITY_SWEEP_MS);
    return () => clearInterval(handle);
  }, [reload]);

  return ids;
};

// Re-export the domain helper so screens that need to recompute a
// reservation predicate locally (e.g. against a custom booking
// list) don't reimplement BLOCKING_STATUSES — they go through the
// same `Booking.isReservingAt` the hook uses internally.
export { Booking };
