import { getEcho, realtimeVersion } from "@/realtime/echo";
import { useRealtimeVersion } from "@/realtime/useRealtimeVersion";
import type { ISupportMessage } from "@/api/support";
import { useEffect, useRef } from "react";

export interface SupportMessageEvent {
  conversation_id: number;
  reference: string;
  message: ISupportMessage;
}

/**
 * Lines arriving in THIS PERSON'S support threads, from either side.
 *
 * Subscribed per USER, matching the backend channel. It was per branch, and
 * that was a leak: a support thread is one person's correspondence, and a
 * branch-wide channel put a manager's reply in front of their owner and the
 * other way round. Per user also means one subscription for every thread the
 * account has, so switching threads churns no channels and the first message
 * of a brand-new thread arrives on a channel already held.
 *
 * The handler lives in a ref so the subscription survives every re-render of
 * the chat that owns it; re-subscribing per render churns channels and loses
 * events in the gap. `useRealtimeVersion` re-attaches when the client is
 * rebuilt on new connection details — a subscription on the old socket looks
 * alive and receives nothing.
 */
export const useSupportMessages = (
  userId: number | null,
  onMessage: (event: SupportMessageEvent) => void,
): void => {
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const version = useRealtimeVersion();

  useEffect(() => {
    if (!userId) return;
    const echo = getEcho();
    // No socket configured, or it could not be built: the screen still works
    // off its own fetches, exactly as it does when Reverb is unreachable.
    if (!echo) return;

    const name = `support.user.${userId}`;
    const channel = echo.private(name);
    const listener = (payload: SupportMessageEvent) => handlerRef.current(payload);
    channel.listen(".support.message.created", listener);

    return () => {
      channel.stopListening(".support.message.created", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, version, realtimeVersion]);
};
