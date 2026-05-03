import { useEffect, useRef } from "react";
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
  guest_id: number;
  guest_name: string | null;
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
): void => {
  const handlerRef = useRef(onChange);
  useEffect(() => {
    handlerRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!channelName) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(channelName);
    const listener = (payload: unknown) => {
      handlerRef.current(payload as BranchSubscribedEvent);
    };
    channel.listen(".branch.subscribed", listener);

    return () => {
      channel.stopListening(".branch.subscribed", listener);
    };
  }, [channelName]);
};
