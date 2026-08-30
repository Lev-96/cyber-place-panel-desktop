import { useEffect, useRef } from "react";
import { useRealtimeVersion } from "@/realtime/useRealtimeVersion";
import { getEcho } from "./echo";

/**
 * Frozen mirror of `App\Events\BranchSubscribed` from the backend.
 * Fires when a guest subscribes to a branch's announcements via the
 * mobile app — the desktop notifier surfaces it as an OS push.
 */
export interface BranchSubscribedEvent {
  branch_id: number;
  branch_address: string | null;
  company_id: number;
  company_name: string | null;
  guest_id: number;
  guest_first_name: string | null;
  guest_last_name: string | null;
  at: string;
}

/**
 * Subscribe to `.branch.subscribed` on any Reverb channel while the
 * component is mounted. Same channel-fan-out the booking events use
 * (branch.{id} / company.{id} / bookings.global) so we can reuse
 * the global subscription a staff member already holds.
 */
export const useBranchSubscribed = (
  channelName: string | null | undefined,
  onChange: (event: BranchSubscribedEvent) => void,
  /** Staff feeds are authorised now — see realtime/bookingScope.ts. */
  isPrivate = false,
): void => {
  const handlerRef = useRef(onChange);
  useEffect(() => {
    handlerRef.current = onChange;
  }, [onChange]);

  // Re-attaches when the Echo client is rebuilt on connection details the
  // backend handed us: a subscription on the discarded client is silent.
  const realtime = useRealtimeVersion();

  useEffect(() => {
    if (!channelName) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = isPrivate ? echo.private(channelName) : echo.channel(channelName);
    const listener = (payload: unknown) => {
      handlerRef.current(payload as BranchSubscribedEvent);
    };
    channel.listen(".branch.subscribed", listener);

    return () => {
      channel.stopListening(".branch.subscribed", listener);
    };
  }, [channelName, isPrivate, realtime]);
};
