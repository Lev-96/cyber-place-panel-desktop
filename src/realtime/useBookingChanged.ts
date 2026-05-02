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
 * Subscribe to booking lifecycle events on `branch.{branchId}` while
 * the component is mounted. Same channel pattern as place
 * availability — both events live on the branch's public channel and
 * the Echo singleton multiplexes between listeners.
 *
 * The handler ref pattern keeps the subscription stable across
 * re-renders; only `branchId` rotation tears it down.
 *
 * No-op when Reverb isn't configured — the desktop's existing 30s
 * polling fallback covers reload-on-event.
 */
export const useBookingChanged = (
  branchId: number | null | undefined,
  onChange: (event: BookingChangedEvent) => void,
): void => {
  const handlerRef = useRef(onChange);
  useEffect(() => { handlerRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!branchId || !Number.isFinite(branchId)) return;
    const echo = getEcho();
    if (!echo) return;

    const channelName = `branch.${branchId}`;
    const channel = echo.channel(channelName);
    const listener = (payload: unknown) => {
      handlerRef.current(payload as BookingChangedEvent);
    };
    channel.listen(".booking.changed", listener);

    return () => {
      channel.stopListening(".booking.changed", listener);
      // We deliberately do NOT leaveChannel here — usePlaceAvailability
      // (the other subscriber on the same channel) might still need it.
      // Echo refcounts internally; leaveChannel happens only when the
      // last listener detaches.
    };
  }, [branchId]);
};
