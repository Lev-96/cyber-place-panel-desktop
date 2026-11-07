import type { StaffReservation } from "@/domain/StaffReservation";
import { useAsync } from "@/hooks/useAsync";
import { useBookingChanged } from "@/realtime/useBookingChanged";
import { useRealtimeResync } from "@/realtime/useRealtimeResync";
import { bookingRepository } from "@/repositories/BookingRepository";
import { useCallback, useEffect, useRef } from "react";

/** The safety-net re-read (CLAUDE.md §6 rule 11): Reverb drops are silent. */
export const RESERVATIONS_POLL_MS = 30_000;
/**
 * Events in a burst (a guest booking three seats, a move that cancels and
 * creates) are read once. The payload is a SIGNAL here: it carries no
 * contact, no `editable`, no effective end, so the row cannot be patched from
 * it and is read again instead (the same pattern as `Home`'s debounced
 * refresh).
 */
export const EVENT_COALESCE_MS = 300;

/**
 * A branch's reservations over `from`..`to` ("Y-m-d", inclusive) for the
 * bookings calendar (2026-11-07): a REST read on mount and on every range
 * change, re-read on any `.booking.changed` of the branch (private
 * `branch.{id}`, any kind, `updated` included), on a socket reconnect, and
 * every 30 s. While a re-read is in flight the previous rows stay on screen
 * (`useAsync`); a failed re-read keeps them and reports the error.
 */
export const useStaffReservations = (branchId: number, from: string, to: string) => {
  const state = useAsync<StaffReservation[]>(
    () => bookingRepository.listReservations(branchId, from, to),
    [branchId, from, to],
  );

  // One stable reload for the timers and the socket (rule 11: arm intervals ONCE, via a ref).
  const reloadRef = useRef(state.reload);
  useEffect(() => { reloadRef.current = state.reload; }, [state.reload]);
  const reload = useCallback(() => { void reloadRef.current(); }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useBookingChanged(
    Number.isFinite(branchId) ? `branch.${branchId}` : null,
    useCallback((evt) => {
      if (evt.branch_id !== branchId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { timerRef.current = null; reload(); }, EVENT_COALESCE_MS);
    }, [branchId, reload]),
    true,
  );

  useRealtimeResync(reload);

  useEffect(() => {
    const handle = setInterval(reload, RESERVATIONS_POLL_MS);
    return () => clearInterval(handle);
  }, [reload]);

  return { reservations: state.data, loading: state.loading, error: state.error, reload };
};
