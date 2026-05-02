import { useEffect, useRef } from "react";
import { getEcho } from "./echo";

/**
 * Frozen mirror of `App\Events\BookingChanged` payload from the backend.
 * Any field added on the server must be added here intentionally so the
 * contract can't drift silently.
 */
export interface BookingChangedEvent {
  kind: "created" | "extended";
  booking_id: number;
  branch_id: number;
  company_id: number;
  code: string | null;
  booking_date: string | null;
  start_time: string | null;
  duration_minutes: number;
  rescheduled_minutes: number;
  /** IDs of places the booking covers — drives the "reserved" tile overlay. */
  place_ids: number[];
  at: string;
}

/**
 * Subscribe to `.booking.changed` on any Reverb channel while the
 * component is mounted. Channel name is supplied by the caller —
 * since the same backend event broadcasts to three audiences:
 *
 *   branch.{id}       managers — single branch they cash for.
 *   company.{id}      owners — every branch under their company.
 *   bookings.global   admins — every booking everywhere.
 *
 * Caller picks the most-specific channel for the current user's
 * role (see `resolveBookingChannel` in `GlobalBookingNotifier`).
 *
 * The handler-ref pattern keeps the subscription stable across
 * re-renders; only `channelName` rotation tears it down.
 *
 * No-op when Reverb isn't configured — the desktop's existing
 * polling fallback covers reload-on-event.
 */
export const useBookingChanged = (
  channelName: string | null | undefined,
  onChange: (event: BookingChangedEvent) => void,
): void => {
  const handlerRef = useRef(onChange);
  useEffect(() => { handlerRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!channelName) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(channelName);
    const listener = (payload: unknown) => {
      handlerRef.current(payload as BookingChangedEvent);
    };
    channel.listen(".booking.changed", listener);

    return () => {
      channel.stopListening(".booking.changed", listener);
      // We deliberately do NOT leaveChannel here — `usePlaceAvailability`
      // (and other subscribers) may still need it. Echo refcounts
      // internally; leaveChannel happens only when the last listener
      // detaches.
    };
  }, [channelName]);
};
