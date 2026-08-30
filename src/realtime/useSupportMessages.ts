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
 * Lines arriving in a branch's support thread, from either side.
 *
 * Subscribed per BRANCH rather than per conversation, matching the backend
 * channel: the owner and the manager of a venue are looking at the same thread
 * and both must see support's reply, and a client cannot subscribe to a
 * conversation id it does not have yet — which is exactly the state a screen is
 * in when the very first message of a new thread arrives.
 *
 * The handler lives in a ref so the subscription survives every re-render of
 * the chat that owns it; re-subscribing per render churns channels and loses
 * events in the gap. `useRealtimeVersion` re-attaches when the client is
 * rebuilt on new connection details — a subscription on the old socket looks
 * alive and receives nothing.
 */
export const useSupportMessages = (
  branchId: number | null,
  onMessage: (event: SupportMessageEvent) => void,
): void => {
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const version = useRealtimeVersion();

  useEffect(() => {
    if (!branchId) return;
    const echo = getEcho();
    // No socket configured, or it could not be built: the screen still works
    // off its own fetches, exactly as it does when Reverb is unreachable.
    if (!echo) return;

    const name = `support.branch.${branchId}`;
    const channel = echo.private(name);
    const listener = (payload: SupportMessageEvent) => handlerRef.current(payload);
    channel.listen(".support.message.created", listener);

    return () => {
      channel.stopListening(".support.message.created", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, version, realtimeVersion]);
};
