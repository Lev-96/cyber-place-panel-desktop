import { useEffect, useRef } from "react";
import { getEcho } from "./echo";

/**
 * Payload broadcast by `App\Events\PlaceAvailabilityChanged`.
 * Frozen here so the client can't drift from the backend contract —
 * any new field must be added on both sides intentionally.
 */
export interface PlaceAvailabilityEvent {
  branch_id: number;
  place_id: number;
  is_booked: boolean;
  reason: string;
  at: string;
}

/**
 * Subscribe to `branch.{branchId}` while the component is mounted.
 *
 * The handler is stored in a ref so the subscription doesn't tear down
 * when the parent re-renders with a fresh closure — only `branchId`
 * changing should rotate the channel.
 *
 * Returns nothing — purely side-effectful. The caller is expected to
 * keep its own state and patch it from inside the handler.
 *
 * If Reverb isn't configured (no key in env), the hook silently no-ops
 * and the caller's polling fallback handles updates.
 */
export const usePlaceAvailability = (
  branchId: number | null | undefined,
  onChange: (event: PlaceAvailabilityEvent) => void,
): void => {
  const handlerRef = useRef(onChange);
  useEffect(() => { handlerRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!branchId || !Number.isFinite(branchId)) return;
    const echo = getEcho();
    if (!echo) return;

    const channelName = `branch.${branchId}`;
    const channel = echo.channel(channelName);
    const listener = (payload: PlaceAvailabilityEvent) => {
      handlerRef.current(payload);
    };
    channel.listen(".place.availability.changed", listener);

    return () => {
      // `listen` with leading "." subscribes to the raw event name. The
      // matching `stopListening` call mirrors that.
      channel.stopListening(".place.availability.changed", listener);
      echo.leaveChannel(channelName);
    };
  }, [branchId]);
};
