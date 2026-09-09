import { useEffect, useRef } from "react";
import { peekEcho } from "./echo";
import { useRealtimeVersion } from "./useRealtimeVersion";

/** The shape Pusher's connection object exposes, narrowed to what is used. */
type Connection = {
  bind?: (event: string, handler: () => void) => void;
  unbind?: (event: string, handler: () => void) => void;
  state?: string;
};

const connectionOf = (echo: unknown): Connection | undefined =>
  (echo as { connector?: { pusher?: { connection?: Connection } } })?.connector?.pusher
    ?.connection;

/**
 * "The socket came back — re-read, because what you have describes the world
 * before the gap."
 *
 * A subscription that survives a disconnect resumes listening and nothing
 * more. Everything broadcast during the outage is simply gone: Reverb does not
 * replay, and a client that only listens has no way to learn what it missed.
 * The screen then sits on pre-gap state until something else happens to move
 * it — which, on a quiet board, can be a very long time.
 *
 * ## The first `connected` is deliberately ignored
 *
 * It fires while the screen's own mount fetch is already in flight, and
 * re-reading on top of that is pure noise — two requests for the same thing,
 * and a race between them about which answer lands last. `seenRef` is what
 * separates "connected for the first time" from "connected AGAIN", and a
 * `disconnected` also sets it: a socket that dropped before it ever connected
 * still means the next `connected` is a reconnect.
 *
 * ## What it deliberately does not do
 *
 * It does not fetch, and it does not know what the caller's fresh state is. It
 * says WHEN, the caller says WHAT — which is what lets the sessions board
 * re-read two lists and the notification feed re-read one, from the same nine
 * lines instead of two hand-rolled copies that drift.
 *
 * Extracted from `NotificationsContext`, which was the only screen in the
 * panel that had this at all. The sessions board, the reserved-places sweep
 * and the booking feed all resumed listening with no reconciliation, so a
 * WebSocket drop across an add-time or a stop left the board showing the
 * pre-gap world.
 */
export const useRealtimeResync = (onReconnect: () => void): void => {
  const realtime = useRealtimeVersion();

  // The caller's callback is almost always a fresh closure each render.
  // Through a ref, so re-rendering the screen does not rebind the connection.
  const handlerRef = useRef(onReconnect);
  useEffect(() => {
    handlerRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    // `peekEcho`, never `getEcho`: this hook watches a connection, it does not
    // want one. Building a client here would mean a screen that merely asks
    // "tell me when the socket returns" is what opens the socket — and in a
    // test that mocks the subscribing hooks, it is what drags a real Echo into
    // a jsdom that has no Pusher.
    const echo = peekEcho();
    if (!echo) return;

    const connection = connectionOf(echo);
    if (!connection?.bind) return;

    let seen = connection.state === "connected";

    const onConnected = () => {
      if (seen) handlerRef.current();
      seen = true;
    };
    const onDropped = () => {
      seen = true;
    };

    connection.bind("connected", onConnected);
    connection.bind("disconnected", onDropped);
    connection.bind("unavailable", onDropped);

    return () => {
      connection.unbind?.("connected", onConnected);
      connection.unbind?.("disconnected", onDropped);
      connection.unbind?.("unavailable", onDropped);
    };
  }, [realtime]);
};
