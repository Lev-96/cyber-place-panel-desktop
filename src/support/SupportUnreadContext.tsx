import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useSupportMessages, type SupportMessageEvent } from "@/realtime/useSupportMessages";
import { supportRepository } from "@/repositories/SupportRepository";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * How many support replies nobody has read, and when a new one lands.
 *
 * ## Support is not in the bell, and this is why
 * A support reply used to raise a `database` notification so it could borrow
 * the panel's badge, feed and chime. That put a private conversation into the
 * bell — the feed for bookings, tournaments and the day's operational traffic —
 * and showed every message twice: once in that list, once in the chat where it
 * belongs. The backend no longer writes those rows at all, which is the only
 * fix that works; filtering them out in the client would leave them written,
 * counted, and one careless `.map` away from being visible again.
 *
 * So support runs on its own delivery, end to end: `SupportMessageCreated` on
 * the reader's private `support.user.{id}` channel, this store, the sidebar
 * badge, the floating card and a chime of its own. Nothing here touches
 * `NotificationsContext`, and nothing it does moves the bell's counter.
 *
 * ## Where the count comes from
 * The server, on mount and after every read: `unread_for_staff` per
 * conversation, summed. That is what makes the badge correct for somebody who
 * just launched the app — a socket has no backlog, and a message that arrived
 * while the desktop was closed still has to be counted.
 *
 * ## What is NOT an arrival
 * - A message this account sent. The channel carries both directions, and
 *   chiming at somebody for their own typing is absurd.
 * - A message id already seen. A reconnect can replay, and two components can
 *   hold the same channel; the id is the message's identity, and seeing it
 *   twice is one message.
 * - Anything at all from before the app started. There is no history on a
 *   channel, which is exactly why history cannot chime: a restart re-reads the
 *   COUNT from the server and plays nothing.
 * - A reply to the thread on screen, for the badge only. It is marked read as
 *   it renders, so counting it would light a badge for a message being read —
 *   but it still gets the toast and the chime, because the reader may be
 *   scrolled away or in another window.
 */

export interface SupportArrival {
  /** The support message id — the dedup key, and unique per message. */
  id: number;
  conversationId: number;
  reference: string | null;
  senderName: string;
  preview: string;
}

interface SupportUnreadShape {
  unread: number;
  /** The latest arrival not yet shown, or null. Consumed by the notifier. */
  arrival: SupportArrival | null;
  /** The notifier calls this once it has surfaced an arrival. */
  clearArrival: () => void;
  /** Re-read the authoritative count from the server. */
  refresh: () => Promise<void>;
  /** The thread currently on screen, or null when Support is not open. */
  setActiveConversation: (id: number | null) => void;
}

const Ctx = createContext<SupportUnreadShape | null>(null);

export const SupportUnreadProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [unread, setUnread] = useState(0);
  const [arrival, setArrival] = useState<SupportArrival | null>(null);
  const seen = useRef<Set<number>>(new Set());
  const activeConversation = useRef<number | null>(null);

  const enabled = can(user?.role, "menu.support");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const conversations = await supportRepository.list();
    setUnread(conversations.reduce((sum, c) => sum + (c.unread ?? 0), 0));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setUnread(0); return; }
    void refresh();
  }, [enabled, refresh, user?.id]);

  /**
   * The one subscription, on the account's own support channel.
   *
   * The same hook the chat screen uses, on the same channel — Echo hands back
   * one channel per name, so this is a second handler and not a second
   * subscription. Mounted at the app shell, so the badge and the card work on
   * every screen, not only while Support is open.
   */
  useSupportMessages(
    enabled ? (user?.id ?? null) : null,
    useCallback((event: SupportMessageEvent) => {
      const message = event.message;
      if (message.sender !== "support") return;
      if (seen.current.has(message.id)) return;
      seen.current.add(message.id);

      if (event.conversation_id !== activeConversation.current) {
        setUnread((n) => n + 1);
      }

      setArrival({
        id: message.id,
        conversationId: event.conversation_id,
        reference: event.reference ?? null,
        senderName: message.sender_name || "Cyber Place Support",
        preview: message.body ?? "",
      });
    }, []),
  );

  const value = useMemo<SupportUnreadShape>(() => ({
    unread,
    arrival,
    clearArrival: () => setArrival(null),
    refresh,
    setActiveConversation: (id) => { activeConversation.current = id; },
  }), [unread, arrival, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/**
 * Safe outside the provider: the sidebar renders on screens that do not mount
 * it (the login shell), and a hook that throws there would take the whole app
 * down over a badge.
 */
export const useSupportUnread = (): SupportUnreadShape =>
  useContext(Ctx) ?? {
    unread: 0,
    arrival: null,
    clearArrival: () => {},
    refresh: async () => {},
    setActiveConversation: () => {},
  };
