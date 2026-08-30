import { useEffect, useRef } from "react";
import { getEcho } from "./echo";
import { useRealtimeVersion } from "./useRealtimeVersion";

/**
 * The two PlayStation signals that travel over the socket.
 *
 * Deliberately not polled. A console being awake without a session is a
 * ten-second question, and a poll that answers it after twenty is not an
 * answer. Device monitoring stays on its timer — that is a different job, with
 * a different cost, and it belongs there.
 */

/** "A console in your venue is on and nothing authorised it." Owner only. */
export interface Ps5UnexpectedWakeEvent {
  /** The row the answer is posted against. */
  id: number;
  /** The wake itself, as the panel that saw it named it. */
  event_uuid: string;
  device_id: number;
  branch_id: number;
  place_label: string;
  grace_seconds: number;
}

/** The owner's answer, back to the venue. Heard by whichever panel must act. */
export interface Ps5WakeDecidedEvent {
  event_uuid: string;
  device_id: number;
  approved: boolean;
}

/**
 * Subscribe to a private channel for one PlayStation event, for as long as the
 * component is mounted.
 *
 * The handler-ref keeps the subscription stable across re-renders — only the
 * channel name or a rebuilt Echo client tears it down — which is the same
 * pattern the booking feed uses, and for the same reason: re-subscribing on
 * every render loses events in the gap.
 */
const usePs5Channel = <T,>(
  channelName: string | null,
  eventName: string,
  onEvent: (payload: T) => void,
): void => {
  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);

  const realtime = useRealtimeVersion();

  useEffect(() => {
    if (!channelName) return;

    // Building the client can THROW, not just return null — an unconfigured or
    // half-loaded realtime layer must not take the sessions board down with it.
    // Everything this feature does to a console is driven by the ten-second
    // monitor, which does not depend on the socket; losing it costs the owner's
    // confirmation, not the protection.
    let channel: { listen: (e: string, l: (p: unknown) => void) => void; stopListening: (e: string, l: (p: unknown) => void) => void };
    const listener = (payload: unknown) => handlerRef.current(payload as T);

    try {
      const echo = getEcho();
      if (!echo) {
        console.warn(`[reverb] echo not initialised — ${eventName} will not arrive`);
        return;
      }

      channel = echo.private(channelName);
      channel.listen(eventName, listener);
    } catch (error) {
      console.warn(`[reverb] could not subscribe to ${channelName}`, error);
      return;
    }

    return () => {
      try { channel.stopListening(eventName, listener); } catch { /* client already gone */ }
    };
  }, [channelName, eventName, realtime]);
};

/** The owner's own channel. Nobody else is asked, and nobody else can listen. */
export const usePs5UnexpectedWake = (
  ownerUserId: number | null,
  onEvent: (event: Ps5UnexpectedWakeEvent) => void,
): void => usePs5Channel(
  ownerUserId ? `user.${ownerUserId}.ps5` : null,
  ".ps5.unexpected-wake",
  onEvent,
);

/** The branch channel: the answer reaches the panel standing in the room. */
export const usePs5WakeDecided = (
  branchId: number | null,
  onEvent: (event: Ps5WakeDecidedEvent) => void,
): void => usePs5Channel(
  branchId ? `branch.${branchId}.ps5` : null,
  ".ps5.wake-decided",
  onEvent,
);
