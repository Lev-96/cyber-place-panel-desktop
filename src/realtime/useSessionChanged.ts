import { useEffect, useRef } from "react";
import { useRealtimeVersion } from "@/realtime/useRealtimeVersion";
import { getEcho } from "./echo";
import { apiCache } from "@/api/client";

/**
 * Payload of `App\Events\SessionChanged`. Frozen here so this side cannot
 * drift from the backend's — a renamed key reads as `undefined` and nothing
 * anywhere throws.
 */
export interface SessionChangedEvent {
  kind:
    | "started"
    | "stopped"
    | "joystick.added"
    | "joystick.removed"
    | "time.added"
    | "unlimited"
    | "free.changed";
  session_id: number;
  branch_id: number;
  pc_id: number;
  place_id: number | null;
  status: string;
  mode: string;
  is_free: boolean;
  is_unlimited: boolean;
  joystick_count: number;
  ends_at: string | null;
  at: string;
}

/**
 * A session at this venue changed in a way the floor has to see.
 *
 * Until this event existed the only session signal was
 * `place.availability.changed` — "this seat is busy / free" — and everything in
 * between was invisible: a second cashier's panel found out that a joystick had
 * been added, an hour granted or a bill waived on its next 30-second poll,
 * which is half a minute of two people acting on different numbers over the
 * same till.
 *
 * PRIVATE channel: everything the payload carries is operational, and the
 * public `branch.{id}` is the one the mobile app holds on a guest token.
 *
 * Same subscription rules as {@link usePlaceAvailability}, for the same
 * reasons: the handler lives in a ref so a parent re-render does not rotate the
 * channel, and `leaveChannel` is never called — `branch.{id}` is shared with
 * the booking, tournament and subscribe listeners, and Echo caches the channel
 * object by name with no refcount.
 */
export const useSessionChanged = (
  branchId: number | null | undefined,
  onChange: (event: SessionChangedEvent) => void,
): void => {
  const handlerRef = useRef(onChange);
  useEffect(() => {
    handlerRef.current = onChange;
  }, [onChange]);

  const realtime = useRealtimeVersion();

  useEffect(() => {
    if (!branchId || !Number.isFinite(branchId)) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.private(`branch.${branchId}`);
    const listener = (payload: SessionChangedEvent) => {
      // Another machine just changed this session. The client-side response
      // cache is the only thing that could still be holding the previous
      // answer, so drop it before the handler runs.
      apiCache.invalidatePrefix("/sessions");
      apiCache.invalidatePrefix("/pcs");
      handlerRef.current(payload);
    };
    channel.listen(".session.changed", listener);

    return () => {
      channel.stopListening(".session.changed", listener);
      // No leaveChannel — see the note in usePlaceAvailability. This channel
      // carries booking, tournament and subscribe events too.
    };
  }, [branchId, realtime]);
};
